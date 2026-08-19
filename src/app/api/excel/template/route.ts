// API Route: Tải Template Excel
import { NextRequest, NextResponse } from "next/server";
import {
  generateClassTemplate,
  generateStudentTemplate,
  generateScheduleTemplate,
} from "@/lib/excel";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  let buffer: Buffer;
  let filename: string;

  switch (type) {
    case "class":
      buffer = await generateClassTemplate();
      filename = "Template_DanhSach_Lop.xlsx";
      break;
    case "student":
      buffer = await generateStudentTemplate();
      filename = "Template_DanhSach_HocSinh.xlsx";
      break;
    case "schedule":
      buffer = await generateScheduleTemplate();
      filename = "Template_ThoiKhoaBieu.xlsx";
      break;
    default:
      return NextResponse.json(
        { error: "Loại template không hợp lệ. Sử dụng: class, student, schedule" },
        { status: 400 }
      );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
