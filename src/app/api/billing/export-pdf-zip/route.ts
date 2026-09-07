import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import JSZip from "jszip";
import {
  generateBillPdfBuffer,
  generateBillsCombinedPdfBuffer,
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
    const mode = searchParams.get("mode") || "SEPARATE_ZIP"; // "SEPARATE_ZIP", "CLASS_MERGED", "ALL_IN_ONE"

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

    // 4. Chuẩn hóa dữ liệu hóa đơn
    const mappedBills = bills.map((bill) => {
      const className = bill.student.class?.name || "Lop_Chua_Xac_Dinh";
      const studentName = bill.student.user?.fullName || "Hoc_Sinh";
      const boardingCode = bill.student.boardingCode || bill.student.studentCode;

      const billData: BillPdfData = {
        id: bill.id,
        month: bill.month,
        year: bill.year,
        scheduleMealDays: bill.scheduleMealDays,
        canceledDays: bill.canceledDays,
        scheduleReducedDays: bill.scheduleReducedDays,
        extraMealDays: bill.extraMealDays,
        previousDeduction: Number(bill.previousDeduction),
        previousAddition: Number(bill.previousAddition || 0),
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

      return {
        className,
        studentName,
        boardingCode,
        billData,
      };
    });

    const mm = String(month).padStart(2, "0");

    // ==========================================
    // NHÁNH 1: SEPARATE_ZIP (Logic hiện tại - Từng học sinh 1 file trong ZIP)
    // ==========================================
    if (mode === "SEPARATE_ZIP") {
      const zip = new JSZip();

      for (const item of mappedBills) {
        const pdfBuffer = await generateBillPdfBuffer(item.billData, schoolSettings);
        const folderName = `Lop_${item.className.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_")}`;
        const fileName = generateStudentBillFileName(
          item.className,
          item.studentName,
          month,
          year,
          item.boardingCode
        );
        zip.folder(folderName)!.file(fileName, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName =
        classId && classId !== "ALL"
          ? `Phieu_Tien_An_Lop_${(bills[0]?.student?.class?.name || classId).replace(/\s+/g, "_")}_T${mm}_${year}.zip`
          : `Phieu_Tien_An_Toan_Truong_T${mm}_${year}.zip`;

      return new NextResponse(zipBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ==========================================
    // NHÁNH 2: CLASS_MERGED (Gộp tất cả bill của lớp đó trong 1 file PDF)
    // ==========================================
    if (mode === "CLASS_MERGED") {
      // Gom nhóm theo lớp
      const classGroups: Record<string, BillPdfData[]> = {};
      for (const item of mappedBills) {
        if (!classGroups[item.className]) {
          classGroups[item.className] = [];
        }
        classGroups[item.className].push(item.billData);
      }

      const classNames = Object.keys(classGroups);

      // Nếu chỉ có 1 lớp (người dùng chọn lọc 1 lớp cụ thể): Tải trực tiếp file PDF
      if (classNames.length === 1) {
        const singleClassName = classNames[0];
        const pdfBuffer = await generateBillsCombinedPdfBuffer(classGroups[singleClassName], schoolSettings);
        const cleanClassName = singleClassName.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
        const pdfFileName = `Phieu_Tien_An_Lop_${cleanClassName}_T${mm}_${year}.pdf`;

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${pdfFileName}"`,
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      // Nếu xuất toàn trường (nhiều lớp): nén tất cả file PDF của từng lớp vào 1 file ZIP
      const zip = new JSZip();
      for (const cName of classNames) {
        const pdfBuffer = await generateBillsCombinedPdfBuffer(classGroups[cName], schoolSettings);
        const cleanClassName = cName.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
        const fileName = `Phieu_Tien_An_Lop_${cleanClassName}_T${mm}_${year}.pdf`;
        zip.file(fileName, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName = `Phieu_Tien_An_Theo_Lop_Gop_T${mm}_${year}.zip`;
      return new NextResponse(zipBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ==========================================
    // NHÁNH 3: ALL_IN_ONE (Gộp chung tất cả phiếu trong 1 file, không phân lớp)
    // ==========================================
    if (mode === "ALL_IN_ONE") {
      const allBillsData = mappedBills.map((b) => b.billData);
      const pdfBuffer = await generateBillsCombinedPdfBuffer(allBillsData, schoolSettings);

      const selectedClassName =
        classId && classId !== "ALL"
          ? `_Lop_${(bills[0]?.student?.class?.name || classId).replace(/\s+/g, "_")}`
          : "_Toan_Truong";
      const pdfFileName = `Phieu_Tien_An${selectedClassName}_Gop_Chung_T${mm}_${year}.pdf`;

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFileName}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json({ error: "Chế độ xuất không hợp lệ." }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi xuất file ZIP PDF:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xuất file ZIP: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
