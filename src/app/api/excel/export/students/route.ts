import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: true,
        class: true,
      },
      orderBy: [
        { classId: "asc" },
        { user: { fullName: "asc" } },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("DanhSachHocSinh");

    // Add standard headers matching the import template
    const headers = [
      "STT",
      "MaHocSinh (*)",
      "HoTen (*)",
      "Giới Tính (*)\n(NAM/NU)",
      "NgaySinh (DD/MM/YYYY)",
      "TenDangNhap (Tự động nếu trống)",
      "MatKhau (Tự động ddmmyyyy)",
      "MaLop (*)",
      "TenLop",
      "CheDoAn (*)\n(MAN/CHAY/CHAO)",
      "DangKyBanTru (*)\n(CO/KHONG)",
      "SDT PhuHuynh",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 30;

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(2).numFmt = '@';
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(5).numFmt = '@';
    sheet.getColumn(6).width = 22;
    sheet.getColumn(6).numFmt = '@';
    sheet.getColumn(7).width = 22;
    sheet.getColumn(7).numFmt = '@';
    sheet.getColumn(8).width = 12;
    sheet.getColumn(8).numFmt = '@';
    sheet.getColumn(9).width = 20;
    sheet.getColumn(10).width = 18;
    sheet.getColumn(11).width = 20;
    sheet.getColumn(12).width = 20;
    sheet.getColumn(12).numFmt = '@';

    // Fill data
    let stt = 1;
    for (const s of students) {
      let ngaySinhStr = "";
      if (s.birthDate) {
        const d = new Date(s.birthDate);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        ngaySinhStr = `${dd}/${mm}/${yyyy}`;
      }

      sheet.addRow([
        stt++,
        s.studentCode,
        s.user.fullName,
        s.gender === "FEMALE" ? "NU" : "NAM",
        ngaySinhStr,
        s.user.username,
        ngaySinhStr ? ngaySinhStr.replace(/\//g, "") : "", // Default password is DOB without slashes
        s.classId,
        s.class?.name || "",
        s.mealType,
        s.boardingStatus === "ACTIVE" ? "CO" : "KHONG",
        s.parentPhone || "",
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="DanhSachHocSinh_Export_${new Date().getTime()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Lỗi khi xuất dữ liệu" }, { status: 500 });
  }
}
