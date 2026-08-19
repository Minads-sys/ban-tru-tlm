// API Route: Cắt suất ăn (Student tự gửi yêu cầu)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BoardingStatus } from "@prisma/client";
import { getVietnamTodayUTC, isPastCutoffTime } from "@/lib/utils";

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
    const { studentId, cancelDate, reason } = await request.json();

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

    // Kiểm tra giờ khóa sổ
    const cutoffSetting = await prisma.systemSetting.findUnique({
      where: { key: "CUTOFF_TIME" },
    });
    const cutoffTime = cutoffSetting?.value || "16:30";

    const [reqYear, reqMonth, reqDay] = cancelDate.split("-").map(Number);
    const requestDate = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));
    
    const localToday = getVietnamTodayUTC();
    const tomorrow = new Date(localToday);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (requestDate < tomorrow) {
      // Nếu cắt cho ngày mai thì kiểm tra giờ khóa sổ
      if (requestDate.getTime() === tomorrow.getTime()) {
        if (isPastCutoffTime(cutoffTime)) {
          return NextResponse.json(
            {
              error: `Đã quá giờ khóa sổ (${cutoffTime}). Không thể cắt suất cho ngày mai.`,
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Không thể cắt suất cho ngày hôm nay hoặc ngày đã qua" },
          { status: 400 }
        );
      }
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
