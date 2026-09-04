// API Route: Chốt suất ăn hàng ngày
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CancellationStatus, BoardingStatus } from "@prisma/client";
import { broadcastChange } from "@/lib/realtime-hub";
import { getWeekNumber } from "@/lib/utils";

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

  // Kiểm tra đã chốt chưa và lấy số dự kiến
  const existingSummaries = await prisma.dailyMealSummary.findMany({
    where: { summaryDate: date },
  });
  const existingSummaryMap = new Map(existingSummaries.map(s => [s.classId, s]));
  const lockedClasses = new Set(
    existingSummaries.filter((s) => s.isLocked).map((s) => s.classId)
  );

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

  // Lấy cấu hình hệ thống giờ chốt
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["MEAL_LOCK_TIME_2", "CUTOFF_TIME"] } }
  });
  const lockTime2 = settings.find(s => s.key === "MEAL_LOCK_TIME_2")?.value 
                 || settings.find(s => s.key === "CUTOFF_TIME")?.value 
                 || "08:00";

  return NextResponse.json({
    date: dateStr,
    weekNumber,
    dayField,
    lockTime2,
    totalSummary,
    classSummaries,
    isFullyLocked: classSummaries.length > 0 && classSummaries.every((c) => c.isLocked),
    isExpectedLocked: classSummaries.length > 0 && classSummaries.some((c) => c.expectedLockedAt !== null),
  });
}

// POST: Chốt suất ăn cho ngày
export async function POST(request: NextRequest) {
  try {
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
