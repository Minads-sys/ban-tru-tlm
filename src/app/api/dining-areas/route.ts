import { NextRequest, NextResponse } from "next/server";
import { getDiningCourtAllocation } from "@/lib/dining-court-service";

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
