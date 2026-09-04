import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime-hub";
import { getVietnamTodayString, getVietnamTime, maskStudentCode } from "@/lib/utils";
import { PaymentMethod, PaymentStatus, PaymentTransactionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// POST: Thực hiện thu tiền mặt tại quầy
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF"].includes(session.user.role)) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thu tiền mặt" }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, billId, amount, customerPaid, note } = body;

    const payAmount = Number(amount);
    const paidByCustomer = Number(customerPaid || amount);

    if (!studentId || !billId) {
      return NextResponse.json({ error: "Thiếu thông tin học sinh hoặc hóa đơn" }, { status: 400 });
    }

    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "Số tiền thu phải lớn hơn 0" }, { status: 400 });
    }

    // 1. Kiểm tra hóa đơn tồn tại và thuộc về học sinh
    const bill = await prisma.monthlyBill.findUnique({
      where: { id: billId },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { id: true, name: true } },
          },
        },
        transactions: {
          where: { isVoided: false },
        },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: "Không tìm thấy hóa đơn cần thu" }, { status: 404 });
    }

    if (bill.studentId !== studentId) {
      return NextResponse.json({ error: "Hóa đơn không khớp với học sinh được chọn" }, { status: 400 });
    }

    // Tính số tiền còn nợ thực tế
    const existingPaid = bill.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const billFinalAmount = Number(bill.finalAmount);
    const remainingDebt = Math.max(0, billFinalAmount - existingPaid);

    if (remainingDebt <= 0 && bill.paymentStatus === PaymentStatus.PAID) {
      return NextResponse.json({ error: "Hóa đơn này đã được thanh toán đầy đủ trước đó" }, { status: 400 });
    }

    // 2. Sinh mã phiếu thu duy nhất theo ngày: PT-YYYYMMDD-XXXX
    const todayStr = getVietnamTodayString().replace(/-/g, "");
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const todayCashTxCount = await prisma.paymentTransaction.count({
      where: {
        paymentMethod: PaymentMethod.CASH,
        transDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const sequence = String(todayCashTxCount + 1).padStart(4, "0");
    const receiptNumber = `PT-${todayStr}-${sequence}`;

    const cashierName = session.user.name || "Thu ngân";

    // 3. Thực thi transaction an toàn
    const result = await prisma.$transaction(async (tx) => {
      // Tạo giao dịch tiền mặt
      const newTx = await tx.paymentTransaction.create({
        data: {
          receiptNumber,
          billId: bill.id,
          studentId: bill.studentId,
          paymentMethod: PaymentMethod.CASH,
          cashierId: session.user.id,
          cashierName,
          amount: payAmount,
          content: `Thu tiền mặt tiền ăn bán trú T${String(bill.month).padStart(2, "0")}/${bill.year}`,
          gateway: "TIỀN MẶT",
          status: PaymentTransactionStatus.MATCHED,
          note: note ? String(note).trim() : null,
          transDate: new Date(),
        },
      });

      // Cập nhật trạng thái hóa đơn
      const newTotalPaid = existingPaid + payAmount;
      let newPaymentStatus: PaymentStatus = bill.paymentStatus;
      if (newTotalPaid >= billFinalAmount && billFinalAmount > 0) {
        newPaymentStatus = PaymentStatus.PAID;
      } else if (newTotalPaid > 0) {
        newPaymentStatus = PaymentStatus.PARTIAL;
      }

      const updatedBill = await tx.monthlyBill.update({
        where: { id: bill.id },
        data: { paymentStatus: newPaymentStatus },
      });

      return { newTx, updatedBill, newTotalPaid, newPaymentStatus };
    });

    // 4. Phát tín hiệu Realtime
    broadcastChange("monthly_bills", "UPDATE", {
      billId: bill.id,
      studentId: bill.studentId,
      paymentStatus: result.newPaymentStatus,
    });
    broadcastChange("payment_transactions", "INSERT", {
      transactionId: result.newTx.id,
      paymentMethod: "CASH",
    });

    const isFullAdmin = session.user.role === "ADMIN";
    const maskedCode = isFullAdmin ? bill.student.studentCode : maskStudentCode(bill.student.studentCode);

    return NextResponse.json({
      success: true,
      message: `Đã lập phiếu thu tiền mặt ${receiptNumber} thành công!`,
      receipt: {
        id: result.newTx.id,
        receiptNumber,
        transDate: result.newTx.transDate,
        amount: payAmount,
        customerPaid: paidByCustomer,
        changeAmount: Math.max(0, paidByCustomer - payAmount),
        note,
        cashierName,
        bill: {
          id: bill.id,
          month: bill.month,
          year: bill.year,
          finalAmount: billFinalAmount,
          paymentStatus: result.newPaymentStatus,
        },
        student: {
          id: bill.student.id,
          fullName: bill.student.user?.fullName || "",
          studentCode: maskedCode,
          boardingCode: bill.student.boardingCode || "",
          className: bill.student.class?.name || bill.student.class?.id || "",
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi thu tiền mặt:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xử lý thanh toán tiền mặt", details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Lấy danh sách phiếu thu tiền mặt (kèm bộ lọc & phân trang)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const cashierId = searchParams.get("cashierId");
    const closingSessionId = searchParams.get("closingSessionId");
    const unclosedOnly = searchParams.get("unclosedOnly") === "true";
    const search = searchParams.get("search")?.trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const where: any = {
      paymentMethod: PaymentMethod.CASH,
    };

    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      where.transDate = { gte: start, lte: end };
    }

    if (cashierId && cashierId !== "all") {
      where.cashierId = cashierId;
    }

    if (closingSessionId) {
      where.closingSessionId = closingSessionId;
    }

    if (unclosedOnly) {
      where.closingSessionId = null;
      where.isVoided = false;
    }

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { note: { contains: search, mode: "insensitive" } },
        {
          student: {
            OR: [
              { studentCode: { contains: search, mode: "insensitive" } },
              { boardingCode: { contains: search, mode: "insensitive" } },
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { class: { name: { contains: search, mode: "insensitive" } } },
            ],
          },
        },
      ];
    }

    const total = await prisma.paymentTransaction.count({ where });
    const skip = (page - 1) * limit;

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        bill: {
          select: {
            id: true,
            month: true,
            year: true,
            finalAmount: true,
            paymentStatus: true,
          },
        },
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { id: true, name: true } },
          },
        },
        cashier: {
          select: { id: true, fullName: true, username: true },
        },
        voidedByUser: {
          select: { id: true, fullName: true },
        },
        closingSession: {
          select: { id: true, code: true, status: true },
        },
      },
      orderBy: { transDate: "desc" },
      skip,
      take: limit,
    });

    const isFullAdmin = session.user.role === "ADMIN";

    // Format kết quả: ÁP DỤNG CHE MÃ HỌC SINH (CCCD) NẾU LÀ THU NGÂN
    const data = transactions.map((t) => {
      const originalCode = t.student?.studentCode || "";
      const displayedCode = isFullAdmin ? originalCode : maskStudentCode(originalCode);

      return {
        id: t.id,
        receiptNumber: t.receiptNumber,
        amount: Number(t.amount),
        transDate: t.transDate,
        content: t.content,
        note: t.note,
        isVoided: t.isVoided,
        voidReason: t.voidReason,
        voidedAt: t.voidedAt,
        voidedBy: t.voidedByUser?.fullName || null,
        cashierId: t.cashierId,
        cashierName: t.cashierName || t.cashier?.fullName || "Thu ngân",
        closingSessionId: t.closingSessionId,
        closingSessionCode: t.closingSession?.code || null,
        closingSessionStatus: t.closingSession?.status || null,
        bill: t.bill,
        student: t.student
          ? {
              id: t.student.id,
              fullName: t.student.user?.fullName || "",
              studentCode: displayedCode, // Đã che CCCD nếu là Thu ngân
              boardingCode: t.student.boardingCode || "",
              className: t.student.class?.name || t.student.class?.id || "",
            }
          : null,
      };
    });

    // Thống kê tổng tiền
    const stats = await prisma.paymentTransaction.aggregate({
      where: { ...where, isVoided: false },
      _sum: { amount: true },
      _count: { id: true },
    });

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalValidCount: stats._count.id,
        totalAmount: Number(stats._sum.amount || 0),
      },
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách phiếu thu tiền mặt:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải danh sách phiếu thu", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Hủy phiếu thu tiền mặt do sai sót
// BẢO VỆ NGHIÊM NGẶT: CHỈ KẾ TOÁN HOẶC QUẢN TRỊ VIÊN MỚI ĐƯỢC PHÉP HỦY
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Kiểm tra quyền Kế toán / Admin: Thu ngân bình thường bị chặn 403 ngay lập tức!
    const isAccountantOrAdmin =
      session.user.role === "ADMIN" ||
      hasPermission(session.user.permissions || [], "MANAGE_FINANCE");

    if (!isAccountantOrAdmin) {
      return NextResponse.json(
        {
          error: "BẠN KHÔNG CÓ QUYỀN HỦY PHIẾU THU! Chỉ Kế toán hoặc Quản trị viên mới được phép thực hiện thao tác này.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transactionId, voidReason } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "Thiếu ID phiếu thu cần hủy" }, { status: 400 });
    }

    if (!voidReason || String(voidReason).trim().length < 5) {
      return NextResponse.json(
        { error: "Bắt buộc phải nhập lý do hủy phiếu chi tiết (tối thiểu 5 ký tự) để lưu vết kiểm toán" },
        { status: 400 }
      );
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        closingSession: true,
        bill: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Không tìm thấy phiếu thu cần hủy" }, { status: 404 });
    }

    if (transaction.paymentMethod !== PaymentMethod.CASH) {
      return NextResponse.json({ error: "Giao dịch này không phải là thanh toán tiền mặt" }, { status: 400 });
    }

    if (transaction.isVoided) {
      return NextResponse.json({ error: "Phiếu thu này đã bị hủy trước đó" }, { status: 400 });
    }

    // Nếu ca bàn giao đã được Kế toán xác nhận (CONFIRMED) -> Khóa cứng vĩnh viễn
    if (transaction.closingSession?.status === "CONFIRMED") {
      return NextResponse.json(
        {
          error: "Phiếu thu này thuộc ca bàn giao đã được Kế toán XÁC NHẬN VÀ KHÓA SỔ. Tuyệt đối không thể hủy!",
        },
        { status: 400 }
      );
    }

    // Thực hiện hủy và cập nhật lại công nợ hóa đơn
    const result = await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          isVoided: true,
          voidedBy: session.user.id,
          voidedAt: new Date(),
          voidReason: String(voidReason).trim(),
        },
      });

      let updatedBill = null;
      if (transaction.bill) {
        // Tính lại tổng tiền đã đóng sau khi loại bỏ phiếu hủy
        const remainingTx = transaction.bill.transactions.filter(
          (t) => t.id !== transactionId && !t.isVoided
        );
        const newPaid = remainingTx.reduce((sum, t) => sum + Number(t.amount), 0);
        const finalAmount = Number(transaction.bill.finalAmount);

        let newStatus: PaymentStatus = PaymentStatus.UNPAID;
        if (newPaid >= finalAmount && finalAmount > 0) {
          newStatus = PaymentStatus.PAID;
        } else if (newPaid > 0) {
          newStatus = PaymentStatus.PARTIAL;
        }

        updatedBill = await tx.monthlyBill.update({
          where: { id: transaction.bill.id },
          data: { paymentStatus: newStatus },
        });
      }

      return { updatedTx, updatedBill };
    });

    // Phát tín hiệu Realtime
    if (result.updatedBill) {
      broadcastChange("monthly_bills", "UPDATE", {
        billId: result.updatedBill.id,
        paymentStatus: result.updatedBill.paymentStatus,
      });
    }
    broadcastChange("payment_transactions", "UPDATE", {
      transactionId,
      isVoided: true,
    });

    return NextResponse.json({
      success: true,
      message: `Đã hủy phiếu thu ${transaction.receiptNumber || transactionId} thành công! Công nợ học sinh đã được điều chỉnh lại.`,
      data: result,
    });
  } catch (error) {
    console.error("Lỗi khi hủy phiếu thu tiền mặt:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi hủy phiếu thu", details: String(error) },
      { status: 500 }
    );
  }
}
