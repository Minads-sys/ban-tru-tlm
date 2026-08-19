// API Route: Quản lý Thời khóa biểu theo tuần
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: Lấy TKB tuần
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const weekNumber = parseInt(searchParams.get("weekNumber") || "1");

  // Lấy tất cả lớp + học sinh ACTIVE
  const classes = await prisma.class.findMany({
    orderBy: { id: "asc" },
    include: {
      students: {
        where: { boardingStatus: "ACTIVE" },
        select: { gender: true },
      },
    },
  });

  // Lấy TKB tuần này
  const schedules = await prisma.classWeeklySchedule.findMany({
    where: { year, weekNumber },
  });
  const scheduleMap = new Map(schedules.map((s) => [s.classId, s]));

  // Trả về danh sách có kết hợp thông tin lớp
  const result = classes.map((cls) => {
    const schedule = scheduleMap.get(cls.id);
    
    // Thống kê
    const totalBoarding = cls.students.length;
    const maleBoarding = cls.students.filter(s => s.gender === 'MALE').length;
    const femaleBoarding = cls.students.filter(s => s.gender === 'FEMALE').length;

    return {
      classId: cls.id,
      className: cls.name,
      totalBoarding,
      maleBoarding,
      femaleBoarding,
      monday: schedule?.monday ?? "NONE",
      tuesday: schedule?.tuesday ?? "NONE",
      wednesday: schedule?.wednesday ?? "NONE",
      thursday: schedule?.thursday ?? "NONE",
      friday: schedule?.friday ?? "NONE",
      saturday: schedule?.saturday ?? "NONE",
    };
  });

  return NextResponse.json({
    isNew: schedules.length === 0,
    data: result
  });
}

// POST: Lưu TKB tuần
export async function POST(request: NextRequest) {
  try {
    const { year, weekNumber, schedules } = await request.json();

    if (!year || !weekNumber || !schedules) {
      return NextResponse.json(
        { error: "Thiếu tham số year, weekNumber hoặc schedules" },
        { status: 400 }
      );
    }

    // Tính ngày đầu tuần (Thứ 2)
    const jan1 = new Date(year, 0, 1);
    const daysToMonday = ((weekNumber - 1) * 7) + (1 - jan1.getDay());
    const startDate = new Date(year, 0, 1 + daysToMonday);

    let updated = 0;
    for (const schedule of schedules) {
      await prisma.classWeeklySchedule.upsert({
        where: {
          classId_year_weekNumber: {
            classId: schedule.classId,
            year,
            weekNumber,
          },
        },
        update: {
          monday: schedule.monday,
          tuesday: schedule.tuesday,
          wednesday: schedule.wednesday,
          thursday: schedule.thursday,
          friday: schedule.friday,
          saturday: schedule.saturday,
        },
        create: {
          classId: schedule.classId,
          year,
          weekNumber,
          startDate,
          monday: schedule.monday,
          tuesday: schedule.tuesday,
          wednesday: schedule.wednesday,
          thursday: schedule.thursday,
          friday: schedule.friday,
          saturday: schedule.saturday,
        },
      });
      updated++;
    }

    return NextResponse.json({
      message: `Đã lưu TKB tuần ${weekNumber}/${year} cho ${updated} lớp`,
      count: updated,
    });
  } catch (error) {
    console.error("Schedule error:", error);
    return NextResponse.json(
      { error: "Lỗi khi lưu TKB", details: String(error) },
      { status: 500 }
    );
  }
}
