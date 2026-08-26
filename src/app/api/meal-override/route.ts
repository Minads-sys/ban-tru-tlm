// API Route: Đổi món ăn (Meal Override)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getVietnamTodayUTC, isPastCutoffTime } from "@/lib/utils";
import { BoardingStatus } from "@prisma/client";

// GET: Lấy danh sách đổi món của 1 học sinh
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "Thiếu studentId" }, { status: 400 });
  }

  const overrides = await prisma.mealOverride.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json(overrides);
}

// POST: Gửi yêu cầu đổi món
export async function POST(request: NextRequest) {
  try {
    const { studentId, date, mealType } = await request.json();

    if (!studentId || !date || !mealType) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đủ thông tin: studentId, date, mealType" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.boardingStatus !== BoardingStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Học sinh không có trong danh sách bán trú hoặc đã bị hủy" },
        { status: 403 }
      );
    }

    // Kiểm tra giờ khóa sổ
    const cutoffSetting = await prisma.systemSetting.findUnique({
      where: { key: "CUTOFF_TIME" },
    });
    const cutoffTime = cutoffSetting?.value || "16:30";

    const [reqYear, reqMonth, reqDay] = date.split("-").map(Number);
    const requestDate = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));
    
    const localToday = getVietnamTodayUTC();
    const tomorrow = new Date(localToday);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Kiểm tra nằm trong năm học
    const schoolSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ["SCHOOL_YEAR_START", "SCHOOL_YEAR_END"] } }
    });
    const startSetting = schoolSettings.find(s => s.key === "SCHOOL_YEAR_START")?.value;
    const endSetting = schoolSettings.find(s => s.key === "SCHOOL_YEAR_END")?.value;
    
    if (startSetting && endSetting) {
      const [syY, syM, syD] = startSetting.split("-").map(Number);
      const syStart = new Date(Date.UTC(syY, syM - 1, syD));
      const [eyY, eyM, eyD] = endSetting.split("-").map(Number);
      const syEnd = new Date(Date.UTC(eyY, eyM - 1, eyD, 23, 59, 59));
      
      if (requestDate < syStart || requestDate > syEnd) {
        return NextResponse.json(
          { error: "Ngày yêu cầu không nằm trong thời gian của Năm học hiện tại." },
          { status: 400 }
        );
      }
    }

    if (requestDate < tomorrow) {
      if (requestDate.getTime() === tomorrow.getTime()) {
        if (isPastCutoffTime(cutoffTime)) {
          return NextResponse.json(
            {
              error: `Đã quá giờ khóa sổ (${cutoffTime}). Không thể đổi món cho ngày mai.`,
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Không thể đổi món cho ngày hôm nay hoặc ngày đã qua" },
          { status: 400 }
        );
      }
    }

    // Kiểm tra không được thao tác cho tuần kế tiếp nếu chưa tới Thứ 7
    const currentDayOfWeek = localToday.getUTCDay();
    let daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    
    if (currentDayOfWeek === 6 || currentDayOfWeek === 0) {
      daysUntilSunday += 7;
    }

    const endOfAllowedWeek = new Date(localToday);
    endOfAllowedWeek.setUTCDate(localToday.getUTCDate() + daysUntilSunday);
    
    if (requestDate > endOfAllowedWeek) {
      return NextResponse.json(
        { error: "Tuần kế tiếp chỉ được mở đăng ký từ Thứ Bảy tuần hiện tại." },
        { status: 400 }
      );
    }

    // Kiểm tra lớp có lịch ăn ngày này không
    const dayOfWeek = requestDate.getUTCDay();
    const dayFieldMap: Record<number, string> = {
      1: "monday", 2: "tuesday", 3: "wednesday",
      4: "thursday", 5: "friday", 6: "saturday",
    };
    const dayField = dayFieldMap[dayOfWeek];

    if (!dayField) {
      return NextResponse.json(
        { error: "Không thể đổi món vào Chủ nhật" },
        { status: 400 }
      );
    }

    const startOfYear = new Date(Date.UTC(requestDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      ((requestDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
    );

    const schedule = await prisma.classWeeklySchedule.findFirst({
      where: {
        classId: student.classId,
        year: requestDate.getUTCFullYear(),
        weekNumber,
        [dayField]: { not: "NONE" },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Lớp không có lịch ăn bán trú ngày này theo thời khóa biểu" },
        { status: 400 }
      );
    }

    // NEW CHECK: Prevent override if there is an active cancellation for this date
    const existingCancel = await prisma.mealCancellation.findFirst({
      where: {
        studentId,
        cancelDate: requestDate,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existingCancel) {
      return NextResponse.json(
        { error: "Học sinh đang có yêu cầu cắt suất chưa bị từ chối vào ngày này, không thể đổi món." },
        { status: 400 }
      );
    }

    // Upsert: Create or Update override
    const override = await prisma.mealOverride.upsert({
      where: {
        studentId_date: {
          studentId,
          date: new Date(date),
        },
      },
      update: {
        mealType,
      },
      create: {
        studentId,
        date: new Date(date),
        mealType,
      },
    });

    return NextResponse.json({
      message: "Đã đổi món thành công cho ngày " + new Date(date).toLocaleDateString(),
      override,
    });
  } catch (error) {
    console.error("Meal override error:", error);
    return NextResponse.json(
      { error: "Lỗi khi đổi món", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Xóa ghi đè món (Quay về mặc định)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });
    }
    
    await prisma.mealOverride.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi khi xóa đổi món" }, { status: 500 });
  }
}
