// API Route: Quản lý học sinh bán trú (Đăng ký mới / Hủy / Mở lại)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { broadcastChange } from "@/lib/realtime-hub";
import { removeVietnameseTones } from "@/lib/utils";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

// GET: Lấy danh sách học sinh
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const status = searchParams.get("status") as BoardingStatus | null;
  const studentId = searchParams.get("studentId") || searchParams.get("id");
  const search = searchParams.get("search")?.trim();
  const limit = searchParams.get("limit");

  const where: Record<string, unknown> = {};
  if (studentId) where.id = studentId;
  if (classId) where.classId = classId;
  if (status) where.boardingStatus = status;

  // Nếu không có tìm kiếm -> Lấy danh sách thông thường theo filter
  if (!search) {
    const students = await prisma.student.findMany({
      where,
      take: limit ? parseInt(limit, 10) : undefined,
      include: {
        user: {
          select: { fullName: true, username: true, isActive: true },
        },
        class: { select: { name: true } },
        settlementRecords: {
          orderBy: { settlementDate: "desc" },
          take: 1,
        },
      },
      orderBy: [{ classId: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(students);
  }

  // Khi có từ khóa tìm kiếm:
  const cleanSearch = search.trim();
  const normalizedSearch = removeVietnameseTones(cleanSearch);

  // 1. Tìm kiếm trực tiếp trong Database với Prisma (khớp CCCD, Mã BT, SĐT, Tên có dấu, Lớp)
  const dbMatches = await prisma.student.findMany({
    where: {
      ...where,
      OR: [
        { studentCode: { contains: cleanSearch, mode: "insensitive" } },
        { boardingCode: { contains: cleanSearch, mode: "insensitive" } },
        { parentPhone: { contains: cleanSearch, mode: "insensitive" } },
        {
          user: {
            fullName: { contains: cleanSearch, mode: "insensitive" },
          },
        },
        {
          user: {
            username: { contains: cleanSearch, mode: "insensitive" },
          },
        },
        {
          class: {
            name: { contains: cleanSearch, mode: "insensitive" },
          },
        },
      ],
    },
    take: limit ? parseInt(limit, 10) : 20,
    include: {
      user: {
        select: { fullName: true, username: true, isActive: true },
      },
      class: { select: { name: true } },
      settlementRecords: {
        orderBy: { settlementDate: "desc" },
        take: 1,
      },
    },
    orderBy: [{ classId: "asc" }, { id: "asc" }],
  });

  // Nếu tìm thấy kết quả từ Database, trả về ngay
  if (dbMatches.length > 0) {
    return NextResponse.json(dbMatches);
  }

  // 2. Nếu người dùng gõ tiếng Việt không dấu (VD: "bao", "dat", "quoc bao"), tìm kiếm bổ sung bằng thuật toán bỏ dấu
  if (normalizedSearch) {
    const allCandidates = await prisma.student.findMany({
      where,
      take: 300,
      include: {
        user: {
          select: { fullName: true, username: true, isActive: true },
        },
        class: { select: { name: true } },
        settlementRecords: {
          orderBy: { settlementDate: "desc" },
          take: 1,
        },
      },
      orderBy: [{ classId: "asc" }, { id: "asc" }],
    });

    const accentFiltered = allCandidates.filter((s) => {
      const normName = removeVietnameseTones(s.user?.fullName || "");
      const normUsername = removeVietnameseTones(s.user?.username || "");
      const normClass = removeVietnameseTones(s.class?.name || s.classId || "");
      const code = (s.studentCode || "").toLowerCase();
      const bCode = (s.boardingCode || "").toLowerCase();

      return (
        normName.includes(normalizedSearch) ||
        normUsername.includes(normalizedSearch) ||
        normClass.includes(normalizedSearch) ||
        code.includes(cleanSearch.toLowerCase()) ||
        bCode.includes(cleanSearch.toLowerCase())
      );
    });

    const takeCount = limit ? parseInt(limit, 10) : 10;
    return NextResponse.json(accentFiltered.slice(0, takeCount));
  }

  return NextResponse.json([]);
}

// POST: Thao tác trên học sinh bán trú
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return NextResponse.json({ error: "Tài khoản Kế toán chỉ có quyền xem và xuất Excel danh sách học sinh" }, { status: 403 });
    }
    const body = await request.json();
    const { action, studentId } = body;
    const adminId = body.adminId || session?.user?.id;

    if (!action) {
      return NextResponse.json({ error: "Thiếu action" }, { status: 400 });
    }

    if (action === "create") {
      const { studentCode, boardingCode, fullName, classId, mealType, parentPhone, gender, birthDate, mealStartDate, generateBill } = body;
      
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

      // Parse mealStartDate (Ngày thực tế bắt đầu ăn bán trú)
      let parsedMealStartDate: Date | null = null;
      if (mealStartDate) {
        const [msY, msM, msD] = String(mealStartDate).split("-").map(Number);
        if (!isNaN(msY) && !isNaN(msM) && !isNaN(msD)) {
          parsedMealStartDate = new Date(Date.UTC(msY, msM - 1, msD));
        }
      }
      if (!parsedMealStartDate) {
        const now = new Date();
        parsedMealStartDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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
          mealStartDate: parsedMealStartDate,
          parentPhone: parentPhone || null,
          birthDate: parsedBirthDate
        }
      });

      // Generate Bill if requested (Căn cứ nghiêm ngặt vào Thời khóa biểu tuần của lớp từ ngày bắt đầu ăn)
      let billCreated = false;
      let billWarningMessage = "";
      let scheduledDays = 0;

      if (generateBill) {
        const targetStartDate = parsedMealStartDate;
        const month = targetStartDate.getUTCMonth() + 1;
        const year = targetStartDate.getUTCFullYear();

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

        // Tìm tất cả các tuần từ ngày bắt đầu ăn đến hết tháng
        const endOfMonth = new Date(Date.UTC(year, month, 0));
        const requiredWeekNumbers = new Set<number>();
        const tempCheckDate = new Date(Date.UTC(year, month - 1, targetStartDate.getUTCDate()));

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
          // Đầy đủ TKB 100%: Quét từng ngày từ ngày bắt đầu ăn đến hết tháng đối chiếu theo TKB
          const tempDate = new Date(Date.UTC(year, month - 1, targetStartDate.getUTCDate()));
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

      const formattedStartDate = `${String(parsedMealStartDate.getUTCDate()).padStart(2, '0')}/${String(parsedMealStartDate.getUTCMonth() + 1).padStart(2, '0')}/${parsedMealStartDate.getUTCFullYear()}`;
      let responseMsg = `Đăng ký học sinh thành công (Bắt đầu ăn từ ngày ${formattedStartDate})`;
      if (generateBill) {
        if (billCreated) {
          const month = parsedMealStartDate.getUTCMonth() + 1;
          const year = parsedMealStartDate.getUTCFullYear();
          responseMsg = `Đăng ký học sinh thành công và đã tạo hóa đơn tháng ${month}/${year} (${scheduledDays} ngày ăn tính từ ngày ${formattedStartDate} theo TKB).`;
        } else if (billWarningMessage) {
          responseMsg = `Đăng ký học sinh thành công! ⚠️ ${billWarningMessage}`;
        }
      }

      await logAudit({
        req: request,
        userId: adminId,
        userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
        userRole: session?.user?.role,
        action: AUDIT_ACTIONS.CREATE,
        module: AUDIT_MODULES.STUDENTS,
        description: `Tạo mới học sinh ${fullName} (${studentCode}, Lớp ${classId})`,
        targetId: newStudent.id,
        metadata: { studentCode, boardingCode, fullName, classId, mealType },
      });

      return NextResponse.json({
        success: true,
        message: responseMsg,
        billCreated,
        billWarning: billWarningMessage || null,
        student: newStudent,
      });
    }

interface SettlementCalculationParams {
  studentId: string;
  classId: string;
  stopDateStr: string;
  includeStopDate?: boolean;
  actualMealDaysOverride?: number | null;
}

async function calculateStudentSettlement({
  studentId,
  classId,
  stopDateStr,
  includeStopDate = false,
  actualMealDaysOverride,
}: SettlementCalculationParams) {
  let targetYear: number;
  let targetMonth: number;
  let stopDay: number;

  if (stopDateStr && /^\d{4}-\d{2}-\d{2}$/.test(stopDateStr)) {
    const [y, m, d] = stopDateStr.split("-").map(Number);
    targetYear = y;
    targetMonth = m;
    stopDay = d;
  } else {
    const now = new Date();
    targetYear = now.getFullYear();
    targetMonth = now.getMonth() + 1;
    stopDay = now.getDate();
  }

  const currentBill = await prisma.monthlyBill.findUnique({
    where: {
      studentId_month_year: {
        studentId,
        month: targetMonth,
        year: targetYear,
      },
    },
    include: {
      transactions: {
        where: { isVoided: false },
      },
    },
  });

  let unitPrice = 40000;
  if (currentBill && Number(currentBill.unitPrice) > 0) {
    unitPrice = Number(currentBill.unitPrice);
  } else {
    const priceSetting = await prisma.systemSetting.findUnique({
      where: { key: "MEAL_UNIT_PRICE" },
    });
    if (priceSetting?.value) {
      unitPrice = parseInt(priceSetting.value, 10) || 40000;
    }
  }

  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  let effectiveStartDate = startOfMonth;

  const schoolYearStartSetting = await prisma.systemSetting.findUnique({
    where: { key: "SCHOOL_YEAR_START" },
  });
  if (schoolYearStartSetting?.value) {
    const [syY, syM, syD] = schoolYearStartSetting.value.split("-").map(Number);
    if (!isNaN(syY) && !isNaN(syM) && !isNaN(syD)) {
      const syDate = new Date(Date.UTC(syY, syM - 1, syD));
      if (syDate > effectiveStartDate) {
        effectiveStartDate = syDate;
      }
    }
  }

  // Căn cứ ngày học sinh thực tế bắt đầu ăn bán trú
  const studentInfo = await prisma.student.findUnique({
    where: { id: studentId },
    select: { mealStartDate: true },
  });
  if (studentInfo?.mealStartDate) {
    const studentMealStart = new Date(studentInfo.mealStartDate);
    if (studentMealStart > effectiveStartDate) {
      effectiveStartDate = studentMealStart;
    }
  }

  const endDay = includeStopDate ? stopDay : stopDay - 1;
  const effectiveEndDate = new Date(Date.UTC(targetYear, targetMonth - 1, endDay));

  let calculatedDays = 0;
  if (effectiveStartDate <= effectiveEndDate) {
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        classId,
        year: targetYear,
      },
    });

    const dayFieldMap: Record<number, "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };

    const getWeekNum = (d: Date, y: number): number => {
      const startOfYear = new Date(Date.UTC(y, 0, 1));
      return Math.ceil(
        ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
      );
    };

    const approvedCancellations = await prisma.mealCancellation.findMany({
      where: {
        studentId,
        cancelDate: {
          gte: effectiveStartDate,
          lte: effectiveEndDate,
        },
        status: CancellationStatus.APPROVED,
      },
    });

    const cancelledDateSet = new Set(
      approvedCancellations.map((c) => c.cancelDate.toISOString().slice(0, 10))
    );

    const hasSchedules = schedules.length > 0;
    const cur = new Date(effectiveStartDate);

    while (cur <= effectiveEndDate) {
      const dayOfWeek = cur.getUTCDay(); // 0 = CN, 1 = T2..6 = T7
      const dateStr = cur.toISOString().slice(0, 10);

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        let isMealDay = false;
        if (hasSchedules) {
          const dayField = dayFieldMap[dayOfWeek];
          if (dayField) {
            const weekNum = getWeekNum(cur, targetYear);
            const sched = schedules.find((s) => s.weekNumber === weekNum);
            if (sched && sched[dayField] && sched[dayField] !== "NONE") {
              isMealDay = true;
            }
          }
        } else {
          isMealDay = false;
        }

        if (isMealDay && !cancelledDateSet.has(dateStr)) {
          calculatedDays++;
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else {
    calculatedDays = 0;
  }

  let actualMealDays = calculatedDays;
  if (
    actualMealDaysOverride !== undefined &&
    actualMealDaysOverride !== null &&
    !isNaN(Number(actualMealDaysOverride))
  ) {
    actualMealDays = Math.max(0, Math.floor(Number(actualMealDaysOverride)));
  }

  const actualUsedAmount = actualMealDays * unitPrice;
  const totalPaid = currentBill
    ? currentBill.transactions.reduce((sum, t) => sum + Number(t.amount), 0)
    : 0;
  const refundOrDebt = totalPaid - actualUsedAmount;

  const settlementType: "REFUND" | "ADDITIONAL_PAYMENT" | "BALANCED" =
    refundOrDebt > 0 ? "REFUND" : refundOrDebt < 0 ? "ADDITIONAL_PAYMENT" : "BALANCED";

  const stopDateFormatted = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(stopDay).padStart(2, "0")}`;

  return {
    currentBill,
    unitPrice,
    calculatedDays,
    actualMealDays,
    actualUsedAmount,
    totalPaid,
    refundOrDebt: Math.abs(refundOrDebt),
    settlementType,
    rawBalance: refundOrDebt,
    stopDate: stopDateFormatted,
    includeStopDate,
    targetMonth,
    targetYear,
  };
}

    if (!studentId) {
      return NextResponse.json(
        { error: "Thiếu studentId" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, class: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Không tìm thấy học sinh" },
        { status: 404 }
      );
    }

    // ==================== XEM TRƯỚC QUYẾT TOÁN KHI HỦY BÁN TRÚ ====================
    if (action === "settlement-preview") {
      const { stopDate, includeStopDate, actualMealDays } = body;
      const calculation = await calculateStudentSettlement({
        studentId,
        classId: student.classId,
        stopDateStr: stopDate,
        includeStopDate: Boolean(includeStopDate),
        actualMealDaysOverride:
          actualMealDays !== undefined && actualMealDays !== null
            ? Number(actualMealDays)
            : null,
      });

      return NextResponse.json({
        success: true,
        data: {
          studentId: student.id,
          studentName: student.user?.fullName || student.studentCode,
          className: student.class?.name || student.classId,
          stopDate: calculation.stopDate,
          includeStopDate: calculation.includeStopDate,
          calculatedDays: calculation.calculatedDays,
          actualMealDays: calculation.actualMealDays,
          unitPrice: calculation.unitPrice,
          totalPaid: calculation.totalPaid,
          actualUsedAmount: calculation.actualUsedAmount,
          refundOrDebt: calculation.refundOrDebt,
          settlementType: calculation.settlementType,
          rawBalance: calculation.rawBalance,
          hasBill: Boolean(calculation.currentBill),
          billFinalAmount: calculation.currentBill ? Number(calculation.currentBill.finalAmount) : 0,
          billPaymentStatus: calculation.currentBill?.paymentStatus || null,
        },
      });
    }

    // ==================== ĐĂNG KÝ MỚI / MỞ LẠI BÁN TRÚ ====================
    if (action === "activate") {
      const { mealStartDate } = body;
      let parsedMealStartDate: Date | null = null;
      if (mealStartDate) {
        const [msY, msM, msD] = String(mealStartDate).split("-").map(Number);
        if (!isNaN(msY) && !isNaN(msM) && !isNaN(msD)) {
          parsedMealStartDate = new Date(Date.UTC(msY, msM - 1, msD));
        }
      }
      if (!parsedMealStartDate) {
        const today = new Date();
        parsedMealStartDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      }

      await prisma.student.update({
        where: { id: studentId },
        data: {
          boardingStatus: BoardingStatus.ACTIVE,
          boardingRegisteredAt: new Date(),
          mealStartDate: parsedMealStartDate,
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

      await logAudit({
        req: request,
        userId: adminId,
        userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
        userRole: session?.user?.role,
        action: AUDIT_ACTIONS.UPDATE,
        module: AUDIT_MODULES.STUDENTS,
        description: `Kích hoạt ăn bán trú cho học sinh ${student.user?.fullName || student.studentCode} (${student.id})`,
        targetId: studentId,
      });

      return NextResponse.json({
        message: `Đã kích hoạt ăn bán trú cho HS ${student.id}`,
      });
    }

    // ==================== HỦY BÁN TRÚ & QUYẾT TOÁN ====================
    if (action === "cancel") {
      const { note, stopDate, includeStopDate, actualMealDays } = body;

      const calculation = await calculateStudentSettlement({
        studentId,
        classId: student.classId,
        stopDateStr: stopDate,
        includeStopDate: Boolean(includeStopDate),
        actualMealDaysOverride:
          actualMealDays !== undefined && actualMealDays !== null
            ? Number(actualMealDays)
            : null,
      });

      // Tạo phiếu quyết toán
      await prisma.settlementRecord.create({
        data: {
          studentId,
          totalPaid: calculation.totalPaid,
          actualUsedAmount: calculation.actualUsedAmount,
          refundOrDebt: calculation.refundOrDebt,
          settlementType: calculation.settlementType,
          note: note || `Hủy đăng ký ăn bán trú từ ngày ${calculation.stopDate}`,
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
      if (calculation.currentBill) {
        if (calculation.actualMealDays === 0) {
          // Chưa ăn bữa nào: xóa sạch công nợ về 0 để không còn lưu nợ
          await prisma.monthlyBill.update({
            where: { id: calculation.currentBill.id },
            data: {
              scheduleMealDays: 0,
              netPayableDays: 0,
              totalAmount: 0,
              finalAmount: 0,
              paymentStatus: "SETTLED",
            },
          });
        } else {
          // Đã ăn một số ngày: hóa đơn chỉ tính tiền đúng theo số ngày đã ăn thực tế
          const isFullyPaid = calculation.totalPaid >= calculation.actualUsedAmount;
          const newPaymentStatus = isFullyPaid
            ? "SETTLED"
            : calculation.totalPaid > 0
            ? "PARTIAL"
            : "UNPAID";

          await prisma.monthlyBill.update({
            where: { id: calculation.currentBill.id },
            data: {
              scheduleMealDays: calculation.actualMealDays,
              netPayableDays: calculation.actualMealDays,
              totalAmount: calculation.actualUsedAmount,
              finalAmount: calculation.actualUsedAmount,
              paymentStatus: newPaymentStatus,
            },
          });
        }
      }

      broadcastChange('students', 'UPDATE', { id: studentId, status: BoardingStatus.CANCELLED });
      broadcastChange('daily_meals', 'UPDATE');
      broadcastChange('monthly_bills', 'UPDATE');

      await logAudit({
        req: request,
        userId: adminId,
        userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
        userRole: session?.user?.role,
        action: AUDIT_ACTIONS.UPDATE,
        module: AUDIT_MODULES.STUDENTS,
        description: `Hủy ăn bán trú và quyết toán cho học sinh ${student.user?.fullName || student.studentCode} (${student.id}). Ngày ngừng: ${calculation.stopDate}, số ngày ăn: ${calculation.actualMealDays}, Quyết toán: ${calculation.settlementType}`,
        targetId: studentId,
        metadata: {
          stopDate: calculation.stopDate,
          includeStopDate: calculation.includeStopDate,
          actualMealDays: calculation.actualMealDays,
          unitPrice: calculation.unitPrice,
          totalPaid: calculation.totalPaid,
          actualUsedAmount: calculation.actualUsedAmount,
          refundOrDebt: calculation.refundOrDebt,
          settlementType: calculation.settlementType,
          note,
        },
      });

      return NextResponse.json({
        message: `Đã hủy bán trú cho học sinh ${student.user?.fullName || student.studentCode}`,
        settlement: {
          totalPaid: calculation.totalPaid,
          actualUsedAmount: calculation.actualUsedAmount,
          refundOrDebt: calculation.refundOrDebt,
          type: calculation.settlementType,
          actualMealDays: calculation.actualMealDays,
          stopDate: calculation.stopDate,
          includeStopDate: calculation.includeStopDate,
        },
      });
    }

    return NextResponse.json(
      { error: "Action không hợp lệ. Sử dụng: activate, cancel, settlement-preview" },
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
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return NextResponse.json({ error: "Tài khoản Kế toán chỉ có quyền xem và xuất Excel danh sách học sinh" }, { status: 403 });
    }
    const body = await request.json();
    const { studentId, studentCode, boardingCode, fullName, classId, mealType, parentPhone, mealStartDate, birthDate, gender } = body;

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

    // Parse mealStartDate nếu có gửi lên
    let parsedMealStartDate: Date | null | undefined = undefined;
    if (mealStartDate !== undefined) {
      if (mealStartDate) {
        const [msY, msM, msD] = String(mealStartDate).split("-").map(Number);
        if (!isNaN(msY) && !isNaN(msM) && !isNaN(msD)) {
          parsedMealStartDate = new Date(Date.UTC(msY, msM - 1, msD));
        }
      } else {
        parsedMealStartDate = null;
      }
    }

    // Parse birthDate nếu có gửi lên
    let parsedBirthDate: Date | null | undefined = undefined;
    if (birthDate !== undefined) {
      if (birthDate) {
        const [bY, bM, bD] = String(birthDate).split("-").map(Number);
        if (!isNaN(bY) && !isNaN(bM) && !isNaN(bD)) {
          parsedBirthDate = new Date(Date.UTC(bY, bM - 1, bD));
        } else {
          parsedBirthDate = new Date(birthDate);
        }
      } else {
        parsedBirthDate = null;
      }
    }

    // Parse gender nếu có gửi lên
    let parsedGender: "MALE" | "FEMALE" | undefined = undefined;
    if (gender !== undefined) {
      parsedGender = (gender === "NU" || gender === "FEMALE") ? "FEMALE" : "MALE";
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
        ...(parsedMealStartDate !== undefined ? { mealStartDate: parsedMealStartDate } : {}),
        ...(parsedBirthDate !== undefined ? { birthDate: parsedBirthDate } : {}),
        ...(parsedGender !== undefined ? { gender: parsedGender } : {}),
      },
    });

    broadcastChange('students', 'UPDATE');
    broadcastChange('daily_meals', 'UPDATE');

    await logAudit({
      req: request,
      userId: session?.user?.id,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.STUDENTS,
      description: `Cập nhật thông tin học sinh ${fullName || student.user.fullName} (${student.studentCode})`,
      targetId: studentId,
      metadata: { studentCode: trimmedNewCode, boardingCode: trimmedBoardingCode, classId: updateClassId, mealType, birthDate, gender },
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
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return NextResponse.json({ error: "Tài khoản Kế toán không có quyền xóa học sinh" }, { status: 403 });
    }
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

    await logAudit({
      req: request,
      userId: session?.user?.id,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.DELETE,
      module: AUDIT_MODULES.STUDENTS,
      description: `Xóa học sinh ${student.studentCode} (ID: ${studentId})`,
      targetId: studentId,
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

