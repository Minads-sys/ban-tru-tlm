import { DiningCourt, DiningAllocationResult, WeeklyDiningMatrixResult } from "@/lib/dining-court-service";
import { splitVietnameseName, compareVietnameseNames } from "@/lib/utils";

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

    // Đảm bảo học sinh được sắp xếp theo từng Lớp, trong mỗi lớp theo TÊN ABC (A - Z)
    court.classes.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));
    court.students.sort((a, b) => {
      const cmpClass = a.className.localeCompare(b.className, "vi", { numeric: true });
      if (cmpClass !== 0) return cmpClass;
      return compareVietnameseNames(a.fullName, b.fullName);
    });

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

    const cartTitle = court.cartName ? `${court.cartName.toUpperCase()} - ` : "";
    content.push({
      text: `${court.courtName.toUpperCase()} - ${cartTitle}${shiftLabel}`,
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
    // 4. Bảng danh sách học sinh (Tách riêng cột Họ và đệm + Tên)
    const tableBody: any[] = [
      [
        { text: "STT", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Mã bán trú", bold: true, alignment: "center", fillColor: "#f1f5f9" },
        { text: "Họ và đệm", bold: true, alignment: "left", fillColor: "#f1f5f9" },
        { text: "Tên", bold: true, alignment: "left", fillColor: "#f1f5f9" },
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

      const { lastName, firstName } =
        student.firstName && student.lastName
          ? { lastName: student.lastName, firstName: student.firstName }
          : splitVietnameseName(student.fullName);

      tableBody.push([
        { text: String(sIdx + 1), alignment: "center", fontSize: 9 },
        { text: student.boardingCode || "—", alignment: "center", fontSize: 8.5, bold: true, color: "#1d4ed8" },
        { text: lastName, alignment: "left", fontSize: 9 },
        { text: firstName, alignment: "left", bold: true, fontSize: 9.5, color: "#0f172a" },
        { text: student.className, alignment: "center", fontSize: 9 },
        { text: mealText, alignment: "center", bold: student.mealType !== "MAN", color: mealColor, fontSize: 9 },
        { text: "[    ]", alignment: "center", fontSize: 10, color: "#64748b" }, // Ô điểm danh cho GV tích
        { text: "", alignment: "center", fontSize: 8.5 },
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [22, 60, "*", 52, 42, 48, 75, 50],
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

/**
 * Sinh Buffer PDF Bảng tổng hợp tập kết suất ăn theo Sân (phân loại Tiết 4 và Tiết 5)
 */
export async function generateDiningCourtsSummaryPdfBuffer(
  allocation: DiningAllocationResult,
  options?: DiningPdfOptions
): Promise<Buffer> {
  ensureFonts();

  const schoolName = options?.schoolName || "TRƯỜNG TIỂU HỌC BÁN TRÚ";
  const shiftFilter = options?.shiftFilter || "ALL";

  const showTiet4 = shiftFilter === "ALL" || shiftFilter === "TIET_4";
  const showTiet5 = shiftFilter === "ALL" || shiftFilter === "TIET_5";

  const tiet4Courts = allocation.shifts.TIET_4.courts;
  const tiet5Courts = allocation.shifts.TIET_5.courts;

  const tiet4Man = tiet4Courts.reduce((acc, c) => acc + c.manCount, 0);
  const tiet4Chay = tiet4Courts.reduce((acc, c) => acc + c.chayCount, 0);
  const tiet4Chao = tiet4Courts.reduce((acc, c) => acc + c.chaoCount, 0);

  const tiet5Man = tiet5Courts.reduce((acc, c) => acc + c.manCount, 0);
  const tiet5Chay = tiet5Courts.reduce((acc, c) => acc + c.chayCount, 0);
  const tiet5Chao = tiet5Courts.reduce((acc, c) => acc + c.chaoCount, 0);

  const totalMan = tiet4Man + tiet5Man;
  const totalChay = tiet4Chay + tiet5Chay;
  const totalChao = tiet4Chao + tiet5Chao;

  const statusText = allocation.isAfterLockTime
    ? "ĐÃ CHỐT SỐ BÁO BẾP"
    : "SỐ LIỆU TẠM (CHƯA CHỐT)";
  const statusColor = allocation.isAfterLockTime ? "#059669" : "#dc2626";

  const content: any[] = [];

  // 1. Header văn bản
  content.push({
    columns: [
      {
        width: "*",
        stack: [
          { text: schoolName.toUpperCase(), bold: true, fontSize: 10, color: "#1e293b" },
          { text: "BỘ PHẬN NHÀ BẾP & QUẢN LÝ BÁN TRÚ", fontSize: 8.5, color: "#64748b", margin: [0, 2, 0, 0] },
        ],
      },
      {
        width: "auto",
        alignment: "right",
        stack: [
          { text: `Ngày ăn: ${formatDateDisplay(allocation.date)} (${allocation.dayOfWeekName})`, fontSize: 9.5, bold: true },
          { text: `Trạng thái: ${statusText}`, fontSize: 8.5, bold: true, color: statusColor, margin: [0, 2, 0, 0] },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  // 2. Tiêu đề
  content.push({
    text: "BẢNG TẬP KẾT SUẤT ĂN THEO SÂN BÁN TRÚ",
    fontSize: 14,
    bold: true,
    alignment: "center",
    color: "#0f172a",
    margin: [0, 4, 0, 2],
  });
  content.push({
    text: "(Dùng cho nhân viên bếp tập kết khay ăn và giáo viên nhận bàn giao tại từng sân)",
    fontSize: 8.5,
    italics: true,
    alignment: "center",
    color: "#475569",
    margin: [0, 0, 0, 8],
  });

  // 3. Khung thống kê nhanh toàn trường
  content.push({
    table: {
      widths: ["*"],
      body: [
        [
          {
            fillColor: "#f8fafc",
            borderColor: ["#cbd5e1", "#cbd5e1", "#cbd5e1", "#cbd5e1"],
            stack: [
              {
                columns: [
                  {
                    text: [
                      { text: "TỔNG TOÀN TRƯỜNG: ", bold: true },
                      { text: `${allocation.totalCourts} SÂN (${allocation.totalCarts || Math.ceil(allocation.totalCourts / 2)} XE)`, bold: true, color: "#1d4ed8" },
                      { text: "  |  Tổng suất ăn: ", bold: true },
                      { text: `${allocation.totalMeals} suất`, bold: true, color: "#1d4ed8" },
                      { text: ` (Mặn: ${totalMan} | Chay: ${totalChay} | Cháo: ${totalChao})`, fontSize: 8.5, color: "#475569" },
                    ],
                    fontSize: 9.5,
                  },
                ],
              },
              {
                columns: [
                  {
                    text: `• Tiết 4 (Ăn ca 1): ${allocation.shifts.TIET_4.totalCourts} sân - ${allocation.shifts.TIET_4.totalMeals} suất`,
                    fontSize: 8.5,
                    color: "#c2410c",
                    bold: true,
                  },
                  {
                    text: `• Tiết 5 (Ăn ca 2): ${allocation.shifts.TIET_5.totalCourts} sân - ${allocation.shifts.TIET_5.totalMeals} suất`,
                    fontSize: 8.5,
                    color: "#4338ca",
                    bold: true,
                    alignment: "right",
                  },
                ],
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

  // 4. MỤC I - SÂN TIẾT 4
  if (showTiet4) {
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              fillColor: "#ea580c",
              border: [false, false, false, false],
              text: `I - SÂN TIẾT 4 (ĂN CA 1 - 10H45): ${allocation.shifts.TIET_4.totalCourts} SÂN - ${allocation.shifts.TIET_4.totalMeals} SUẤT (Mặn: ${tiet4Man} | Chay: ${tiet4Chay} | Cháo: ${tiet4Chao})`,
              bold: true,
              color: "#ffffff",
              fontSize: 10,
              margin: [4, 2, 4, 2],
            },
          ],
        ],
      },
      margin: [0, 4, 0, 4],
    });

    if (tiet4Courts.length === 0) {
      content.push({
        text: "Không có lớp nào ăn bán trú Tiết 4 trong ngày này.",
        italics: true,
        fontSize: 8.5,
        color: "#64748b",
        margin: [4, 2, 0, 8],
      });
    } else {
      const t4Rows: any[] = [
        [
          { text: "Xe", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "STT / Sân", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "Các lớp tại sân", bold: true, alignment: "left", fillColor: "#ffedd5" },
          { text: "Tổng suất", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "Mặn", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "Chay", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "Cháo", bold: true, alignment: "center", fillColor: "#ffedd5" },
          { text: "Ký nhận / Bàn giao", bold: true, alignment: "center", fillColor: "#ffedd5" },
        ],
      ];

      tiet4Courts.forEach((court, idx) => {
        const isSameCartAsPrev = idx > 0 && tiet4Courts[idx - 1].cartNumber === court.cartNumber;
        const isSharedWithNext = idx + 1 < tiet4Courts.length && tiet4Courts[idx + 1].cartNumber === court.cartNumber;
        const classNamesStr = court.classes.map((c) => `${c.className} (${c.totalMeals})`).join(" + ");

        const rowCells: any[] = [];
        if (isSameCartAsPrev) {
          rowCells.push({});
        } else {
          rowCells.push({
            text: court.cartName || `Xe ${court.cartNumber}`,
            alignment: "center",
            bold: true,
            fontSize: 9,
            rowSpan: isSharedWithNext ? 2 : 1,
          });
        }

        rowCells.push(
          { text: court.courtName, alignment: "center", bold: true, fontSize: 9 },
          { text: classNamesStr, alignment: "left", fontSize: 8.5 },
          { text: String(court.totalMeals), alignment: "center", bold: true, fontSize: 9.5, color: "#c2410c" },
          { text: String(court.manCount), alignment: "center", fontSize: 9 },
          { text: String(court.chayCount), alignment: "center", fontSize: 9, bold: court.chayCount > 0, color: court.chayCount > 0 ? "#059669" : "#0f172a" },
          { text: String(court.chaoCount), alignment: "center", fontSize: 9, bold: court.chaoCount > 0, color: court.chaoCount > 0 ? "#d97706" : "#0f172a" },
          { text: "[   ] ....................", alignment: "center", fontSize: 8, color: "#64748b" }
        );
        t4Rows.push(rowCells);
      });

      // Dòng tổng kết Tiết 4
      t4Rows.push([
        { text: "TỔNG TIẾT 4", colSpan: 3, bold: true, alignment: "center", fillColor: "#fef3c7" },
        {},
        {},
        { text: String(allocation.shifts.TIET_4.totalMeals), bold: true, alignment: "center", fillColor: "#fef3c7", color: "#c2410c" },
        { text: String(tiet4Man), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: String(tiet4Chay), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: String(tiet4Chao), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: `${tiet4Courts.length} sân`, bold: true, alignment: "center", fillColor: "#fef3c7" },
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: [36, 44, 155, 48, 38, 38, 38, "*"],
          body: t4Rows,
        },
        margin: [0, 0, 0, 10],
      });
    }
  }

  // 5. MỤC II - SÂN TIẾT 5
  if (showTiet5) {
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              fillColor: "#4338ca",
              border: [false, false, false, false],
              text: `II - SÂN TIẾT 5 (ĂN CA 2 - 11H35): ${allocation.shifts.TIET_5.totalCourts} SÂN - ${allocation.shifts.TIET_5.totalMeals} SUẤT (Mặn: ${tiet5Man} | Chay: ${tiet5Chay} | Cháo: ${tiet5Chao})`,
              bold: true,
              color: "#ffffff",
              fontSize: 10,
              margin: [4, 2, 4, 2],
            },
          ],
        ],
      },
      margin: [0, 6, 0, 4],
    });

    if (tiet5Courts.length === 0) {
      content.push({
        text: "Không có lớp nào ăn bán trú Tiết 5 trong ngày này.",
        italics: true,
        fontSize: 8.5,
        color: "#64748b",
        margin: [4, 2, 0, 8],
      });
    } else {
      const t5Rows: any[] = [
        [
          { text: "Xe", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "STT / Sân", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "Các lớp tại sân", bold: true, alignment: "left", fillColor: "#e0e7ff" },
          { text: "Tổng suất", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "Mặn", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "Chay", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "Cháo", bold: true, alignment: "center", fillColor: "#e0e7ff" },
          { text: "Ký nhận / Bàn giao", bold: true, alignment: "center", fillColor: "#e0e7ff" },
        ],
      ];

      tiet5Courts.forEach((court, idx) => {
        const isSameCartAsPrev = idx > 0 && tiet5Courts[idx - 1].cartNumber === court.cartNumber;
        const isSharedWithNext = idx + 1 < tiet5Courts.length && tiet5Courts[idx + 1].cartNumber === court.cartNumber;
        const classNamesStr = court.classes.map((c) => `${c.className} (${c.totalMeals})`).join(" + ");

        const rowCells: any[] = [];
        if (isSameCartAsPrev) {
          rowCells.push({});
        } else {
          rowCells.push({
            text: court.cartName || `Xe ${court.cartNumber}`,
            alignment: "center",
            bold: true,
            fontSize: 9,
            rowSpan: isSharedWithNext ? 2 : 1,
          });
        }

        rowCells.push(
          { text: court.courtName, alignment: "center", bold: true, fontSize: 9 },
          { text: classNamesStr, alignment: "left", fontSize: 8.5 },
          { text: String(court.totalMeals), alignment: "center", bold: true, fontSize: 9.5, color: "#4338ca" },
          { text: String(court.manCount), alignment: "center", fontSize: 9 },
          { text: String(court.chayCount), alignment: "center", fontSize: 9, bold: court.chayCount > 0, color: court.chayCount > 0 ? "#059669" : "#0f172a" },
          { text: String(court.chaoCount), alignment: "center", fontSize: 9, bold: court.chaoCount > 0, color: court.chaoCount > 0 ? "#d97706" : "#0f172a" },
          { text: "[   ] ....................", alignment: "center", fontSize: 8, color: "#64748b" }
        );
        t5Rows.push(rowCells);
      });

      // Dòng tổng kết Tiết 5
      t5Rows.push([
        { text: "TỔNG TIẾT 5", colSpan: 3, bold: true, alignment: "center", fillColor: "#fef3c7" },
        {},
        {},
        { text: String(allocation.shifts.TIET_5.totalMeals), bold: true, alignment: "center", fillColor: "#fef3c7", color: "#4338ca" },
        { text: String(tiet5Man), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: String(tiet5Chay), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: String(tiet5Chao), bold: true, alignment: "center", fillColor: "#fef3c7" },
        { text: `${tiet5Courts.length} sân`, bold: true, alignment: "center", fillColor: "#fef3c7" },
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: [36, 44, 155, 48, 38, 38, 38, "*"],
          body: t5Rows,
        },
        margin: [0, 0, 0, 10],
      });
    }
  }

  // 6. Ghi chú & Chữ ký bàn giao
  content.push({
    text: "* Lưu ý cho nhân viên bếp: Tập kết đúng và đủ số suất ăn (Mặn / Chay / Cháo) đến từng sân trước giờ ăn (Tiết 4 lúc 10g30, Tiết 5 lúc 11g20). Giáo viên trực sân nhận bàn giao và đối chiếu trước khi chia cho học sinh.",
    italics: true,
    fontSize: 8,
    color: "#475569",
    margin: [0, 6, 0, 15],
  });

  content.push({
    columns: [
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Người lập bảng", bold: true, fontSize: 9 },
          { text: "(Ký, ghi rõ họ tên)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 30, 0, 0] },
          { text: "....................................................", color: "#cbd5e1" },
        ],
      },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Nhân viên bếp giao cơm", bold: true, fontSize: 9 },
          { text: "(Ký, ghi rõ họ tên)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 30, 0, 0] },
          { text: "....................................................", color: "#cbd5e1" },
        ],
      },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Quản trị bán trú / GV trực nhận", bold: true, fontSize: 9 },
          { text: "(Ký, ghi rõ họ tên)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 30, 0, 0] },
          { text: "....................................................", color: "#cbd5e1" },
        ],
      },
    ],
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [25, 20, 25, 20],
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

/**
 * Sinh Buffer PDF Bảng thống kê phân bổ sân ăn theo Tuần (Ma trận Lớp x Thứ 2 - Thứ 6)
 */
export async function generateWeeklyDiningMatrixPdfBuffer(
  matrix: WeeklyDiningMatrixResult,
  options?: { schoolName?: string }
): Promise<Buffer> {
  ensureFonts();

  const schoolName = options?.schoolName || "TRƯỜNG TIỂU HỌC BÁN TRÚ";
  const { weekInfo, days, rows } = matrix;

  const content: any[] = [];

  // 1. Header Đơn vị & Mẫu biểu
  content.push({
    columns: [
      {
        width: "*",
        stack: [
          { text: schoolName.toUpperCase(), fontSize: 10, bold: true },
          { text: "Bộ phận Quản lý Bán trú", fontSize: 8.5, color: "#334155", margin: [0, 1, 0, 0] },
        ],
      },
      {
        width: "auto",
        alignment: "right",
        stack: [
          { text: "Mẫu: TK-02/BT", fontSize: 9, bold: true },
          {
            text: `Ngày in: ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
            fontSize: 8,
            italics: true,
            color: "#64748b",
            margin: [0, 1, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  // 2. Tiêu đề
  content.push({
    text: `THỐNG KÊ SÂN ĂN BÁN TRÚ NĂM HỌC ${weekInfo.schoolYear}`,
    fontSize: 13,
    bold: true,
    alignment: "center",
    color: "#0f172a",
    margin: [0, 2, 0, 2],
  });

  content.push({
    text: `TUẦN ${weekInfo.schoolWeekNumber} (${weekInfo.formattedRange})`,
    fontSize: 10.5,
    bold: true,
    alignment: "center",
    color: "#1e293b",
    margin: [0, 0, 0, 12],
  });

  // 3. Bảng ma trận
  const tableBody: any[][] = [];

  // Hàng Header 1: Lớp, Thứ 2 -> Thứ 6
  const headerRow1: any[] = [
    {
      text: "Lớp",
      rowSpan: 2,
      bold: true,
      alignment: "center",
      fillColor: "#e2e8f0",
      margin: [0, 7, 0, 0],
      fontSize: 9.5,
    },
  ];

  days.forEach((day) => {
    headerRow1.push({
      text: day.dayLabel,
      bold: true,
      alignment: "center",
      fillColor: "#e2e8f0",
      fontSize: 9.5,
      margin: [0, 2, 0, 2],
    });
  });
  tableBody.push(headerRow1);

  // Hàng Header 2: P.ĂN dưới mỗi thứ
  const headerRow2: any[] = [{}];
  days.forEach(() => {
    headerRow2.push({
      text: "P.ĂN",
      bold: true,
      alignment: "center",
      fillColor: "#f1f5f9",
      fontSize: 8,
      margin: [0, 1, 0, 1],
    });
  });
  tableBody.push(headerRow2);

  // Rows dữ liệu từng lớp
  if (rows.length === 0) {
    tableBody.push([
      {
        text: "Chưa có dữ liệu phân bổ sân cho tuần này",
        colSpan: 6,
        alignment: "center",
        italics: true,
        color: "#64748b",
        margin: [0, 10, 0, 10],
      },
      {}, {}, {}, {}, {},
    ]);
  } else {
    let hasRenderedSpecialHeader = false;
    rows.forEach((r, idx) => {
      if (r.isSpecial && !hasRenderedSpecialHeader) {
        hasRenderedSpecialHeader = true;
        tableBody.push([
          {
            text: "CÁC LỚP LỊCH ĂN ĐẶC BIỆT",
            colSpan: 6,
            bold: true,
            alignment: "left",
            fontSize: 8.5,
            fillColor: "#fef3c7",
            color: "#78350f",
            margin: [4, 2, 4, 2],
          },
          {}, {}, {}, {}, {},
        ]);
      }

      const isEven = idx % 2 === 0;
      const rowFill = r.isSpecial
        ? (isEven ? "#fffbeb" : "#fef9c3")
        : (isEven ? "#ffffff" : "#f8fafc");
      const rowCells: any[] = [
        {
          text: r.className,
          bold: true,
          alignment: "center",
          fontSize: r.isSpecial ? 8.5 : 9,
          color: r.isSpecial ? "#78350f" : "#000000",
          fillColor: rowFill,
          margin: [0, 3, 0, 3],
        },
      ];

      days.forEach((day) => {
        const cell = r.courts[day.dateStr];
        const courtName = cell?.courtName || "";
        const isTiet4 = cell?.shift === "TIET_4";
        if (courtName) {
          rowCells.push({
            stack: [
              { text: courtName, bold: true, fontSize: 8.5, color: "#0f172a" },
              {
                text: isTiet4 ? "(Tiết 4)" : "(Tiết 5)",
                fontSize: 7.5,
                bold: true,
                color: isTiet4 ? "#b45309" : "#4338ca",
                margin: [0, 1, 0, 0],
              },
            ],
            alignment: "center",
            fillColor: rowFill,
            margin: [0, 2, 0, 2],
          });
        } else {
          rowCells.push({
            text: "-",
            alignment: "center",
            fontSize: 8.5,
            fillColor: rowFill,
            color: "#94a3b8",
            margin: [0, 5, 0, 5],
          });
        }
      });

      tableBody.push(rowCells);
    });
  }

  content.push({
    table: {
      headerRows: 2,
      dontBreakRows: true,
      widths: [65, "*", "*", "*", "*", "*"],
      body: tableBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 10],
  });

  // Ghi chú thời gian ăn Tiết 4 / Tiết 5
  content.push({
    text: "* Ghi chú thời gian ăn: Tiết 4 (Ăn lúc 10g30)  |  Tiết 5 (Ăn lúc 11g20)",
    fontSize: 8.5,
    italics: true,
    bold: true,
    color: "#334155",
    margin: [0, 0, 0, 15],
  });

  // 4. Chữ ký xác nhận
  content.push({
    columns: [
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Người lập biểu", bold: true, fontSize: 9 },
          { text: "(Ký và ghi rõ họ tên)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 35, 0, 0] },
          { text: "....................................................", color: "#94a3b8" },
        ],
      },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Bộ phận Bán trú", bold: true, fontSize: 9 },
          { text: "(Ký xác nhận phân sân)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 35, 0, 0] },
          { text: "....................................................", color: "#94a3b8" },
        ],
      },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "Ban Giám Hiệu", bold: true, fontSize: 9 },
          { text: "(Ký và đóng dấu)", fontSize: 8, italics: true, color: "#64748b" },
          { text: "", margin: [0, 35, 0, 0] },
          { text: "....................................................", color: "#94a3b8" },
        ],
      },
    ],
    unbreakable: true,
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [25, 25, 25, 25],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      lineHeight: 1.15,
    },
    footer: function (currentPage: number, pageCount: number) {
      return {
        text: `Trang ${currentPage} / ${pageCount}`,
        alignment: "right",
        margin: [0, 0, 25, 10],
        fontSize: 8,
        color: "#94a3b8",
      };
    },
    content,
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}

