// API Route: Quản lý học sinh bán trú (Đăng ký mới / Hủy / Mở lại)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

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
    const session = await auth();
    const body = await request.json();
    const { action, studentId } = body;
    const adminId = body.adminId || session?.user?.id;

    if (!action) {
      return NextResponse.json({ error: "Thiếu action" }, { status: 400 });
    }

    if (action === "create") {
      const { studentCode, boardingCode, fullName, classId, mealType, parentPhone, gender, birthDate, generateBill } = body;
      
      if (!studentCode || !fullName || !classId) {
        return NextResponse.json({ error: "Thiếu các thông tin bắt buộc" }, { status: 400 });
      }

      // Check existing studentCode
      const existing = await prisma.student.findUnique({
        where: { studentCode },
      });
      if (existing) {
        return NextResponse.json({ error: "Số CCCD đã tồn tại trên hệ thống" }, { status: 400 });
      }

      // Auto generate boardingCode if empty
      let finalBoardingCode = boardingCode?.trim();
      if (!finalBoardingCode) {
        const lastStudent = await prisma.student.findFirst({
          where: { boardingCode: { not: null } },
          orderBy: { boardingCode: 'desc' }
        });
        
        let nextNumber = 1;
        if (lastStudent && lastStudent.boardingCode && lastStudent.boardingCode.startsWith('BT')) {
          const lastNum = parseInt(lastStudent.boardingCode.replace('BT', ''), 10);
          if (!isNaN(lastNum)) {
            nextNumber = lastNum + 1;
          }
        }
        finalBoardingCode = `BT${String(nextNumber).padStart(5, '0')}`;
      } else {
        const existingBoarding = await prisma.student.findFirst({ where: { boardingCode: finalBoardingCode } });
        if (existingBoarding) {
          return NextResponse.json({ error: "Mã Bán Trú đã tồn tại" }, { status: 400 });
        }
      }

      // Parse birthDate
      let parsedBirthDate = null;
      if (birthDate) {
        parsedBirthDate = new Date(birthDate);
      }

      // Generate password (ddmmyyyy) from birthDate or default "123456"
      const bcrypt = require("bcryptjs");
      let password = "123456";
      if (parsedBirthDate) {
        const dd = String(parsedBirthDate.getDate()).padStart(2, '0');
        const mm = String(parsedBirthDate.getMonth() + 1).padStart(2, '0');
        const yyyy = parsedBirthDate.getFullYear();
        password = `${dd}${mm}${yyyy}`;
      }
      const passwordHash = await bcrypt.hash(password, 10);

      // Create User
      const user = await prisma.user.create({
        data: {
          username: studentCode.toLowerCase(),
          passwordHash,
          fullName: fullName.trim(),
          role: "STUDENT",
          requiresPasswordChange: true,
        }
      });

      // Create Student
      const newStudent = await prisma.student.create({
        data: {
          studentCode: studentCode.trim(),
          boardingCode: finalBoardingCode,
          userId: user.id,
          classId: classId,
          gender: gender === "NU" ? "FEMALE" : "MALE",
          mealType: mealType || "MAN",
          boardingStatus: "ACTIVE",
          boardingRegisteredAt: new Date(),
          parentPhone: parentPhone || null,
          birthDate: parsedBirthDate
        }
      });

      // Generate Bill if requested
      if (generateBill) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Calculate remaining working days in month
        let workdays = 0;
        const endOfMonth = new Date(year, month, 0); // Last day of month
        const tempDate = new Date(now);
        while (tempDate <= endOfMonth) {
          const day = tempDate.getDay();
          if (day !== 0 && day !== 6) workdays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }

        const priceSetting = await prisma.systemSetting.findUnique({ where: { key: "MEAL_UNIT_PRICE" } });
        const unitPrice = parseInt(priceSetting?.value || "30000");
        
        const finalAmount = workdays * unitPrice;

        if (finalAmount > 0) {
          const { generateMealPaymentQR } = require("@/lib/vietqr");
          
          const systemSettings = await prisma.systemSetting.findMany({
            where: { key: { in: ['BANK_NAME', 'BANK_ACCOUNT_NO', 'BANK_ACCOUNT_NAME'] } },
          });
          const customBankInfo = {
            bankName: systemSettings.find(s => s.key === 'BANK_NAME')?.value,
            accountNo: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NO')?.value,
            accountName: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NAME')?.value,
          };

          const qrCodeUrl = generateMealPaymentQR(finalBoardingCode, month, year, finalAmount, customBankInfo);

          await prisma.monthlyBill.create({
            data: {
              studentId: newStudent.id,
              month,
              year,
              scheduleMealDays: workdays,
              canceledDays: 0,
              netPayableDays: workdays,
              unitPrice,
              previousDeduction: 0,
              finalAmount,
              paymentStatus: "UNPAID",
              qrCodeUrl
            }
          });
        }
      }

      return NextResponse.json({ message: "Đăng ký học sinh thành công" });
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "Thiếu studentId" },
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
          createdBy: adminId || student.userId,
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
    const { studentId, studentCode, boardingCode, fullName, classId, mealType, parentPhone } = body;

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

    const trimmedNewCode = studentCode?.trim();
    const trimmedBoardingCode = boardingCode?.trim();
    
    // Kiểm tra trùng CCCD mới
    if (trimmedNewCode && trimmedNewCode !== student.studentCode) {
      const existing = await prisma.student.findUnique({
        where: { studentCode: trimmedNewCode },
      });
      if (existing) {
        return NextResponse.json({ error: "Số CCCD đã tồn tại trên hệ thống" }, { status: 400 });
      }
    }

    // Kiểm tra trùng Mã Bán Trú mới
    if (trimmedBoardingCode && trimmedBoardingCode !== student.boardingCode) {
      const existingBoarding = await prisma.student.findFirst({
        where: { boardingCode: trimmedBoardingCode },
      });
      if (existingBoarding) {
        return NextResponse.json({ error: "Mã Bán Trú đã tồn tại trên hệ thống" }, { status: 400 });
      }
    }

    // Cập nhật User (fullName, và username nếu username cũ trùng với studentCode cũ)
    const userUpdateData: any = {};
    if (fullName && fullName.trim() !== "") {
      userUpdateData.fullName = fullName;
    }
    if (trimmedNewCode && trimmedNewCode !== student.studentCode && student.user.username === student.studentCode.toLowerCase()) {
      userUpdateData.username = trimmedNewCode.toLowerCase();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: student.userId },
        data: userUpdateData,
      });
    }

    // Cập nhật Student
    await prisma.student.update({
      where: { id: studentId },
      data: {
        studentCode: trimmedNewCode || student.studentCode,
        boardingCode: trimmedBoardingCode || student.boardingCode,
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

