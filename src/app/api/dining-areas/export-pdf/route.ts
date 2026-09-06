import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDiningCourtAllocation } from "@/lib/dining-court-service";
import {
  generateDiningCourtsPdfBuffer,
  generateDiningCourtsSummaryPdfBuffer,
} from "@/lib/dining-court-pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const shift = (searchParams.get("shift") || "ALL") as "ALL" | "TIET_4" | "TIET_5";
    const type = searchParams.get("type") || "roster"; // "roster" (điểm danh) hoặc "summary" (tập kết suất ăn theo sân)

    if (!dateStr) {
      return NextResponse.json(
        { error: "Thiếu tham số ngày (date)" },
        { status: 400 }
      );
    }

    // Lấy tên trường học từ cấu hình
    const schoolSetting = await prisma.systemSetting.findUnique({
      where: { key: "SCHOOL_NAME" },
    });
    const schoolName = schoolSetting?.value || "TRƯỜNG TIỂU HỌC BÁN TRÚ";

    const allocation = await getDiningCourtAllocation(dateStr);

    const shiftSuffix = shift === "TIET_4" ? "Tiet_4" : shift === "TIET_5" ? "Tiet_5" : "Tat_Ca";

    let pdfBuffer: Buffer;
    let fileName: string;

    if (type === "summary") {
      pdfBuffer = await generateDiningCourtsSummaryPdfBuffer(allocation, {
        schoolName,
        shiftFilter: shift,
      });
      fileName = `Bang_Tap_Ket_Suat_An_San_${shiftSuffix}_${dateStr.replace(/-/g, "")}.pdf`;
    } else {
      pdfBuffer = await generateDiningCourtsPdfBuffer(allocation, {
        schoolName,
        shiftFilter: shift,
      });
      fileName = `Diem_Danh_San_An_${shiftSuffix}_${dateStr.replace(/-/g, "")}.pdf`;
    }

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Lỗi xuất PDF danh sách chia sân:", error);
    return NextResponse.json(
      { error: "Không thể xuất file PDF điểm danh", details: String(error) },
      { status: 500 }
    );
  }
}
