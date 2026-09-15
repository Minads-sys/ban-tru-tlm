import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import JSZip from "jszip";
import {
  generateDebtNotificationPdfBuffer,
  generateStudentDebtFileName,
  DebtNotificationPdfBill,
  DebtNotificationLayout,
} from "@/lib/debt-notification-pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);
    const classId = searchParams.get("classId");
    const mode = searchParams.get("mode") || "CLASS_MERGED"; // "CLASS_MERGED", "ALL_IN_ONE", "SEPARATE_ZIP"
    const layout = (searchParams.get("layout") as DebtNotificationLayout) || "A4_PORTRAIT_4UP";

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp tháng và năm hợp lệ." },
        { status: 400 }
      );
    }

    // 1. Lấy thông tin cài đặt trường học
    const schoolSetting = await prisma.systemSetting.findUnique({
      where: { key: "SCHOOL_NAME" },
    });
    const schoolName = schoolSetting?.value || "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN";

    // 2. Xây dựng điều kiện lọc hóa đơn (Chỉ xuất học sinh còn nợ tiền ăn)
    const where: any = {
      month,
      year,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    };

    if (classId && classId !== "ALL") {
      where.student = {
        classId,
      };
    }

    // 3. Lấy toàn bộ danh sách hóa đơn cần xuất
    const bills = await prisma.monthlyBill.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
            class: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { student: { class: { name: "asc" } } },
        { student: { boardingCode: "asc" } },
        { student: { user: { fullName: "asc" } } },
      ],
    });

    if (bills.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy học sinh nào còn nợ tiền ăn phù hợp với bộ lọc." },
        { status: 404 }
      );
    }

    // 4. Chuẩn hóa dữ liệu học sinh thành DebtNotificationPdfBill
    const mappedBills: DebtNotificationPdfBill[] = bills.map((bill) => ({
      id: bill.id,
      month: bill.month,
      year: bill.year,
      student: {
        id: bill.student.id,
        studentCode: bill.student.studentCode,
        boardingCode: bill.student.boardingCode,
        birthDate: bill.student.birthDate,
        user: {
          fullName: bill.student.user?.fullName || "Học sinh",
        },
        class: {
          name: bill.student.class?.name || "Chưa xác định",
        },
      },
    }));

    const mm = String(month).padStart(2, "0");
    const layoutSuffix = layout === "A5_LANDSCAPE_2UP" ? "_A5_Ngang" : "_A4_Doc";

    // ==========================================
    // NHÁNH 1: SEPARATE_ZIP (Từng học sinh 1 file riêng trong ZIP)
    // ==========================================
    if (mode === "SEPARATE_ZIP") {
      const zip = new JSZip();

      for (const bill of mappedBills) {
        const className = bill.student.class?.name || "Lop_Chua_Xac_Dinh";
        const studentName = bill.student.user?.fullName || "Hoc_Sinh";
        const boardingCode = bill.student.boardingCode || bill.student.studentCode;

        // Sinh file PDF khổ A6 đơn cho từng học sinh
        const pdfBuffer = await generateDebtNotificationPdfBuffer([bill], {
          schoolName,
          month,
          year,
          className,
          layout: "A6_SINGLE",
        });

        const folderName = `Lop_${className.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_")}`;
        const fileName = generateStudentDebtFileName(className, studentName, month, year, boardingCode);
        zip.folder(folderName)!.file(fileName, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName =
        classId && classId !== "ALL"
          ? `Thong_Bao_No_Lop_${(bills[0]?.student?.class?.name || classId).replace(/\s+/g, "_")}_T${mm}_${year}.zip`
          : `Thong_Bao_No_Toan_Truong_T${mm}_${year}.zip`;

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
    // NHÁNH 2: CLASS_MERGED (Gộp tất cả thông báo nợ của lớp trong 1 file PDF)
    // ==========================================
    if (mode === "CLASS_MERGED") {
      // Gom nhóm theo lớp
      const classGroups: Record<string, DebtNotificationPdfBill[]> = {};
      for (const bill of mappedBills) {
        const cName = bill.student.class?.name || "Lop_Chua_Xac_Dinh";
        if (!classGroups[cName]) {
          classGroups[cName] = [];
        }
        classGroups[cName].push(bill);
      }

      const classNames = Object.keys(classGroups);

      // Nếu chỉ có 1 lớp (người dùng chọn lọc 1 lớp cụ thể): Tải trực tiếp file PDF
      if (classNames.length === 1) {
        const singleClassName = classNames[0];
        const pdfBuffer = await generateDebtNotificationPdfBuffer(classGroups[singleClassName], {
          schoolName,
          month,
          year,
          className: singleClassName,
          layout,
        });
        const cleanClassName = singleClassName.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
        const pdfFileName = `Thong_Bao_No_Lop_${cleanClassName}_T${mm}_${year}${layoutSuffix}.pdf`;

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
        const pdfBuffer = await generateDebtNotificationPdfBuffer(classGroups[cName], {
          schoolName,
          month,
          year,
          className: cName,
          layout,
        });
        const cleanClassName = cName.replace(/[/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
        const fileName = `Thong_Bao_No_Lop_${cleanClassName}_T${mm}_${year}${layoutSuffix}.pdf`;
        zip.file(fileName, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName = `Thong_Bao_No_Theo_Lop_T${mm}_${year}${layoutSuffix}.zip`;
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
    // NHÁNH 3: ALL_IN_ONE (Gộp chung tất cả thông báo nợ trong 1 file, không phân lớp)
    // ==========================================
    if (mode === "ALL_IN_ONE") {
      const selectedClassName =
        classId && classId !== "ALL"
          ? bills[0]?.student?.class?.name
          : undefined;

      const pdfBuffer = await generateDebtNotificationPdfBuffer(mappedBills, {
        schoolName,
        month,
        year,
        className: selectedClassName,
        layout,
      });

      const cleanClassName = selectedClassName
        ? `_Lop_${selectedClassName.replace(/\s+/g, "_")}`
        : "_Toan_Truong";
      const pdfFileName = `Thong_Bao_No${cleanClassName}_Gop_Chung_T${mm}_${year}${layoutSuffix}.pdf`;

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
    console.error("Lỗi xuất file PDF thông báo nợ:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xuất file PDF: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
