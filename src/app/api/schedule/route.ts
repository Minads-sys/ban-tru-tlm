import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { broadcastChange } from "@/lib/realtime-hub";

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

    broadcastChange('schedules', 'UPDATE', { year, weekNumber });

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

// DELETE: Xóa toàn bộ TKB của một tuần
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || "");
  const weekNumber = parseInt(searchParams.get("weekNumber") || "");

  if (!year || !weekNumber) {
    return NextResponse.json(
      { error: "Thiếu tham số year hoặc weekNumber" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.classWeeklySchedule.deleteMany({
      where: {
        year,
        weekNumber,
      },
    });

    broadcastChange('schedules', 'DELETE', { year, weekNumber });

    return NextResponse.json({
      message: `Đã xóa thành công ${result.count} bản ghi TKB của tuần ${weekNumber}/${year}`,
      count: result.count,
    });
  } catch (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json(
      { error: "Lỗi khi xóa TKB", details: String(error) },
      { status: 500 }
    );
  }
}
