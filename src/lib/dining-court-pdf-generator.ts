import { DiningCourt, DiningAllocationResult } from "@/lib/dining-court-service";

// Lấy pdfmake và vfs_fonts (hỗ trợ đầy đủ tiếng Việt unicode)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsFonts = require("pdfmake/build/vfs_fonts");

let fontsInitialized = false;

function ensureFonts() {
  if (fontsInitialized) return;
  const vfs = vfsFonts.pdfMake ? vfsFonts.pdfMake.vfs : vfsFonts;
  for (const [file, b64] of Object.entries(vfs)) {
    pdfmake.virtualfs.writeFileSync(file, Buffer.from(b64 as string, "base64"));
  }

  pdfmake.setFonts({
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });
  fontsInitialized = true;
}

export interface DiningPdfOptions {
  schoolName?: string;
  shiftFilter?: "ALL" | "TIET_4" | "TIET_5";
}

function formatDateDisplay(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * Sinh Buffer PDF điểm danh học sinh nhận cơm cho danh sách sân
 */
export async function generateDiningCourtsPdfBuffer(
  allocation: DiningAllocationResult,
  options?: DiningPdfOptions
): Promise<Buffer> {
  ensureFonts();

  const schoolName = options?.schoolName || "TRƯỜNG TIỂU HỌC BÁN TRÚ";
  const shiftFilter = options?.shiftFilter || "ALL";

  // Lọc danh sách sân cần in
  let courtsToPrint: DiningCourt[] = [];
  if (shiftFilter === "TIET_4") {
    courtsToPrint = allocation.shifts.TIET_4.courts;
  } else if (shiftFilter === "TIET_5") {
    courtsToPrint = allocation.shifts.TIET_5.courts;
  } else {
    courtsToPrint = [
      ...allocation.shifts.TIET_4.courts,
      ...allocation.shifts.TIET_5.courts,
    ];
  }

  if (courtsToPrint.length === 0) {
    // Không có sân nào
    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { font: "Roboto", fontSize: 10 },
      content: [
        { text: schoolName.toUpperCase(), bold: true, fontSize: 12, alignment: "center" },
        { text: "DANH SÁCH ĐIỂM DANH HỌC SINH NHẬN CƠM BÁN TRÚ", bold: true, fontSize: 14, margin: [0, 10, 0, 10], alignment: "center" },
        { text: `Không có dữ liệu sân ăn cho ngày ${formatDateDisplay(allocation.date)}`, italics: true, alignment: "center", color: "#64748b" },
      ],
    };
    const doc = pdfmake.createPdf(docDefinition);
    return await doc.getBuffer();
  }

  const content: any[] = [];

  courtsToPrint.forEach((court, courtIdx) => {
    const isLastCourt = courtIdx === courtsToPrint.length - 1;
    const shiftLabel = court.shift === "TIET_4" ? "TIẾT 4 (ĂN CA 1)" : "TIẾT 5 (ĂN CA 2)";
    const statusText = allocation.isAfterLockTime ? "ĐÃ CHỐT SỐ BÁO BẾP" : "SỐ LIỆU TẠM (CHƯA CHỐT)";
    const statusColor = allocation.isAfterLockTime ? "#059669" : "#dc2626";

    // Danh sách lớp tại sân
    const classDetailStr = court.classes
      .map((c) => `${c.className} (${c.totalMeals} suất)`)
      .join(" + ");

    // 1. Header trang của Sân
    content.push({
      columns: [
        {
          width: "*",
          stack: [
            { text: schoolName.toUpperCase(), bold: true, fontSize: 10, color: "#1e293b" },
            { text: "BỘ PHẬN QUẢN LÝ BÁN TRÚ", fontSize: 8, color: "#64748b" },
          ],
        },
        {
          width: "auto",
          alignment: "right",
          stack: [
            { text: `Ngày ăn: ${formatDateDisplay(allocation.date)} (${allocation.dayOfWeekName})`, fontSize: 9, bold: true },
            { text: `Trạng thái: ${statusText}`, fontSize: 8, bold: true, color: statusColor },
          ],
        },
      ],
      margin: [0, 0, 0, 10],
    });

    // 2. Tiêu đề lớn
    content.push({
      text: "DANH SÁCH ĐIỂM DANH HỌC SINH NHẬN CƠM BÁN TRÚ",
      fontSize: 13,
      bold: true,
      alignment: "center",
      color: "#0f172a",
      margin: [0, 0, 0, 2],
    });

    content.push({
      text: `${court.courtName.toUpperCase()} - ${shiftLabel}`,
      fontSize: 12,
      bold: true,
      alignment: "center",
      color: "#1d4ed8",
      margin: [0, 0, 0, 8],
    });

    // 3. Khung thông tin tổng hợp suất ăn của Sân
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              fillColor: "#f8fafc",
              border: [true, true, true, true],
              borderColor: ["#cbd5e1", "#cbd5e1", "#cbd5e1", "#cbd5e1"],
              stack: [
                {
                  columns: [
                    { text: [{ text: "Lớp tham gia: ", bold: true }, classDetailStr], fontSize: 9.5 },
                    {
                      text: [
                        { text: "Tổng suất sân: ", bold: true },
                        { text: `${court.totalMeals} suất`, bold: true, color: "#1d4ed8", fontSize: 11 },
                      ],
                      alignment: "right",
                      fontSize: 9.5,
                    },
                  ],
                },
                {
                  text: `Chi tiết chia món: Mặn: ${court.manCount}  |  Chay: ${court.chayCount}  |  Cháo: ${court.chaoCount}`,
                  fontSize: 8.5,
                  italics: true,
                  color: "#475569",
                  margin: [0, 3, 0, 0],
                },
              ],
              margin: [4, 4, 4, 4],
            },
          ],
        ],
      },
      margin: [0, 0, 0, 10],
    });

    // 4. Bảng danh sách học sinh
    const tableBody: any[] = [
      [
        { text: "STT", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Mã bán trú", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Họ và tên học sinh", bold: true, alignment: "left", fillColor: "#f1f5f9" },
        { text: "Lớp", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Suất ăn", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Điểm danh nhận cơm", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Ghi chú", bold: true, alignment: "center", fillColor: "#f1f5f9" },
      ],
    ];

    court.students.forEach((student, sIdx) => {
      let mealText = "Mặn";
      let mealColor = "#0f172a";
      if (student.mealType === "CHAY") {
        mealText = "CHAY";
        mealColor = "#059669";
      } else if (student.mealType === "CHAO") {
        mealText = "CHÁO";
        mealColor = "#d97706";
      }

      tableBody.push([
        { text: String(sIdx + 1), alignment: "center", fontSize: 9 },
        { text: student.boardingCode || "—", alignment: "center", fontSize: 8.5, bold: true, color: "#1d4ed8" },
        { text: student.fullName, alignment: "left", bold: true, fontSize: 9 },
        { text: student.className, alignment: "center", fontSize: 9 },
        { text: mealText, alignment: "center", bold: student.mealType !== "MAN", color: mealColor, fontSize: 9 },
        { text: "[    ]", alignment: "center", fontSize: 10, color: "#64748b" }, // Ô điểm danh cho GV tích
        { text: "", alignment: "center", fontSize: 8.5 },
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [25, 65, "*", 45, 50, 80, 55],
        body: tableBody,
      },
      margin: [0, 0, 0, 15],
    });

    // 5. Phần chân trang & Chữ ký
    content.push({
      columns: [
        {
          width: "*",
          stack: [
            {
              text: `Tổng số học sinh đã nhận cơm: ........... / ${court.totalMeals} suất`,
              bold: true,
              fontSize: 9.5,
            },
            {
              text: `(Số suất dư/thiếu: .....................................................)`,
              fontSize: 8.5,
              italics: true,
              color: "#475569",
              margin: [0, 2, 0, 0],
            },
          ],
        },
        {
          width: 180,
          alignment: "center",
          stack: [
            { text: "Giáo viên phụ trách sân", bold: true, fontSize: 9.5 },
            { text: "(Ký và ghi rõ họ tên)", fontSize: 8, italics: true, color: "#64748b" },
            { text: "", margin: [0, 25, 0, 0] },
            { text: "....................................................", color: "#94a3b8" },
          ],
        },
      ],
      margin: [0, 5, 0, 0],
    });

    // 6. Ngắt trang giữa các sân
    if (!isLastCourt) {
      content.push({ text: "", pageBreak: "after" });
    }
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 25, 30, 25],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      lineHeight: 1.15,
    },
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: "black",
      },
    },
    content,
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
