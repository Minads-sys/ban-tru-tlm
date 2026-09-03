// API Route: Cắt suất ăn (Student tự gửi yêu cầu)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus } from "@prisma/client";
import { getVietnamTodayUTC, isPastCutoffTime } from "@/lib/utils";
import { broadcastChange } from "@/lib/realtime-hub";

// GET: Lấy danh sách yêu cầu cắt suất của 1 học sinh
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "Thiếu studentId" }, { status: 400 });
  }

  const cancellations = await prisma.mealCancellation.findMany({
    where: { studentId },
    orderBy: { cancelDate: "desc" },
    take: 30,
  });

  return NextResponse.json(cancellations);
}

// POST: Gửi yêu cầu cắt suất mới
export async function POST(request: NextRequest) {
  try {
    const { studentId, cancelDate, reason, ignoreCutoff } = await request.json();

    if (!studentId || !cancelDate || !reason) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đủ thông tin: studentId, cancelDate, reason" },
        { status: 400 }
      );
    }

    // Kiểm tra học sinh có đang ăn bán trú không
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.boardingStatus !== BoardingStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Học sinh không có trong danh sách bán trú hoặc đã bị hủy" },
        { status: 403 }
      );
    }

    // Lấy cài đặt giờ khóa sổ
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["CUTOFF_TIME", "MEAL_LOCK_TIME_2"] } }
    });
    
    // Ưu tiên dùng MEAL_LOCK_TIME_2 (theo chuẩn mới), nếu không có thì fallback về CUTOFF_TIME
    const lockTime2Setting = settings.find(s => s.key === "MEAL_LOCK_TIME_2")?.value 
                          || settings.find(s => s.key === "CUTOFF_TIME")?.value 
                          || "08:00";

    const [reqYear, reqMonth, reqDay] = cancelDate.split("-").map(Number);
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

    if (requestDate < localToday) {
      return NextResponse.json(
        { error: "Không thể cắt suất cho ngày đã qua" },
        { status: 400 }
      );
    }

    if (requestDate.getTime() === localToday.getTime()) {
      // Nếu cắt cho ngày hôm nay thì kiểm tra giờ khóa sổ MEAL_LOCK_TIME_2
      if (!ignoreCutoff && isPastCutoffTime(lockTime2Setting)) {
        return NextResponse.json(
          {
            error: `Đã quá giờ chốt chính thức (${lockTime2Setting}). Không thể cắt suất cho ngày hôm nay nữa.`,
          },
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
        { error: "Không thể cắt suất ăn vào Chủ nhật" },
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

    // Kiểm tra đã gửi yêu cầu cho ngày này chưa
    const existing = await prisma.mealCancellation.findUnique({
      where: {
        studentId_cancelDate: {
          studentId,
          cancelDate: new Date(cancelDate),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bạn đã gửi yêu cầu cắt suất cho ngày này rồi" },
        { status: 409 }
      );
    }

    // Tạo yêu cầu cắt suất
    const cancellation = await prisma.mealCancellation.create({
      data: {
        studentId,
        cancelDate: new Date(cancelDate),
        reason,
        status: "PENDING",
      },
    });

    broadcastChange('meal_cancellations', 'INSERT', cancellation);
    broadcastChange('daily_meals', 'UPDATE');

    return NextResponse.json({
      message: "Đã gửi yêu cầu cắt suất thành công. Vui lòng chờ duyệt.",
      cancellation,
    });
  } catch (error) {
    console.error("Meal cancellation error:", error);
    return NextResponse.json(
      { error: "Lỗi khi gửi yêu cầu cắt suất", details: String(error) },
      { status: 500 }
    );
  }
}
