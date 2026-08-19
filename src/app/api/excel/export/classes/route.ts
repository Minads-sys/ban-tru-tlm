import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { id: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("DanhSachLop");

    const headers = [
      "STT",
      "MaLop (*)",
      "TenLop (*)",
      "GiaoVienCN",
      "GhiChu",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 30;

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 25;
    sheet.getColumn(5).width = 30;

    let stt = 1;
    for (const c of classes) {
      sheet.addRow([
        stt++,
        c.id,
        c.name,
        "", // Currently no single GiaoVienCN in schema without relationships, maybe leave empty
        "", // No GhiChu in schema directly for class
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="DanhSachLop_Export.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Lỗi khi xuất dữ liệu" }, { status: 500 });
  }
}
