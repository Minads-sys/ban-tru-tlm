// API Route: Chốt suất ăn hàng ngày
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CancellationStatus, BoardingStatus } from "@prisma/client";
import { broadcastChange } from "@/lib/realtime-hub";
import { getWeekNumber, getVietnamTodayUTC, isPastCutoffTime } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

// GET: Lấy tổng hợp suất ăn cho 1 ngày
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "Thiếu tham số date" }, { status: 400 });
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=CN, 1=T2, ..., 6=T7

  // Map JS day to schedule field
  const dayFieldMap: Record<number, string> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const dayField = dayFieldMap[dayOfWeek];
  if (!dayField) {
    return NextResponse.json({
      message: "Chủ nhật không có suất ăn bán trú",
      data: [],
    });
  }

  // Tính tuần chuẩn ISO
  const weekNumber = getWeekNumber(date);

  // Lấy tất cả các lớp có lịch ăn ngày này
  const schedules = await prisma.classWeeklySchedule.findMany({
    where: {
      year: y,
      weekNumber,
      [dayField]: { not: "NONE" },
    },
    include: {
      class: {
        include: {
          students: {
            where: {
              boardingStatus: BoardingStatus.ACTIVE,
            },
          },
        },
      },
    },
  });

  // Lấy danh sách cắt suất đã duyệt cho ngày này
  const approvedCancellations = await prisma.mealCancellation.findMany({
    where: {
      cancelDate: date,
      status: CancellationStatus.APPROVED,
    },
    select: {
      studentId: true,
    },
  });
  const cancelledStudentIds = new Set(approvedCancellations.map((c) => c.studentId));

  // Lấy danh sách đổi món (MealOverride) cho ngày này
  const mealOverrides = await prisma.mealOverride.findMany({
    where: { date },
  });
  const overrideMap = new Map(mealOverrides.map(o => [o.studentId, o.mealType]));

  // Lấy cấu hình hệ thống giờ chốt
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["MEAL_LOCK_TIME_2", "CUTOFF_TIME"] } }
  });
  const lockTime2 = settings.find(s => s.key === "MEAL_LOCK_TIME_2")?.value 
                 || settings.find(s => s.key === "CUTOFF_TIME")?.value 
                 || "07:00";

  // Kiểm tra thời gian chốt sổ của ngày ăn:
  // - Ngày quá khứ: đã qua giờ chốt
  // - Hôm nay: so sánh với lockTime2 (MEAL_LOCK_TIME_2)
  // - Ngày tương lai: chưa tới giờ chốt
  const localToday = getVietnamTodayUTC();
  const isPastDate = date < localToday;
  const isToday = date.getTime() === localToday.getTime();
  const isPastLockTime = isToday ? isPastCutoffTime(lockTime2) : isPastDate;

  // Kiểm tra đã chốt chưa và lấy số dự kiến
  let existingSummaries = await prisma.dailyMealSummary.findMany({
    where: { summaryDate: date },
  });
  const lockedClasses = new Set(
    existingSummaries.filter((s) => s.isLocked).map((s) => s.classId)
  );

  // Tự động chốt sổ khi đã qua giờ chốt MEAL_LOCK_TIME_2
  if (isPastLockTime && schedules.length > 0) {
    const unLockedSchedules = schedules.filter(s => !lockedClasses.has(s.classId));
    if (unLockedSchedules.length > 0) {
      const now = new Date();
      for (const schedule of unLockedSchedules) {
        const students = schedule.class.students;
        const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

        let man = 0;
        let chay = 0;
        let chao = 0;

        activeStudents.forEach(s => {
          const finalMealType = overrideMap.get(s.id) || s.mealType;
          if (finalMealType === "MAN") man++;
          else if (finalMealType === "CHAY") chay++;
          else if (finalMealType === "CHAO") chao++;
        });

        await prisma.dailyMealSummary.upsert({
          where: {
            summaryDate_classId: {
              summaryDate: date,
              classId: schedule.classId,
            },
          },
          update: {
            totalScheduleRegistered: students.length,
            totalCanceled: students.length - activeStudents.length,
            finalMan: man,
            finalChay: chay,
            finalChao: chao,
            isLocked: true,
            lockedAt: now,
          },
          create: {
            summaryDate: date,
            classId: schedule.classId,
            totalScheduleRegistered: students.length,
            totalCanceled: students.length - activeStudents.length,
            finalMan: man,
            finalChay: chay,
            finalChao: chao,
            isLocked: true,
            lockedAt: now,
          },
        });
        lockedClasses.add(schedule.classId);
      }
      // Nạp lại danh sách summaries sau khi auto-lock
      existingSummaries = await prisma.dailyMealSummary.findMany({
        where: { summaryDate: date },
      });
    }
  }

  // Trạng thái chốt: Đã chốt nếu qua giờ MEAL_LOCK_TIME_2 HOẶC user đã chủ động chốt trong DB
  const isLockedInDb = existingSummaries.length > 0 && schedules.length > 0 && schedules.every(s => lockedClasses.has(s.classId));
  const isAfterLockTime = isPastLockTime || isLockedInDb;

  const existingSummaryMap = new Map(existingSummaries.map(s => [s.classId, s]));

  // Tổng hợp theo lớp
  const classSummaries = schedules.map((schedule) => {
    const students = schedule.class.students;
    const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

    // Đếm suất ăn có tính MealOverride (Số lượng thực tế realtime)
    let man = 0;
    let chay = 0;
    let chao = 0;

    activeStudents.forEach(s => {
      const finalMealType = overrideMap.get(s.id) || s.mealType;
      if (finalMealType === "MAN") man++;
      else if (finalMealType === "CHAY") chay++;
      else if (finalMealType === "CHAO") chao++;
    });

    const exSum = existingSummaryMap.get(schedule.classId);

    return {
      classId: schedule.classId,
      className: schedule.class.name,
      totalRegistered: students.length,
      totalCanceled: students.length - activeStudents.length,
      finalMan: man,
      finalChay: chay,
      finalChao: chao,
      finalTotal: man + chay + chao,
      
      expectedMan: exSum?.expectedMan || 0,
      expectedChay: exSum?.expectedChay || 0,
      expectedChao: exSum?.expectedChao || 0,
      expectedTotal: (exSum?.expectedMan || 0) + (exSum?.expectedChay || 0) + (exSum?.expectedChao || 0),
      expectedLockedAt: exSum?.expectedLockedAt || null,

      isLocked: lockedClasses.has(schedule.classId),
    };
  });

  // ==================== HS ĂN ĐẶC BIỆT ====================
  // Lấy HS có lịch ăn đặc biệt ngày này (không trùng TKB lớp)
  const scheduleClassIdsSet = new Set(schedules.map((s) => s.classId));
  const specialMeals = await prisma.studentSpecialMeal.findMany({
    where: {
      date,
      student: {
        boardingStatus: BoardingStatus.ACTIVE,
      },
    },
    include: {
      student: {
        include: { class: { select: { id: true, name: true } } },
      },
    },
  });

  // Gom HS đặc biệt (không trùng TKB lớp) theo scheduleName
  const specialGroupMap = new Map<string, { name: string; students: Array<{ id: string; mealType: string }> }>();
  for (const sm of specialMeals) {
    if (!sm.student) continue;
    if (cancelledStudentIds.has(sm.student.id)) continue;
    if (scheduleClassIdsSet.has(sm.student.classId)) continue; // Trùng TKB lớp → bỏ qua

    const key = sm.scheduleName;
    if (!specialGroupMap.has(key)) {
      specialGroupMap.set(key, { name: key, students: [] });
    }
    const finalMealType = overrideMap.get(sm.student.id) || sm.student.mealType;
    specialGroupMap.get(key)!.students.push({ id: sm.student.id, mealType: finalMealType as string });
  }

  // Thêm lớp ảo vào classSummaries
  for (const [scheduleName, group] of specialGroupMap) {
    let man = 0, chay = 0, chao = 0;
    for (const s of group.students) {
      if (s.mealType === "MAN") man++;
      else if (s.mealType === "CHAY") chay++;
      else if (s.mealType === "CHAO") chao++;
    }
    classSummaries.push({
      classId: `SPECIAL::${scheduleName}`,
      className: `Lớp ${scheduleName}`,
      totalRegistered: group.students.length,
      totalCanceled: 0,
      finalMan: man,
      finalChay: chay,
      finalChao: chao,
      finalTotal: man + chay + chao,
      expectedMan: 0,
      expectedChay: 0,
      expectedChao: 0,
      expectedTotal: 0,
      expectedLockedAt: null,
      isLocked: false,
    });
  }

  // Tổng hợp toàn trường
  const totalSummary = {
    totalRegistered: classSummaries.reduce((sum, c) => sum + c.totalRegistered, 0),
    totalCanceled: classSummaries.reduce((sum, c) => sum + c.totalCanceled, 0),
    
    finalMan: classSummaries.reduce((sum, c) => sum + c.finalMan, 0),
    finalChay: classSummaries.reduce((sum, c) => sum + c.finalChay, 0),
    finalChao: classSummaries.reduce((sum, c) => sum + c.finalChao, 0),
    finalTotal: classSummaries.reduce((sum, c) => sum + c.finalTotal, 0),

    expectedMan: classSummaries.reduce((sum, c) => sum + c.expectedMan, 0),
    expectedChay: classSummaries.reduce((sum, c) => sum + c.expectedChay, 0),
    expectedChao: classSummaries.reduce((sum, c) => sum + c.expectedChao, 0),
    expectedTotal: classSummaries.reduce((sum, c) => sum + c.expectedTotal, 0),
  };

  return NextResponse.json({
    date: dateStr,
    weekNumber,
    dayField,
    lockTime2,
    isAfterLockTime,
    totalSummary,
    classSummaries,
    isFullyLocked: classSummaries.length > 0 && classSummaries.every((c) => c.isLocked),
    isExpectedLocked: classSummaries.length > 0 && classSummaries.some((c) => c.expectedLockedAt !== null),
  });
}

// POST: Chốt suất ăn cho ngày
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "CASHIER") {
      return NextResponse.json(
        { error: "Tài khoản Thu ngân chỉ có quyền xem, không được chốt suất ăn" },
        { status: 403 }
      );
    }

    const { date: dateStr, type = "FINAL" } = await request.json();

    if (!dateStr) {
      return NextResponse.json({ error: "Thiếu tham số date" }, { status: 400 });
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = date.getUTCDay();

    const dayFieldMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };

    const dayField = dayFieldMap[dayOfWeek];
    if (!dayField) {
      return NextResponse.json({ error: "Chủ nhật không có suất ăn" }, { status: 400 });
    }

    const weekNumber = getWeekNumber(date);

    // Lấy TKB
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: y,
        weekNumber,
        [dayField]: { not: "NONE" },
      },
      include: {
        class: {
          include: {
            students: {
              where: { boardingStatus: BoardingStatus.ACTIVE },
            },
          },
        },
      },
    });

    // Lấy cắt suất duyệt
    const approvedCancellations = await prisma.mealCancellation.findMany({
      where: {
        cancelDate: date,
        status: CancellationStatus.APPROVED,
      },
      select: { studentId: true },
    });
    const cancelledStudentIds = new Set(approvedCancellations.map((c) => c.studentId));

    // Lấy danh sách đổi món (MealOverride) cho ngày này
    const mealOverrides = await prisma.mealOverride.findMany({
      where: { date },
    });
    const overrideMap = new Map(mealOverrides.map(o => [o.studentId, o.mealType]));

    // Lưu tổng hợp
    let totalLocked = 0;
    const now = new Date();
    
    for (const schedule of schedules) {
      const students = schedule.class.students;
      const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

      let man = 0;
      let chay = 0;
      let chao = 0;

      activeStudents.forEach(s => {
        const finalMealType = overrideMap.get(s.id) || s.mealType;
        if (finalMealType === "MAN") man++;
        else if (finalMealType === "CHAY") chay++;
        else if (finalMealType === "CHAO") chao++;
      });

      if (type === "EXPECTED") {
        await prisma.dailyMealSummary.upsert({
          where: {
            summaryDate_classId: {
              summaryDate: date,
              classId: schedule.classId,
            },
          },
          update: {
            expectedMan: man,
            expectedChay: chay,
            expectedChao: chao,
            expectedLockedAt: now,
          },
          create: {
            summaryDate: date,
            classId: schedule.classId,
            expectedMan: man,
            expectedChay: chay,
            expectedChao: chao,
            expectedLockedAt: now,
          },
        });
      } else {
        // FINAL
        await prisma.dailyMealSummary.upsert({
          where: {
            summaryDate_classId: {
              summaryDate: date,
              classId: schedule.classId,
            },
          },
          update: {
            totalScheduleRegistered: students.length,
            totalCanceled: students.length - activeStudents.length,
            finalMan: man,
            finalChay: chay,
            finalChao: chao,
            isLocked: true,
            lockedAt: now,
          },
          create: {
            summaryDate: date,
            classId: schedule.classId,
            totalScheduleRegistered: students.length,
            totalCanceled: students.length - activeStudents.length,
            finalMan: man,
            finalChay: chay,
            finalChao: chao,
            isLocked: true,
            lockedAt: now,
          },
        });
      }
      totalLocked++;
    }

    broadcastChange('daily_meals', 'UPDATE', { date: dateStr, type });

    await logAudit({
      req: request,
      userId: session?.user?.id,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.APPROVE,
      module: AUDIT_MODULES.MEALS,
      description: type === "EXPECTED" 
        ? `Chốt số liệu suất ăn dự kiến ngày ${dateStr} cho ${totalLocked} lớp`
        : `Chốt số liệu suất ăn chính thức ngày ${dateStr} cho ${totalLocked} lớp`,
      metadata: { date: dateStr, type, totalLocked },
    });

    return NextResponse.json({
      message: type === "EXPECTED" 
        ? `Đã chốt số dự kiến ngày ${dateStr} cho ${totalLocked} lớp`
        : `Đã chốt chính thức suất ăn ngày ${dateStr} cho ${totalLocked} lớp`,
      lockedClasses: totalLocked,
    });
  } catch (error) {
    console.error("Lock meals error:", error);
    return NextResponse.json(
      { error: "Lỗi khi chốt suất ăn", details: String(error) },
      { status: 500 }
    );
  }
}
