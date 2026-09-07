import { NextRequest, NextResponse } from "next/server";
import {
  getDiningCourtAllocation,
  saveAutoDiningCourtAllocation,
  saveManualDiningCourtAllocation,
  deleteDiningCourtAllocation,
} from "@/lib/dining-court-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Thiếu tham số ngày (date)" },
        { status: 400 }
      );
    }

    const allocation = await getDiningCourtAllocation(dateStr);
    return NextResponse.json(allocation);
  } catch (error) {
    console.error("Lỗi lấy dữ liệu chia sân:", error);
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu phân bổ chia sân", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, action, courts } = body;

    if (!date) {
      return NextResponse.json(
        { error: "Thiếu thông tin ngày (date)" },
        { status: 400 }
      );
    }

    if (action === "AUTO") {
      const result = await saveAutoDiningCourtAllocation(date);
      return NextResponse.json({
        success: true,
        message: "Đã phân bổ chia sân tự động thành công!",
        data: result,
      });
    }

    if (action === "MANUAL") {
      if (!Array.isArray(courts)) {
        return NextResponse.json(
          { error: "Dữ liệu danh sách sân (courts) không hợp lệ" },
          { status: 400 }
        );
      }

      const result = await saveManualDiningCourtAllocation(date, courts);
      return NextResponse.json({
        success: true,
        message: "Đã lưu phân bổ chia sân thủ công thành công!",
        data: result,
      });
    }

    return NextResponse.json(
      { error: "Hành động (action) không hợp lệ, vui lòng chọn AUTO hoặc MANUAL" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Lỗi lưu phân bổ chia sân:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể lưu phân bổ chia sân" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let dateStr = searchParams.get("date");

    if (!dateStr) {
      try {
        const body = await request.json();
        dateStr = body.date;
      } catch {
        // ignore
      }
    }

    if (!dateStr) {
      return NextResponse.json(
        { error: "Thiếu tham số ngày (date)" },
        { status: 400 }
      );
    }

    const res = await deleteDiningCourtAllocation(dateStr);
    return NextResponse.json(res);
  } catch (error) {
    console.error("Lỗi xóa phân bổ chia sân:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể xóa phân bổ chia sân" },
      { status: 500 }
    );
  }
}
