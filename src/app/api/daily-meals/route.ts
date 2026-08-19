// API Route: Chốt suất ăn hàng ngày
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CancellationStatus, BoardingStatus } from "@prisma/client";

// GET: Lấy tổng hợp suất ăn cho 1 ngày
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "Thiếu tham số date" }, { status: 400 });
  }

  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0=CN, 1=T2, ..., 6=T7

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

  // Tính tuần
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );

  // Lấy tất cả các lớp có lịch ăn ngày này
  const schedules = await prisma.classWeeklySchedule.findMany({
    where: {
      year: date.getFullYear(),
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

  // Kiểm tra đã chốt chưa
  const existingSummaries = await prisma.dailyMealSummary.findMany({
    where: { summaryDate: date },
  });
  const lockedClasses = new Set(
    existingSummaries.filter((s) => s.isLocked).map((s) => s.classId)
  );

  // Tổng hợp theo lớp
  const classSummaries = schedules.map((schedule) => {
    const students = schedule.class.students;
    const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

    // Đếm suất ăn có tính MealOverride
    let man = 0;
    let chay = 0;
    let chao = 0;

    activeStudents.forEach(s => {
      const finalMealType = overrideMap.get(s.id) || s.mealType;
      if (finalMealType === "MAN") man++;
      else if (finalMealType === "CHAY") chay++;
      else if (finalMealType === "CHAO") chao++;
    });

    return {
      classId: schedule.classId,
      className: schedule.class.name,
      totalRegistered: students.length,
      totalCanceled: students.length - activeStudents.length,
      finalMan: man,
      finalChay: chay,
      finalChao: chao,
      finalTotal: man + chay + chao,
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
  };

  return NextResponse.json({
    date: dateStr,
    weekNumber,
    dayField,
    totalSummary,
    classSummaries,
    isFullyLocked: classSummaries.every((c) => c.isLocked),
  });
}

// POST: Chốt suất ăn cho ngày
export async function POST(request: NextRequest) {
  try {
    const { date: dateStr } = await request.json();

    if (!dateStr) {
      return NextResponse.json({ error: "Thiếu tham số date" }, { status: 400 });
    }

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

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

    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );

    // Lấy TKB
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: date.getFullYear(),
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
          lockedAt: new Date(),
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
          lockedAt: new Date(),
        },
      });
      totalLocked++;
    }

    return NextResponse.json({
      message: `Đã chốt suất ăn ngày ${dateStr} cho ${totalLocked} lớp`,
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
