// API Route: Quản lý học sinh bán trú (Đăng ký mới / Hủy / Mở lại)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { broadcastChange } from "@/lib/realtime-hub";

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

      // Tìm lớp học theo id hoặc name (đảm bảo đúng Foreign Key)
      const classObj = await prisma.class.findFirst({
        where: {
          OR: [
            { id: classId },
            { name: classId },
          ],
        },
      });
      if (!classObj) {
        return NextResponse.json({ error: `Không tìm thấy lớp học: ${classId}` }, { status: 400 });
      }
      const finalClassId = classObj.id;

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
          classId: finalClassId,
          gender: gender === "NU" ? "FEMALE" : "MALE",
          mealType: mealType || "MAN",
          boardingStatus: "ACTIVE",
          boardingRegisteredAt: new Date(),
          parentPhone: parentPhone || null,
          birthDate: parsedBirthDate
        }
      });

      // Generate Bill if requested (Căn cứ nghiêm ngặt vào Thời khóa biểu tuần của lớp)
      let billCreated = false;
      let billWarningMessage = "";
      let scheduledDays = 0;

      if (generateBill) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const dayFieldMap: Record<number, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> = {
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday',
        };

        const startOfYear = new Date(Date.UTC(year, 0, 1));
        const getWeekNumber = (d: Date) => {
          return Math.ceil(
            ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
          );
        };

        // Tìm tất cả các tuần từ hôm nay đến hết tháng
        const endOfMonth = new Date(Date.UTC(year, month, 0));
        const requiredWeekNumbers = new Set<number>();
        const tempCheckDate = new Date(Date.UTC(year, month - 1, now.getDate()));

        while (tempCheckDate <= endOfMonth) {
          const dayOfWeek = tempCheckDate.getUTCDay();
          if (dayOfWeek !== 0) { // Bỏ qua Chủ nhật
            requiredWeekNumbers.add(getWeekNumber(tempCheckDate));
          }
          tempCheckDate.setUTCDate(tempCheckDate.getUTCDate() + 1);
        }

        const requiredWeeksList = Array.from(requiredWeekNumbers).sort((a, b) => a - b);

        // Lấy TKB tuần của lớp trong các tuần này
        const schedules = await prisma.classWeeklySchedule.findMany({
          where: {
            classId: finalClassId,
            year,
            weekNumber: { in: requiredWeeksList },
          },
        });

        const scheduleMap = new Map<number, (typeof schedules)[0]>();
        schedules.forEach((s) => scheduleMap.set(s.weekNumber, s));

        // Kiểm tra xem có tuần nào trong tháng chưa có TKB không
        const missingWeeks = requiredWeeksList.filter((w) => !scheduleMap.has(w));

        if (missingWeeks.length > 0) {
          // QUY TẮC BẮT BUỘC: Nếu bất kỳ tuần nào chưa có lịch học thì cảnh báo và chỉ ghi nhận đăng ký ăn, KHÔNG tạo hóa đơn
          billWarningMessage = `Chưa tạo hóa đơn tháng ${month}/${year} do Lớp ${classObj.name} chưa có Thời khóa biểu các tuần: ${missingWeeks.map(w => `Tuần ${w}`).join(', ')}. Vui lòng tạo TKB lớp trước khi tạo hóa đơn!`;
        } else {
          // Đầy đủ TKB 100%: Quét từng ngày còn lại trong tháng đối chiếu theo TKB
          const tempDate = new Date(Date.UTC(year, month - 1, now.getDate()));
          while (tempDate <= endOfMonth) {
            const dayOfWeek = tempDate.getUTCDay();
            if (dayOfWeek !== 0) {
              const dayField = dayFieldMap[dayOfWeek];
              const weekNum = getWeekNumber(tempDate);
              const weekSchedule = scheduleMap.get(weekNum);
              if (weekSchedule && weekSchedule[dayField] && weekSchedule[dayField] !== 'NONE') {
                scheduledDays++;
              }
            }
            tempDate.setUTCDate(tempDate.getUTCDate() + 1);
          }

          const priceSetting = await prisma.systemSetting.findUnique({ where: { key: "MEAL_UNIT_PRICE" } });
          const unitPrice = parseInt(priceSetting?.value || "30000");
          const finalAmount = scheduledDays * unitPrice;

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
                scheduleMealDays: scheduledDays,
                canceledDays: 0,
                netPayableDays: scheduledDays,
                unitPrice,
                totalAmount: finalAmount,
                previousDeduction: 0,
                finalAmount,
                paymentStatus: "UNPAID",
                qrCodeUrl
              }
            });

            billCreated = true;
            broadcastChange('monthly_bills', 'INSERT');
          }
        }
      }

      broadcastChange('students', 'INSERT', newStudent);
      broadcastChange('daily_meals', 'UPDATE');

      let responseMsg = "Đăng ký học sinh thành công";
      if (generateBill) {
        if (billCreated) {
          responseMsg = `Đăng ký học sinh thành công và đã tạo hóa đơn tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()} (${scheduledDays} ngày ăn theo TKB).`;
        } else if (billWarningMessage) {
          responseMsg = `Đăng ký học sinh thành công! ⚠️ ${billWarningMessage}`;
        }
      }

      return NextResponse.json({
        success: true,
        message: responseMsg,
        billCreated,
        billWarning: billWarningMessage || null,
        student: newStudent,
      });
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

      broadcastChange('students', 'UPDATE', { id: studentId, status: BoardingStatus.ACTIVE });
      broadcastChange('daily_meals', 'UPDATE');

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

      broadcastChange('students', 'UPDATE', { id: studentId, status: BoardingStatus.CANCELLED });
      broadcastChange('daily_meals', 'UPDATE');
      broadcastChange('monthly_bills', 'UPDATE');

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
    let updateClassId = student.classId;
    if (classId) {
      const classObj = await prisma.class.findFirst({
        where: {
          OR: [{ id: classId }, { name: classId }],
        },
      });
      if (classObj) updateClassId = classObj.id;
    }

    await prisma.student.update({
      where: { id: studentId },
      data: {
        studentCode: trimmedNewCode || student.studentCode,
        boardingCode: trimmedBoardingCode || student.boardingCode,
        classId: updateClassId,
        mealType: mealType || student.mealType,
        parentPhone: parentPhone !== undefined ? parentPhone : student.parentPhone,
      },
    });

    broadcastChange('students', 'UPDATE');
    broadcastChange('daily_meals', 'UPDATE');

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

    broadcastChange('students', 'DELETE', { studentId });
    broadcastChange('daily_meals', 'UPDATE');

    return NextResponse.json({ message: "Xóa học sinh thành công" });
  } catch (error) {
    console.error("Delete student error:", error);
    return NextResponse.json({ 
      error: "Không thể xóa học sinh này vì có dữ liệu liên quan (hóa đơn, lịch sử điểm danh...). Hãy thử thay đổi trạng thái thay vì xóa.", 
      details: String(error) 
    }, { status: 500 });
  }
}

