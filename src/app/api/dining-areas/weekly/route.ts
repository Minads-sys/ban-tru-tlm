import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWeeklyDiningMatrix,
  autoAllocateWeek,
  copyDiningCourtWeek,
  updateClassCourtCell,
  deleteWeeklyDiningAllocation,
} from "@/lib/dining-court-service";
import { getSchoolWeekFromNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const weekParam = searchParams.get("week");
    const yearParam = searchParams.get("year");

    let targetDate: string | Date = new Date();

    if (weekParam && yearParam) {
      const weekNum = parseInt(weekParam, 10);
      const startYear = parseInt(yearParam, 10);
      if (!isNaN(weekNum) && !isNaN(startYear)) {
        const weekInfo = getSchoolWeekFromNumber(weekNum, startYear);
        targetDate = weekInfo.startDateStr;
      }
    } else if (dateParam) {
      targetDate = dateParam;
    }

    const matrix = await getWeeklyDiningMatrix(targetDate);
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Lỗi lấy dữ liệu ma trận chia sân theo tuần:", error);
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu ma trận tuần", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userRole = session?.user?.role;

    // Phân quyền chặt chẽ: chỉ ADMIN và BOARDING_MANAGER được chỉnh sửa/tạo sân
    if (!session || !userRole || !["ADMIN", "BOARDING_MANAGER"].includes(userRole)) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác chia sân này" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, date, sourceDate, targetDate, classId, newCourtName } = body;

    if (action === "AUTO_WEEK") {
      if (!date) {
        return NextResponse.json({ error: "Thiếu ngày tham chiếu để tạo tuần" }, { status: 400 });
      }
      const result = await autoAllocateWeek(date);
      return NextResponse.json({
        success: true,
        message: `Đã phân bổ chia sân tự động cho tuần thành công!`,
        data: result,
      });
    }

    if (action === "COPY_WEEK") {
      if (!sourceDate || !targetDate) {
        return NextResponse.json(
          { error: "Thiếu ngày tuần nguồn hoặc tuần đích để sao chép" },
          { status: 400 }
        );
      }
      const result = await copyDiningCourtWeek(sourceDate, targetDate);
      return NextResponse.json({
        success: true,
        message: "Đã sao chép phân bổ sân thành công!",
        data: result,
      });
    }

    if (action === "UPDATE_CELL") {
      if (!date || !classId) {
        return NextResponse.json(
          { error: "Thiếu thông tin ngày hoặc lớp học để đổi sân" },
          { status: 400 }
        );
      }
      await updateClassCourtCell(date, classId, newCourtName || null);
      const result = await getWeeklyDiningMatrix(date);
      return NextResponse.json({
        success: true,
        message: "Đã cập nhật sân thành công!",
        data: result,
      });
    }

    if (action === "DELETE_WEEK") {
      if (!date) {
        return NextResponse.json({ error: "Thiếu ngày tham chiếu để xóa tuần" }, { status: 400 });
      }
      await deleteWeeklyDiningAllocation(date);
      const result = await getWeeklyDiningMatrix(date);
      return NextResponse.json({
        success: true,
        message: "Đã xóa phân bổ sân của tuần!",
        data: result,
      });
    }

    return NextResponse.json(
      { error: "Hành động (action) không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Lỗi xử lý API tuần chia sân:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Đã có lỗi xảy ra" },
      { status: 500 }
    );
  }
}
