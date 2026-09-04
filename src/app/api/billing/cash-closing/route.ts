import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime-hub";
import { getVietnamTodayString, maskStudentCode } from "@/lib/utils";
import { ClosingStatus, PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET: Lấy thông tin chốt ca
// - mode=current: Danh sách giao dịch tiền mặt chưa kết ca của Thu ngân hiện tại
// - mode=history: Danh sách các biên bản chốt ca đã lập
// - mode=detail: Chi tiết 1 biên bản chốt ca kèm toàn bộ phiếu thu (để in biên bản A4)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "current";
    const isFullAdmin = session.user.role === "ADMIN";

    // 1. Chế độ xem các giao dịch tiền mặt hiện tại chưa chốt ca của Thu ngân
    if (mode === "current") {
      const cashierId = searchParams.get("cashierId") || session.user.id;

      const where: any = {
        paymentMethod: PaymentMethod.CASH,
        closingSessionId: null,
        isVoided: false,
      };

      // Nếu không phải Admin thì chỉ xem của chính mình
      if (!isFullAdmin && session.user.role !== "BOARDING_MANAGER") {
        where.cashierId = session.user.id;
      } else if (cashierId && cashierId !== "all") {
        where.cashierId = cashierId;
      }

      const transactions = await prisma.paymentTransaction.findMany({
        where,
        include: {
          bill: {
            select: { id: true, month: true, year: true, finalAmount: true },
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
        },
        orderBy: { transDate: "asc" },
      });

      const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      const formattedTransactions = transactions.map((t) => ({
        id: t.id,
        receiptNumber: t.receiptNumber,
        amount: Number(t.amount),
        transDate: t.transDate,
        content: t.content,
        note: t.note,
        cashierName: t.cashierName || t.cashier?.fullName || "Thu ngân",
        student: t.student
          ? {
              id: t.student.id,
              fullName: t.student.user?.fullName || "",
              studentCode: isFullAdmin ? t.student.studentCode : maskStudentCode(t.student.studentCode),
              boardingCode: t.student.boardingCode || "",
              className: t.student.class?.name || t.student.class?.id || "",
            }
          : null,
        bill: t.bill,
      }));

      return NextResponse.json({
        success: true,
        count: transactions.length,
        totalAmount,
        transactions: formattedTransactions,
      });
    }

    // 2. Chế độ xem chi tiết 1 biên bản bàn giao (để in A4)
    if (mode === "detail") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ error: "Thiếu ID biên bản bàn giao" }, { status: 400 });
      }

      const closing = await prisma.dailyCashClosing.findUnique({
        where: { id },
        include: {
          cashier: { select: { id: true, fullName: true, username: true } },
          accountant: { select: { id: true, fullName: true, username: true } },
          transactions: {
            include: {
              bill: { select: { id: true, month: true, year: true, finalAmount: true } },
              student: {
                include: {
                  user: { select: { fullName: true } },
                  class: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { transDate: "asc" },
          },
        },
      });

      if (!closing) {
        return NextResponse.json({ error: "Không tìm thấy biên bản bàn giao" }, { status: 404 });
      }

      const formattedTransactions = closing.transactions.map((t) => ({
        id: t.id,
        receiptNumber: t.receiptNumber,
        amount: Number(t.amount),
        transDate: t.transDate,
        content: t.content,
        note: t.note,
        isVoided: t.isVoided,
        student: t.student
          ? {
              id: t.student.id,
              fullName: t.student.user?.fullName || "",
              studentCode: isFullAdmin ? t.student.studentCode : maskStudentCode(t.student.studentCode),
              boardingCode: t.student.boardingCode || "",
              className: t.student.class?.name || t.student.class?.id || "",
            }
          : null,
        bill: t.bill,
      }));

      return NextResponse.json({
        success: true,
        closing: {
          ...closing,
          totalAmount: Number(closing.totalAmount),
          transactions: formattedTransactions,
        },
      });
    }

    // 3. Chế độ xem lịch sử các biên bản bàn giao
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");
    const cashierId = searchParams.get("cashierId");

    const where: any = {};
    if (status && status !== "all") {
      where.status = status as ClosingStatus;
    }
    if (cashierId && cashierId !== "all") {
      where.cashierId = cashierId;
    }

    const total = await prisma.dailyCashClosing.count({ where });
    const skip = (page - 1) * limit;

    const closings = await prisma.dailyCashClosing.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true, username: true } },
        accountant: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: closings.map((c) => ({
        ...c,
        totalAmount: Number(c.totalAmount),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu chốt ca:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải dữ liệu chốt ca", details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Thu ngân thực hiện Chốt ca & Lập biên bản bàn giao nộp Kế toán
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "CASHIER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Bạn không có quyền lập biên bản bàn giao tiền mặt" }, { status: 403 });
    }

    const body = await request.json();
    const { closingDate, denominationData, note } = body;

    // 1. Tìm tất cả các phiếu thu tiền mặt chưa chốt ca của Thu ngân hiện tại
    const unclosedTransactions = await prisma.paymentTransaction.findMany({
      where: {
        cashierId: session.user.id,
        paymentMethod: PaymentMethod.CASH,
        closingSessionId: null,
        isVoided: false,
      },
      orderBy: { transDate: "asc" },
    });

    if (unclosedTransactions.length === 0) {
      return NextResponse.json(
        { error: "Không có giao dịch tiền mặt nào chưa chốt ca để lập biên bản bàn giao!" },
        { status: 400 }
      );
    }

    // 2. Tính tổng tiền và thời gian
    const totalTransactions = unclosedTransactions.length;
    const totalAmount = unclosedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const startTime = unclosedTransactions[0].transDate;
    const endTime = new Date();

    // 3. Sinh mã biên bản bàn giao: BBBG-YYYYMMDD-XXXX
    const todayStr = getVietnamTodayString().replace(/-/g, "");
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const todayClosingCount = await prisma.dailyCashClosing.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const sequence = String(todayClosingCount + 1).padStart(4, "0");
    const code = `BBBG-${todayStr}-${sequence}`;

    const parsedClosingDate = closingDate ? new Date(closingDate) : new Date();

    // 4. Lưu biên bản và gắn liên kết vào các giao dịch
    const result = await prisma.$transaction(async (tx) => {
      const newClosing = await tx.dailyCashClosing.create({
        data: {
          code,
          closingDate: parsedClosingDate,
          startTime,
          endTime,
          cashierId: session.user.id,
          totalTransactions,
          totalAmount,
          denominationData: denominationData ? JSON.stringify(denominationData) : null,
          status: ClosingStatus.PENDING,
          note: note ? String(note).trim() : null,
        },
      });

      // Cập nhật closingSessionId cho tất cả các giao dịch này
      await tx.paymentTransaction.updateMany({
        where: {
          id: { in: unclosedTransactions.map((t) => t.id) },
        },
        data: {
          closingSessionId: newClosing.id,
        },
      });

      return newClosing;
    });

    // Phát tín hiệu Realtime
    broadcastChange("payment_transactions", "UPDATE");

    return NextResponse.json({
      success: true,
      message: `Đã lập biên bản bàn giao ${code} thành công! Vui lòng in biên bản và nộp tiền mặt cho Kế toán.`,
      closing: {
        ...result,
        totalAmount: Number(result.totalAmount),
      },
    });
  } catch (error) {
    console.error("Lỗi khi lập biên bản chốt ca:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi lập biên bản chốt ca", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Kế toán hoặc Quản trị viên duyệt xác nhận nhận tiền mặt bàn giao
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Kiểm tra quyền Kế toán / Admin
    const isAccountantOrAdmin =
      session.user.role === "ADMIN" ||
      hasPermission(session.user.permissions || [], "MANAGE_FINANCE");

    if (!isAccountantOrAdmin) {
      return NextResponse.json(
        { error: "BẠN KHÔNG CÓ QUYỀN! Chỉ Kế toán hoặc Quản trị viên mới được phép duyệt xác nhận nhận tiền bàn giao." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { closingId, action, note } = body;

    if (!closingId || !["CONFIRM", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Thiếu ID biên bản hoặc hành động không hợp lệ" }, { status: 400 });
    }

    const closing = await prisma.dailyCashClosing.findUnique({
      where: { id: closingId },
      include: { transactions: true },
    });

    if (!closing) {
      return NextResponse.json({ error: "Không tìm thấy biên bản bàn giao" }, { status: 404 });
    }

    if (closing.status === ClosingStatus.CONFIRMED) {
      return NextResponse.json({ error: "Biên bản bàn giao này đã được xác nhận trước đó" }, { status: 400 });
    }

    if (action === "CONFIRM") {
      const updatedClosing = await prisma.dailyCashClosing.update({
        where: { id: closingId },
        data: {
          status: ClosingStatus.CONFIRMED,
          accountantId: session.user.id,
          confirmedAt: new Date(),
          note: note ? `${closing.note || ""}\n[Kế toán ghi chú]: ${note}`.trim() : closing.note,
        },
      });

      broadcastChange("payment_transactions", "UPDATE");

      return NextResponse.json({
        success: true,
        message: `Kế toán đã XÁC NHẬN NHẬN ĐỦ TIỀN cho biên bản ${closing.code}. Toàn bộ phiếu thu đã được KHÓA CỨNG!`,
        closing: updatedClosing,
      });
    }

    if (action === "REJECT") {
      // Từ chối nhận tiền (ví dụ lệch tiền): Trả các giao dịch về trạng thái chưa chốt ca để Thu ngân kiểm đếm lại
      await prisma.$transaction([
        prisma.paymentTransaction.updateMany({
          where: { closingSessionId: closingId },
          data: { closingSessionId: null },
        }),
        prisma.dailyCashClosing.update({
          where: { id: closingId },
          data: {
            status: ClosingStatus.REJECTED,
            accountantId: session.user.id,
            note: note ? `${closing.note || ""}\n[Kế toán từ chối]: ${note}`.trim() : closing.note,
          },
        }),
      ]);

      broadcastChange("payment_transactions", "UPDATE");

      return NextResponse.json({
        success: true,
        message: `Đã từ chối biên bản bàn giao ${closing.code}. Các phiếu thu đã được hoàn về cho Thu ngân kiểm đếm lại.`,
      });
    }
  } catch (error) {
    console.error("Lỗi khi duyệt biên bản chốt ca:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi duyệt biên bản chốt ca", details: String(error) },
      { status: 500 }
    );
  }
}
