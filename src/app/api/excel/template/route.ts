// API Route: Tải Template Excel
import { NextRequest, NextResponse } from "next/server";
import {
  generateClassTemplate,
  generateStudentTemplate,
  generateScheduleTemplate,
  generateSpecialMealTemplate,
  generateMealCancelTemplate,
  CustomSpecialMealWeekConfig,
} from "@/lib/excel";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const weeksConfigParam = searchParams.get("weeksConfig");

  let weeksConfig: CustomSpecialMealWeekConfig[] | undefined = undefined;
  if (weeksConfigParam) {
    try {
      weeksConfig = JSON.parse(weeksConfigParam);
    } catch {
      // Bỏ qua nếu lỗi parse
    }
  }

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
    case "special-meal":
      buffer = await generateSpecialMealTemplate(weeksConfig);
      filename = "Template_LichAnDacBiet.xlsx";
      break;
    case "meal-cancel":
      buffer = await generateMealCancelTemplate();
      filename = "Template_CatSuatAn.xlsx";
      break;
    default:
      return NextResponse.json(
        { error: "Loại template không hợp lệ. Sử dụng: class, student, schedule, special-meal, meal-cancel" },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, weeksConfig } = body;

    let buffer: Buffer;
    let filename: string;

    switch (type) {
      case "special-meal":
        buffer = await generateSpecialMealTemplate(weeksConfig);
        filename = "Template_LichAnDacBiet.xlsx";
        break;
      default:
        return NextResponse.json(
          { error: "Loại template POST không hợp lệ" },
          { status: 400 }
        );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Không thể tạo template Excel", details: error.message },
      { status: 500 }
    );
  }
}
