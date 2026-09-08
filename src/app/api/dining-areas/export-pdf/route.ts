import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDiningCourtAllocation, getWeeklyDiningMatrix } from "@/lib/dining-court-service";
import {
  generateDiningCourtsPdfBuffer,
  generateDiningCourtsSummaryPdfBuffer,
  generateWeeklyDiningMatrixPdfBuffer,
} from "@/lib/dining-court-pdf-generator";
import { getSchoolWeekFromNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const weekParam = searchParams.get("week");
    const yearParam = searchParams.get("year");
    const shift = (searchParams.get("shift") || "ALL") as "ALL" | "TIET_4" | "TIET_5";
    const type = searchParams.get("type") || "roster"; // "roster" | "summary" | "weekly"

    // Lấy tên trường học từ cấu hình
    const schoolSetting = await prisma.systemSetting.findUnique({
      where: { key: "SCHOOL_NAME" },
    });
    const schoolName = schoolSetting?.value || "TRƯỜNG TIỂU HỌC BÁN TRÚ";

    // XUẤT BẢNG MA TRẬN THEO TUẦN (TUẦN NĂM HỌC)
    if (type === "weekly" || type === "weekly_matrix") {
      let targetDate: string | Date = new Date();
      if (weekParam) {
        const weekNum = parseInt(weekParam, 10);
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const defaultStartYear = currentMonth < 7 ? currentYear - 1 : currentYear;
        const startYear = yearParam ? parseInt(yearParam, 10) : defaultStartYear;
        if (!isNaN(weekNum)) {
          const weekInfo = getSchoolWeekFromNumber(weekNum, startYear);
          targetDate = weekInfo.startDateStr;
        }
      } else if (dateStr) {
        targetDate = dateStr;
      }

      const matrix = await getWeeklyDiningMatrix(targetDate);
      const pdfBuffer = await generateWeeklyDiningMatrixPdfBuffer(matrix, { schoolName });
      const weekNum = matrix.weekInfo.schoolWeekNumber;
      const cleanSchoolYear = matrix.weekInfo.schoolYear.replace(/\s+/g, "");
      const fileName = `Thong_Ke_San_An_Tuan_${weekNum}_NamHoc_${cleanSchoolYear}.pdf`;

      const isInline = searchParams.get("inline") === "1" || searchParams.get("view") === "1";
      const dispositionType = isInline ? "inline" : "attachment";

      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${dispositionType}; filename="${fileName}"`,
          "Content-Length": pdfBuffer.length.toString(),
        },
      });
    }

    if (!dateStr) {
      return NextResponse.json(
        { error: "Thiếu tham số ngày (date)" },
        { status: 400 }
      );
    }

    const allocation = await getDiningCourtAllocation(dateStr);

    if (!allocation.isConfigured || allocation.totalCourts === 0) {
      return NextResponse.json(
        { error: "Ngày này chưa được tạo phân bổ chia sân. Vui lòng bấm 'Tạo tự động' hoặc 'Tạo thủ công' trước khi xuất PDF." },
        { status: 400 }
      );
    }

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

    const isInline = searchParams.get("inline") === "1" || searchParams.get("view") === "1";
    const dispositionType = isInline ? "inline" : "attachment";

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${fileName}"`,
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
