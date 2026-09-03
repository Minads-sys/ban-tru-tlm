import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import JSZip from "jszip";
import {
  generateBillPdfBuffer,
  generateStudentBillFileName,
  BillPdfData,
  SchoolPdfSettings,
} from "@/lib/bill-pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);
    const classId = searchParams.get("classId");
    const status = searchParams.get("status"); // "ALL", "DEBT", "UNPAID", "PAID"

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp tháng và năm hợp lệ." },
        { status: 400 }
      );
    }

    // 1. Lấy thông tin cài đặt trường học
    const settingsList = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "SCHOOL_NAME",
            "SCHOOL_ADDRESS",
            "SCHOOL_PHONE",
            "VIETQR_BANK_BIN",
            "VIETQR_ACCOUNT_NO",
            "VIETQR_ACCOUNT_NAME",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {};
    settingsList.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const schoolSettings: SchoolPdfSettings = {
      schoolName: settingsMap["SCHOOL_NAME"] || "TRƯỜNG TIỂU HỌC BAN TRÚ",
      schoolAddress: settingsMap["SCHOOL_ADDRESS"] || "",
      schoolPhone: settingsMap["SCHOOL_PHONE"] || "",
      bankBin: settingsMap["VIETQR_BANK_BIN"] || "970418",
      accountNo: settingsMap["VIETQR_ACCOUNT_NO"] || "96247BANTRUTLM08",
      accountName: settingsMap["VIETQR_ACCOUNT_NAME"] || "HOANG KIM",
    };

    // 2. Xây dựng điều kiện lọc hóa đơn
    const where: any = {
      month,
      year,
    };

    if (classId && classId !== "ALL") {
      where.student = {
        classId,
      };
    }

    if (status === "DEBT") {
      where.paymentStatus = { in: ["UNPAID", "PARTIAL"] };
    } else if (status && status !== "ALL") {
      where.paymentStatus = status;
    }

    // Khoảng thời gian hủy suất ăn của tháng trước
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));

    // 3. Lấy toàn bộ danh sách hóa đơn cần xuất
    const bills = await prisma.monthlyBill.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                fullName: true,
                username: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            mealCancellations: {
              where: {
                status: "APPROVED",
                cancelDate: {
                  gte: prevMonthStart,
                  lte: prevMonthEnd,
                },
              },
              select: {
                cancelDate: true,
              },
              orderBy: {
                cancelDate: "asc",
              },
            },
          },
        },
      },
      orderBy: [
        { student: { class: { name: "asc" } } },
        { student: { boardingCode: "asc" } },
      ],
    });

    if (bills.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy hóa đơn nào phù hợp với bộ lọc." },
        { status: 404 }
      );
    }

    // 4. Khởi tạo JSZip
    const zip = new JSZip();

    // 5. Sinh PDF cho từng học sinh và đưa vào thư mục lớp tương ứng
    for (const bill of bills) {
      const className = bill.student.class?.name || "Lop_Chua_Xac_Dinh";
      const studentName = bill.student.user?.fullName || "Hoc_Sinh";
      const boardingCode = bill.student.boardingCode || bill.student.studentCode;

      const billData: BillPdfData = {
        id: bill.id,
        month: bill.month,
        year: bill.year,
        scheduleMealDays: bill.scheduleMealDays,
        canceledDays: bill.canceledDays,
        previousDeduction: Number(bill.previousDeduction),
        unitPrice: Number(bill.unitPrice),
        finalAmount: Number(bill.finalAmount),
        paymentStatus: bill.paymentStatus,
        student: {
          studentCode: bill.student.studentCode,
          boardingCode: bill.student.boardingCode,
          fullName: studentName,
          className,
          mealType: bill.student.mealType,
          mealCancellations: bill.student.mealCancellations,
        },
      };

      // Tạo PDF Buffer
      const pdfBuffer = await generateBillPdfBuffer(billData, schoolSettings);

      // Tên thư mục lớp: Lop_{TenLop}
      const folderName = `Lop_${className.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_")}`;

      // Tên file theo đúng yêu cầu: Lop_ho_tên_thang_năm_Mã ban trú.pdf
      const fileName = generateStudentBillFileName(
        className,
        studentName,
        bill.month,
        bill.year,
        boardingCode
      );

      // Thêm file vào thư mục lớp trong ZIP
      zip.folder(folderName)!.file(fileName, pdfBuffer);
    }

    // 6. Đóng gói ZIP
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const mm = String(month).padStart(2, "0");
    const zipFileName =
      classId && classId !== "ALL"
        ? `Phieu_Tien_An_Lop_${(bills[0]?.student?.class?.name || classId).replace(/\s+/g, "_")}_T${mm}_${year}.zip`
        : `Phieu_Tien_An_Toan_Truong_T${mm}_${year}.zip`;

    // 7. Trả về response tải file
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Lỗi xuất file ZIP PDF:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xuất file ZIP: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
