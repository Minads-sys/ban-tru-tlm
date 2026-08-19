// API Route: Quản lý học sinh bán trú (Đăng ký mới / Hủy / Mở lại)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";

// GET: Lấy danh sách học sinh
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const status = searchParams.get("status") as BoardingStatus | null;
  const studentId = searchParams.get("studentId") || searchParams.get("id");

  const where: Record<string, unknown> = {};
  if (studentId) where.id = studentId;
  if (classId) where.classId = classId;
  if (status) where.boardingStatus = status;

  const students = await prisma.student.findMany({
    where,
    include: {
      user: {
        select: { fullName: true, username: true, isActive: true },
      },
      class: { select: { name: true } },
    },
    orderBy: [{ classId: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(students);
}

// POST: Thao tác trên học sinh bán trú
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, studentId } = body;

    if (!studentId || !action) {
      return NextResponse.json(
        { error: "Thiếu studentId hoặc action" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Không tìm thấy học sinh" },
        { status: 404 }
      );
    }

    // ==================== ĐĂNG KÝ MỚI / MỞ LẠI BÁN TRÚ ====================
    if (action === "activate") {
      await prisma.student.update({
        where: { id: studentId },
        data: {
          boardingStatus: BoardingStatus.ACTIVE,
          boardingRegisteredAt: new Date(),
          boardingCancelledAt: null,
        },
      });

      // Mở lại tài khoản user
      await prisma.user.update({
        where: { id: student.userId },
        data: { isActive: true },
      });

      return NextResponse.json({
        message: `Đã kích hoạt ăn bán trú cho HS ${student.id}`,
      });
    }

    // ==================== HỦY BÁN TRÚ & QUYẾT TOÁN ====================
    if (action === "cancel") {
      const { note } = body;

      // Tính quyết toán
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Lấy hóa đơn tháng hiện tại
      const currentBill = await prisma.monthlyBill.findUnique({
        where: {
          studentId_month_year: {
            studentId,
            month: currentMonth,
            year: currentYear,
          },
        },
        include: { transactions: true },
      });

      // Tính số ngày đã ăn thực tế trong tháng
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const approvedCancellationsThisMonth = await prisma.mealCancellation.count({
        where: {
          studentId,
          cancelDate: {
            gte: startOfMonth,
            lte: now,
          },
          status: CancellationStatus.APPROVED,
        },
      });

      // Lấy đơn giá
      const priceSetting = await prisma.systemSetting.findUnique({
        where: { key: "MEAL_UNIT_PRICE" },
      });
      const unitPrice = parseInt(priceSetting?.value || "30000");

      // Tính số ngày ăn dự kiến từ đầu tháng đến hiện tại (workdays only - tạm tính)
      let workdays = 0;
      const tempDate = new Date(startOfMonth);
      while (tempDate <= now) {
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) workdays++; // Bỏ T7, CN
        tempDate.setDate(tempDate.getDate() + 1);
      }

      const actualMealDays = workdays - approvedCancellationsThisMonth;
      const actualUsedAmount = actualMealDays * unitPrice;
      const totalPaid = currentBill
        ? currentBill.transactions.reduce((sum, t) => sum + Number(t.amount), 0)
        : 0;
      const refundOrDebt = totalPaid - actualUsedAmount;

      // Tạo phiếu quyết toán
      const settlementType =
        refundOrDebt > 0 ? "REFUND" : refundOrDebt < 0 ? "ADDITIONAL_PAYMENT" : "BALANCED";

      await prisma.settlementRecord.create({
        data: {
          studentId,
          totalPaid: totalPaid,
          actualUsedAmount: actualUsedAmount,
          refundOrDebt: Math.abs(refundOrDebt),
          settlementType,
          note: note || "Hủy đăng ký ăn bán trú",
          createdBy: body.adminId || "system",
        },
      });

      // Hủy bán trú
      await prisma.student.update({
        where: { id: studentId },
        data: {
          boardingStatus: BoardingStatus.CANCELLED,
          boardingCancelledAt: new Date(),
        },
      });

      // Khóa tài khoản
      await prisma.user.update({
        where: { id: student.userId },
        data: { isActive: false },
      });

      // Cập nhật hóa đơn hiện tại
      if (currentBill) {
        await prisma.monthlyBill.update({
          where: { id: currentBill.id },
          data: { paymentStatus: "SETTLED" },
        });
      }

      return NextResponse.json({
        message: `Đã hủy bán trú cho HS ${student.id}`,
        settlement: {
          totalPaid,
          actualUsedAmount,
          refundOrDebt: Math.abs(refundOrDebt),
          type: settlementType,
        },
      });
    }

    return NextResponse.json(
      { error: "Action không hợp lệ. Sử dụng: activate, cancel" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Student boarding error:", error);
    return NextResponse.json(
      { error: "Lỗi khi xử lý", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật thông tin học sinh
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, newStudentId, fullName, classId, mealType, parentPhone } = body;

    if (!studentId) {
      return NextResponse.json({ error: "Thiếu studentId" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }

    const trimmedNewId = newStudentId?.trim().toUpperCase();
    
    // Kiểm tra trùng mã học sinh mới
    if (trimmedNewId && trimmedNewId !== studentId) {
      const existing = await prisma.student.findUnique({
        where: { id: trimmedNewId },
      });
      if (existing) {
        return NextResponse.json({ error: "Mã học sinh mới đã tồn tại trên hệ thống" }, { status: 400 });
      }
    }

    // Cập nhật User (fullName, và username nếu username cũ trùng với studentId cũ)
    const userUpdateData: any = {};
    if (fullName && fullName.trim() !== "") {
      userUpdateData.fullName = fullName;
    }
    if (trimmedNewId && trimmedNewId !== studentId && student.user.username === studentId.toLowerCase()) {
      userUpdateData.username = trimmedNewId.toLowerCase();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: student.userId },
        data: userUpdateData,
      });
    }

    // Cập nhật Student (Prisma sẽ tự động cascade khóa chính)
    await prisma.student.update({
      where: { id: studentId },
      data: {
        id: trimmedNewId && trimmedNewId !== studentId ? trimmedNewId : undefined,
        classId: classId || student.classId,
        mealType: mealType || student.mealType,
        parentPhone: parentPhone !== undefined ? parentPhone : student.parentPhone,
      },
    });

    return NextResponse.json({ message: "Cập nhật thông tin thành công" });
  } catch (error) {
    console.error("Update student error:", error);
    return NextResponse.json({ error: "Lỗi khi cập nhật học sinh", details: String(error) }, { status: 500 });
  }
}

// DELETE: Xóa học sinh
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "Thiếu studentId" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Vì không có OnDelete Cascade, chúng ta thử xóa cứng học sinh và user liên kết.
      // Cần cẩn thận nếu học sinh có dữ liệu ở MonthlyBill hay MealCancellation
      // Việc này sẽ bắn ra exception nếu có constraint.
      await tx.student.delete({ where: { id: studentId } });
      await tx.user.delete({ where: { id: student.userId } });
    });

    return NextResponse.json({ message: "Xóa học sinh thành công" });
  } catch (error) {
    console.error("Delete student error:", error);
    return NextResponse.json({ 
      error: "Không thể xóa học sinh này vì có dữ liệu liên quan (hóa đơn, lịch sử điểm danh...). Hãy thử thay đổi trạng thái thay vì xóa.", 
      details: String(error) 
    }, { status: 500 });
  }
}

