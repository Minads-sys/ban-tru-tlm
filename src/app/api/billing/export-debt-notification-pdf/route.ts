import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  generateDebtNotificationPdfBuffer,
  DebtNotificationPdfBill,
  DebtNotificationLayout,
} from "@/lib/debt-notification-pdf-generator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let bills: DebtNotificationPdfBill[] = body.bills;
    const month = Number(body.month);
    const year = Number(body.year);
    const className = body.className || "";
    const layout: DebtNotificationLayout = body.layout || "A4_PORTRAIT_4UP";
    let schoolName = body.schoolName;

    if (!schoolName) {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "SCHOOL_NAME" },
      });
      schoolName = setting?.value || "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN";
    }

    // Nếu client không truyền bills trực tiếp, truy vấn từ database
    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      if (isNaN(month) || isNaN(year)) {
        return NextResponse.json(
          { error: "Vui lòng cung cấp tháng và năm hợp lệ." },
          { status: 400 }
        );
      }

      const where: any = {
        month,
        year,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      };

      if (body.classId && body.classId !== "ALL") {
        where.student = { classId: body.classId };
      }

      const dbBills = await prisma.monthlyBill.findMany({
        where,
        include: {
          student: {
            include: {
              user: {
                select: { fullName: true },
              },
              class: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: [
          { student: { class: { name: "asc" } } },
          { student: { user: { fullName: "asc" } } },
        ],
      });

      bills = dbBills as any;
    }

    if (!bills || bills.length === 0) {
      return NextResponse.json(
        { error: "Không có dữ liệu học sinh còn nợ để xuất PDF." },
        { status: 404 }
      );
    }

    const pdfBuffer = await generateDebtNotificationPdfBuffer(bills, {
      schoolName,
      month,
      year,
      className,
      layout,
    });

    const cleanClassName = className
      ? `_Lop_${className.replace(/\s+/g, "_")}`
      : "_Toan_Truong";
    const layoutSuffix =
      layout === "A5_LANDSCAPE_2UP" ? "_A5_Ngang" : "_A4_Doc";
    const fileName = `Thong_Bao_Phat_Hanh_Phieu_Thanh_Toan${cleanClassName}_T${String(
      month
    ).padStart(2, "0")}_${year}${layoutSuffix}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Lỗi xuất PDF thông báo phát hành phiếu thanh toán:", error);
    return NextResponse.json(
      {
        error: "Không thể xuất file PDF thông báo nợ",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
