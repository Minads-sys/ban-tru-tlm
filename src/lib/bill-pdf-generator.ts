import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { numberToVietnameseWords } from "@/lib/utils";
import { generateMealPaymentEMVCo } from "@/lib/vietqr";

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
  scheduleReducedDays?: number;
  extraMealDays?: number;
  previousDeduction: number;
  previousAddition?: number;
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
 * Sinh chuỗi SVG mã vạch Code 128 dạng vector để nhúng trực tiếp vào pdfmake
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    width?: number;
    height?: number;
  } = {}
): string {
  if (!text) return "";
  const barWidth = options.width ?? 1.1;
  const barHeight = options.height ?? 26;

  try {
    const result: any = {};
    JsBarcode(result, text, {
      format: "CODE128",
      displayValue: false,
    });

    const encoding = result.encodings?.[0];
    if (!encoding || !encoding.data) return "";

    const binary: string = encoding.data;
    let rects = "";
    let currentRun = 0;

    for (let b = 0; b < binary.length; b++) {
      if (binary[b] === "1") {
        currentRun++;
      } else if (currentRun > 0) {
        const x = (b - currentRun) * barWidth;
        const w = currentRun * barWidth;
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="#000000"/>`;
        currentRun = 0;
      }
    }
    if (currentRun > 0) {
      const x = (binary.length - currentRun) * barWidth;
      const w = currentRun * barWidth;
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="#000000"/>`;
    }

    const totalWidth = binary.length * barWidth;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth.toFixed(2)}" height="${barHeight}" viewBox="0 0 ${totalWidth.toFixed(2)} ${barHeight}">${rects}</svg>`;
  } catch (err) {
    console.error("Lỗi sinh barcode SVG:", err);
    return "";
  }
}

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

  const isPaid = bill.paymentStatus === "PAID" || bill.finalAmount <= 0;

  // Cú pháp nội dung chuyển khoản chuẩn SePay
  const mm = String(bill.month).padStart(2, "0");
  const yy = String(bill.year).slice(-2);
  const transferContent = `BSTLM ${boardingCode} T${mm}${yy}`;

  const accountNo = settings.accountNo || "96247BANTRUTLM08";
  const accountName = settings.accountName || "HOANG KIM";
  const bankBin = settings.bankBin || "970418"; // BIDV

  // Tạo mã QR VietQR chuẩn Napas 24/7 (EMVCo) để quét trực tiếp trên App Ngân hàng (chỉ khi chưa thanh toán)
  let qrDataUrl = "";
  if (!isPaid) {
    const qrRawPayload = generateMealPaymentEMVCo(boardingCode, bill.month, bill.year, bill.finalAmount, {
      bankBin,
      bankName: settings.bankName,
      accountNo,
      accountName,
    });
    
    // Tạo ảnh QR trực tiếp trong Node.js
    try {
      qrDataUrl = await QRCode.toDataURL(qrRawPayload, {
        margin: 1,
        width: 260,
        errorCorrectionLevel: "M",
      });
    } catch (err) {
      console.error("Lỗi sinh QR code:", err);
    }
  }

  // Danh sách các ngày duyệt cắt suất
  const cancellationDates = (bill.student.mealCancellations || []).map((c) => {
    const d = new Date(c.cancelDate);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const receiptBarcode = `PT${bill.month}${bill.year}${boardingCode}`;
  const barcodeSvg = generateBarcodeSvg(receiptBarcode, { width: 1.1, height: 26 });

  const docDefinition: any = {
    pageSize: "A5",
    pageOrientation: "portrait",
    pageMargins: [20, 18, 20, 18],
    content: [
      // Header: Trường học & Mã phiếu Barcode
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: schoolName.toUpperCase(), fontSize: 11, bold: true },
              schoolAddress ? { text: schoolAddress, fontSize: 8.5, color: "#444", margin: [0, 2, 0, 0] } : {},
              settings.schoolPhone ? { text: `ĐT: ${settings.schoolPhone} - TỔ QUẢN LÝ BÁN TRÚ`, fontSize: 8, color: "#555", margin: [0, 1, 0, 0] } : {},
            ],
          },
          {
            width: 130,
            stack: [
              barcodeSvg
                ? { svg: barcodeSvg, width: 130, alignment: "center" }
                : { text: `Mã phiếu: ${receiptBarcode}`, fontSize: 9, font: "Roboto", bold: true, alignment: "right" },
              { text: receiptBarcode, fontSize: 8.5, font: "Roboto", bold: true, alignment: "center", margin: [0, 1, 0, 0] },
              { text: `Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, fontSize: 7.5, color: "#666", alignment: "center", margin: [0, 1, 0, 0] },
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
        text: isPaid ? "BIÊN NHẬN THU TIỀN ĂN BÁN TRÚ" : "PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ",
        fontSize: 13,
        bold: true,
        alignment: "center",
        margin: [0, 2, 0, 1],
      },
      {
        text: isPaid ? `Tháng ${bill.month} / ${bill.year} (ĐÃ THANH TOÁN ĐỦ)` : `Tháng ${bill.month} / ${bill.year}`,
        fontSize: 10,
        italics: !isPaid,
        bold: isPaid,
        color: isPaid ? "#15803d" : "#000",
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
                      { text: "Số ngày duyệt cắt/hủy: ", bold: true, fontSize: 9 },
                      {
                        text: bill.scheduleReducedDays && bill.scheduleReducedDays > 0
                          ? `${bill.canceledDays} ngày (${bill.canceledDays - bill.scheduleReducedDays} cắt + ${bill.scheduleReducedDays} hủy)`
                          : `${bill.canceledDays} ngày`,
                        fontSize: 9,
                        color: bill.canceledDays > 0 ? "#dc2626" : "#000"
                      },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  {
                    text: [
                      { text: "Trừ tiền tháng trước: ", bold: true, fontSize: 9 },
                      {
                        text: bill.previousDeduction > 0
                          ? `-${formatVND(bill.previousDeduction)}`
                          : bill.month === 9
                          ? "0đ (Đầu năm học)"
                          : "0đ",
                        fontSize: 9,
                        color: bill.previousDeduction > 0 ? "#d97706" : "#000",
                      },
                    ],
                    margin: [0, 1.5, 0, 1.5],
                  },
                  ...((bill.previousAddition && bill.previousAddition > 0) || (bill.extraMealDays && bill.extraMealDays > 0)
                    ? [
                        {
                          text: [
                            { text: "Ăn thêm tháng trước: ", bold: true, fontSize: 9 },
                            {
                              text: `+${formatVND(bill.previousAddition || 0)}${bill.extraMealDays ? ` (${bill.extraMealDays} ngày)` : ""}`,
                              fontSize: 9,
                              color: "#15803d",
                            },
                          ],
                          margin: [0, 1.5, 0, 1.5],
                        },
                      ]
                    : []),
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

      // Khung TỔNG TIỀN NỔI BẬT
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: isPaid ? "#f0fdf4" : "#f1f5f9",
                borderColor: [isPaid ? "#16a34a" : "#0f172a", isPaid ? "#16a34a" : "#0f172a", isPaid ? "#16a34a" : "#0f172a", isPaid ? "#16a34a" : "#0f172a"],
                border: [true, true, true, true],
                alignment: "center",
                stack: [
                  {
                    text: isPaid
                      ? `SỐ TIỀN ĐÃ THANH TOÁN: ${formatVND(bill.finalAmount)}`
                      : `SỐ TIỀN CẦN NỘP: ${formatVND(bill.finalAmount)}`,
                    fontSize: 13,
                    bold: true,
                    color: isPaid ? "#15803d" : "#b91c1c",
                    margin: [0, 2, 0, 1],
                  },
                  {
                    text: `(Bằng chữ: ${numberToVietnameseWords(Number(bill.finalAmount))})`,
                    fontSize: 8.5,
                    italics: true,
                    color: "#334155",
                    margin: [0, 0, 0, 1],
                  },
                  ...(isPaid
                    ? [
                        {
                          text: "SỐ TIỀN CÒN NỢ: 0đ (ĐÃ NỘP ĐỦ 100%)",
                          fontSize: 9,
                          bold: true,
                          color: "#166534",
                          margin: [0, 1, 0, 2],
                        },
                      ]
                    : []),
                ],
              },
            ],
          ],
        },
        margin: [0, 3, 0, 7],
      },

      // Khung thanh toán VietQR HOẶC Xác nhận đã thu tiền
      isPaid
        ? {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    fillColor: "#f0fdf4",
                    borderColor: ["#86efac", "#86efac", "#86efac", "#86efac"],
                    border: [true, true, true, true],
                    alignment: "center",
                    stack: [
                      {
                        text: `XÁC NHẬN ĐÃ HOÀN TẤT THANH TOÁN TIỀN ĂN THÁNG ${bill.month}/${bill.year}`,
                        fontSize: 11,
                        bold: true,
                        color: "#166534",
                        margin: [0, 4, 0, 2],
                      },
                      {
                        text: `Học sinh ${bill.student.fullName} (${boardingCode}) đã hoàn tất nộp đủ 100% tiền ăn bán trú.`,
                        fontSize: 9,
                        color: "#1e293b",
                        margin: [0, 1, 0, 2],
                      },
                      {
                        text: "Biên nhận trích xuất từ Hệ thống Quản lý Bán trú. Xin chân thành cảm ơn Quý Phụ huynh và Học sinh!",
                        fontSize: 8,
                        italics: true,
                        color: "#15803d",
                        margin: [0, 0, 0, 4],
                      },
                    ],
                  },
                ],
              ],
            },
            margin: [0, 2, 0, 6],
          }
        : {
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

      // Chữ ký chân trang
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Người nộp tiền", bold: true, fontSize: 9, alignment: "center" },
              { text: "(Ký, ghi rõ họ tên)", fontSize: 7.5, italics: true, color: "#64748b", alignment: "center", margin: [0, 2, 0, 0] },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "Người lập phiếu (Thu ngân)", bold: true, fontSize: 9, alignment: "center" },
              { text: "(Ký, ghi rõ họ tên)", fontSize: 7.5, italics: true, color: "#64748b", alignment: "center", margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 14, 0, 0],
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
