import QRCode from "qrcode";
import { numberToVietnameseWords } from "@/lib/utils";

// Lấy pdfmake và vfs_fonts
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

export interface BillPdfData {
  id: string;
  month: number;
  year: number;
  scheduleMealDays: number;
  canceledDays: number;
  previousDeduction: number;
  unitPrice: number;
  finalAmount: number;
  paymentStatus: string;
  student: {
    studentCode: string;
    boardingCode?: string | null;
    fullName: string;
    className: string;
    mealType: string;
    mealCancellations?: Array<{ cancelDate: string | Date }>;
  };
}

export interface SchoolPdfSettings {
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  bankBin?: string;
  bankName?: string;
  accountNo?: string;
  accountName?: string;
}

const formatVND = (amount: number) => {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(amount))) + "đ";
};

/**
 * Sinh Buffer PDF phiếu thu khổ A5 chuẩn in ấn
 */
export async function generateBillPdfBuffer(
  bill: BillPdfData,
  settings: SchoolPdfSettings
): Promise<Buffer> {
  ensureFonts();

  const schoolName = settings.schoolName || "TRƯỜNG TIỂU HỌC BAN TRÚ";
  const schoolAddress = settings.schoolAddress || "";
  const boardingCode = bill.student.boardingCode || bill.student.studentCode;
  const studentCode = bill.student.studentCode;
  const mealTypeName =
    bill.student.mealType === "MAN"
      ? "Cơm mặn"
      : bill.student.mealType === "CHAY"
      ? "Cơm chay"
      : "Cháo";

  // Cú pháp nội dung chuyển khoản chuẩn SePay
  const mm = String(bill.month).padStart(2, "0");
  const yy = String(bill.year).slice(-2);
  const transferContent = `BSTLM ${boardingCode} T${mm}${yy}`;

  const accountNo = settings.accountNo || "96247BANTRUTLM08";
  const accountName = settings.accountName || "HOANG KIM";
  const bankBin = settings.bankBin || "970418"; // BIDV

  // Tạo mã QR VietQR (VietQR raw string hoặc link)
  const qrRawPayload = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.jpg?amount=${Math.max(0, Math.round(bill.finalAmount))}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;
  
  // Tạo ảnh QR trực tiếp trong Node.js
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(qrRawPayload, {
      margin: 1,
      width: 260,
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("Lỗi sinh QR code:", err);
  }

  // Danh sách các ngày duyệt cắt suất
  const cancellationDates = (bill.student.mealCancellations || []).map((c) => {
    const d = new Date(c.cancelDate);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const receiptBarcode = `PT${bill.month}${bill.year}${boardingCode}`;

  const docDefinition: any = {
    pageSize: "A5",
    pageOrientation: "portrait",
    pageMargins: [20, 18, 20, 18],
    content: [
      // Header: Trường học & Mã phiếu
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: schoolName.toUpperCase(), fontSize: 11, bold: true },
              schoolAddress ? { text: schoolAddress, fontSize: 8.5, color: "#444", margin: [0, 2, 0, 0] } : {},
            ],
          },
          {
            width: "auto",
            stack: [
              { text: `Mã phiếu: ${receiptBarcode}`, fontSize: 9, font: "Roboto", bold: true, alignment: "right" },
              { text: `Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, fontSize: 8, color: "#666", alignment: "right" },
            ],
          },
        ],
      },

      // Đường kẻ ngăn cách
      {
        canvas: [{ type: "line", x1: 0, y1: 6, x2: 380, y2: 6, lineWidth: 1, lineColor: "#222" }],
        margin: [0, 2, 0, 6],
      },

      // Tiêu đề phiếu
      {
        text: "PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ",
        fontSize: 13,
        bold: true,
        alignment: "center",
        margin: [0, 2, 0, 1],
      },
      {
        text: `Tháng ${bill.month} / ${bill.year}`,
        fontSize: 10,
        italics: true,
        alignment: "center",
        margin: [0, 0, 0, 6],
      },

      // Bảng thông tin học sinh & Suất ăn (2 cột)
      {
        table: {
          widths: ["50%", "50%"],
          body: [
            [
              {
                border: [false, false, false, false],
                stack: [
                  {
                    text: [
                      { text: "Mã Bán Trú: ", bold: true, fontSize: 9 },
                      { text: boardingCode || "Chưa cấp", fontSize: 9, bold: true, color: "#1d4ed8" },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Mã Học Sinh: ", bold: true, fontSize: 9 },
                      { text: studentCode, fontSize: 9 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Họ và tên: ", bold: true, fontSize: 9.5 },
                      { text: bill.student.fullName.toUpperCase(), fontSize: 9.5, bold: true },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Lớp: ", bold: true, fontSize: 9 },
                      { text: bill.student.className, fontSize: 9, bold: true },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Loại suất ăn: ", bold: true, fontSize: 9 },
                      { text: mealTypeName, fontSize: 9 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                ],
              },
              {
                border: [false, false, false, false],
                stack: [
                  {
                    text: [
                      { text: "Số ngày ăn dự kiến: ", bold: true, fontSize: 9 },
                      { text: `${bill.scheduleMealDays} ngày`, fontSize: 9 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Số ngày duyệt cắt suất: ", bold: true, fontSize: 9 },
                      { text: `${bill.canceledDays} ngày`, fontSize: 9, color: bill.canceledDays > 0 ? "#dc2626" : "#000" },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Trừ tiền tháng trước: ", bold: true, fontSize: 9 },
                      { text: `-${formatVND(bill.previousDeduction)}`, fontSize: 9, color: bill.previousDeduction > 0 ? "#d97706" : "#000" },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Đơn giá suất ăn: ", bold: true, fontSize: 9 },
                      { text: `${formatVND(bill.unitPrice)} / ngày`, fontSize: 9 },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 2, 0, 4],
      },

      // Chi tiết các ngày duyệt cắt suất (nếu có)
      cancellationDates.length > 0
        ? {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    fillColor: "#f8fafc",
                    borderColor: ["#cbd5e1", "#cbd5e1", "#cbd5e1", "#cbd5e1"],
                    stack: [
                      {
                        text: [
                          { text: "Các ngày đã duyệt cắt suất: ", bold: true, fontSize: 8 },
                          { text: cancellationDates.join(", "), fontSize: 8, italics: true },
                        ],
                      },
                    ],
                  },
                ],
              ],
            },
            margin: [0, 2, 0, 6],
          }
        : { text: "", margin: [0, 0, 0, 2] },

      // Khung TỔNG TIỀN CẦN NỘP NỔI BẬT
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#f1f5f9",
                borderColor: ["#0f172a", "#0f172a", "#0f172a", "#0f172a"],
                border: [true, true, true, true],
                alignment: "center",
                stack: [
                  {
                    text: `SỐ TIỀN CẦN NỘP: ${formatVND(bill.finalAmount)}`,
                    fontSize: 13,
                    bold: true,
                    color: "#b91c1c",
                    margin: [0, 2, 0, 1],
                  },
                  {
                    text: `(Bằng chữ: ${numberToVietnameseWords(Number(bill.finalAmount))})`,
                    fontSize: 8.5,
                    italics: true,
                    color: "#334155",
                    margin: [0, 0, 0, 2],
                  },
                ],
              },
            ],
          ],
        },
        margin: [0, 3, 0, 7],
      },

      // Khung thanh toán VietQR
      {
        table: {
          widths: qrDataUrl ? [95, "*"] : ["*"],
          body: [
            [
              ...(qrDataUrl
                ? [
                    {
                      border: [true, true, true, true],
                      borderColor: ["#cbd5e1", "#cbd5e1", "#cbd5e1", "#cbd5e1"],
                      alignment: "center",
                      stack: [
                        { image: qrDataUrl, width: 85, height: 85, alignment: "center" },
                        { text: "Quét bằng App Ngân hàng", fontSize: 7, color: "#2563eb", bold: true, alignment: "center" },
                      ],
                    },
                  ]
                : []),
              {
                border: [true, true, true, true],
                borderColor: ["#cbd5e1", "#cbd5e1", "#cbd5e1", "#cbd5e1"],
                stack: [
                  { text: "HƯỚNG DẪN CHUYỂN KHOẢN TỰ ĐỘNG GẠCH NỢ", fontSize: 9, bold: true, color: "#0f172a" },
                  {
                    text: [
                      { text: "1. Ngân hàng nhận: ", bold: true, fontSize: 8 },
                      { text: "BIDV", fontSize: 8 },
                      { text: "  —  Chủ TK: ", bold: true, fontSize: 8 },
                      { text: accountName, fontSize: 8 },
                    ],
                    margin: [0, 1.5, 0, 1],
                  },
                  {
                    text: [
                      { text: "2. Số tài khoản: ", bold: true, fontSize: 8 },
                      { text: accountNo, fontSize: 8.5, bold: true, color: "#0f172a" },
                    ],
                    margin: [0, 1, 0, 1.5],
                  },
                  {
                    text: "3. Cú pháp chuyển khoản BẮT BUỘC:",
                    fontSize: 8,
                    bold: true,
                    color: "#b45309",
                  },
                  {
                    table: {
                      widths: ["*"],
                      body: [
                        [
                          {
                            fillColor: "#fef3c7",
                            borderColor: ["#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b"],
                            alignment: "center",
                            text: transferContent,
                            fontSize: 10,
                            bold: true,
                            color: "#1d4ed8",
                          },
                        ],
                      ],
                    },
                    margin: [0, 1, 0, 2],
                  },
                  {
                    text: "⚡ Hệ thống tự động nhận diện và gạch nợ sau 1-3 giây khi nhận được tiền.",
                    fontSize: 7.5,
                    italics: true,
                    color: "#059669",
                  },
                ],
              },
            ],
          ],
        },
      },
    ],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
    },
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}

/**
 * Tạo tên file PDF của từng học sinh theo chuẩn:
 * Cú pháp: Lop_ho_tên_thang_năm_Mã ban trú.pdf
 * Ví dụ: 10A1_Nguyen_Van_A_Thang_09_2026_BT00863.pdf
 */
export function generateStudentBillFileName(
  className: string,
  fullName: string,
  month: number,
  year: number,
  boardingCode: string
): string {
  const safeClass = className.replace(/[/\\?%*:|"<>]/g, "").trim();
  const safeName = fullName
    .replace(/[/\\?%*:|"<>]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const mm = String(month).padStart(2, "0");
  const code = (boardingCode || "NoCode").replace(/[/\\?%*:|"<>]/g, "").trim();
  return `${safeClass}_${safeName}_Thang_${mm}_${year}_${code}.pdf`;
}
