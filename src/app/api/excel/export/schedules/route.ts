import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekString = searchParams.get("weekString");

    let targetYear = new Date().getFullYear();
    let targetWeek = 1;

    if (weekString && weekString.includes("-W")) {
      const parts = weekString.split("-W");
      targetYear = parseInt(parts[0]);
      targetWeek = parseInt(parts[1]);
    }

    // Get all classes
    const classes = await prisma.class.findMany({
      orderBy: { id: "asc" },
    });

    // Get existing schedules for that week
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: targetYear,
        weekNumber: targetWeek,
      },
    });

    const scheduleMap = new Map(schedules.map((s) => [s.classId, s]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`TKB_Tuan${targetWeek}_${targetYear}`);

    const headers = [
      "STT",
      "MaLop (*)",
      "Thu2",
      "Thu3",
      "Thu4",
      "Thu5",
      "Thu6",
      "Thu7",
      "GhiChu",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 30;

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 15;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 15;
    sheet.getColumn(9).width = 30;

    let stt = 1;
    for (const c of classes) {
      const s = scheduleMap.get(c.id);
      sheet.addRow([
        stt++,
        c.id,
        s?.monday || "KHONG",
        s?.tuesday || "KHONG",
        s?.wednesday || "KHONG",
        s?.thursday || "KHONG",
        s?.friday || "KHONG",
        s?.saturday || "KHONG",
        s?.note || "",
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ThoiKhoaBieu_Tuan${targetWeek}_${targetYear}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Lỗi khi xuất dữ liệu" }, { status: 500 });
  }
}
