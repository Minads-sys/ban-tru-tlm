import QRCode from "qrcode";
import fs from "fs";
import path from "path";

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

  const fontsConfig: Record<string, any> = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  };

  // Nạp font Times New Roman chuẩn có sẵn trong public/fonts
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const timesPath = path.join(fontsDir, "times.ttf");
  if (fs.existsSync(timesPath)) {
    try {
      pdfmake.virtualfs.writeFileSync("Times-Regular.ttf", fs.readFileSync(path.join(fontsDir, "times.ttf")));
      pdfmake.virtualfs.writeFileSync("Times-Bold.ttf", fs.readFileSync(path.join(fontsDir, "timesbd.ttf")));
      pdfmake.virtualfs.writeFileSync("Times-Italic.ttf", fs.readFileSync(path.join(fontsDir, "timesi.ttf")));
      pdfmake.virtualfs.writeFileSync("Times-BoldItalic.ttf", fs.readFileSync(path.join(fontsDir, "timesbi.ttf")));

      fontsConfig.Times = {
        normal: "Times-Regular.ttf",
        bold: "Times-Bold.ttf",
        italics: "Times-Italic.ttf",
        bolditalics: "Times-BoldItalic.ttf",
      };
    } catch (e) {
      console.error("Không thể nạp font Times New Roman:", e);
    }
  }

  pdfmake.setFonts(fontsConfig);
  fontsInitialized = true;
}

export interface DebtNotificationPdfBill {
  id: string;
  month: number;
  year: number;
  student: {
    id: string;
    studentCode: string;
    boardingCode?: string | null;
    birthDate?: string | Date | null;
    user: {
      fullName: string;
    };
    class: {
      name: string;
    };
  };
}

export type DebtNotificationLayout = "A5_LANDSCAPE_2UP" | "A4_PORTRAIT_4UP";

export interface DebtNotificationPdfOptions {
  schoolName?: string;
  month: number;
  year: number;
  className?: string;
  layout?: DebtNotificationLayout;
}

/**
 * Sinh ô nội dung của 1 phiếu thông báo A6
 * Tỉ lệ dãn cách đều chuẩn xác 100% như giao diện Xem Trước (Times New Roman, phân bố trọn chiều cao A6)
 */
function createA6BillCell(
  bill: DebtNotificationPdfBill | null,
  schoolName: string,
  qrCodeDataUrl: string
): any {
  if (!bill) {
    return {
      text: "",
      border: [false, false, false, false],
    };
  }

  const fullName = bill.student?.user?.fullName || "";
  const clsName = bill.student?.class?.name || "";

  return {
    stack: [
      // 1. Header Phiếu
      {
        stack: [
          {
            text: (schoolName || "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN").toUpperCase(),
            fontSize: 8.5,
            bold: true,
            alignment: "center",
          },
          {
            text: "THÔNG BÁO",
            fontSize: 12.5,
            bold: true,
            alignment: "center",
            margin: [0, 2, 0, 1.5],
          },
          {
            text: `PHÁT HÀNH PHIẾU THANH TOÁN TIỀN ĂN BÁN TRÚ THÁNG ${bill.month}/${bill.year}`,
            fontSize: 8.5,
            bold: true,
            alignment: "center",
          },
        ],
        margin: [0, 0, 0, 4],
      },
      // Đường kẻ ngăn cách header
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 256,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#000000",
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // 2. Kính gửi & Nội dung thông báo
      {
        text: [
          { text: "Kính gửi: Quý Phụ huynh em ", fontSize: 9.2 },
          {
            text: fullName.toUpperCase(),
            fontSize: 9.2,
            bold: true,
            decoration: "underline",
          },
          { text: " - Lớp: ", fontSize: 9.2 },
          { text: clsName, fontSize: 9.2, bold: true },
          { text: ",", fontSize: 9.2 },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        text: "        Căn tin Châu Phương Thảo tại trường Tenlơman xin thông báo: Phiếu thanh toán tiền ăn bán trú đã được cập nhật trên ứng dụng. Quý Phụ huynh vui lòng kiểm tra thông tin và hoàn tất thanh toán theo các phương thức sau:",
        fontSize: 8.5,
        alignment: "justify",
        lineHeight: 1.18,
        margin: [0, 0, 0, 7],
      },

      // 3. Khung Phương thức 1: Trực tuyến qua QR
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: "1. Thanh toán trực tuyến qua mã QR:",
                    bold: true,
                    fontSize: 8.8,
                    margin: [0, 0, 0, 3],
                  },
                  {
                    columns: [
                      // Cột mã QR
                      {
                        width: 58,
                        stack: [
                          {
                            table: {
                              widths: [50],
                              body: [
                                [
                                  {
                                    stack: [
                                      {
                                        image: qrCodeDataUrl,
                                        width: 46,
                                        height: 46,
                                        alignment: "center",
                                      },
                                      {
                                        text: "Quét mở App",
                                        fontSize: 6,
                                        bold: true,
                                        alignment: "center",
                                        margin: [0, 1, 0, 0],
                                      },
                                    ],
                                    alignment: "center",
                                  },
                                ],
                              ],
                            },
                            layout: {
                              hLineWidth: () => 0.5,
                              vLineWidth: () => 0.5,
                              hLineColor: () => "#000000",
                              vLineColor: () => "#000000",
                              paddingLeft: () => 2,
                              paddingRight: () => 2,
                              paddingTop: () => 2,
                              paddingBottom: () => 2,
                            },
                          },
                        ],
                      },
                      // Cột thông tin đăng nhập
                      {
                        width: "*",
                        margin: [6, 0, 0, 0],
                        stack: [
                          {
                            text: [
                              { text: "Truy cập link: ", fontSize: 8.2, bold: true },
                              {
                                text: "https://bantrutlm.com/student-login",
                                fontSize: 8.2,
                                bold: true,
                                decoration: "underline",
                              },
                            ],
                            margin: [0, 0, 0, 2.5],
                          },
                          {
                            text: "• Tên đăng nhập: Điền Họ và Tên học sinh",
                            fontSize: 7.8,
                            margin: [0, 0, 0, 1.5],
                          },
                          {
                            text: "• Mật khẩu: Nếu đăng nhập lần đầu điền mật khẩu là Ngày tháng năm sinh viết liền (ddmmyyyy)",
                            fontSize: 7.6,
                            lineHeight: 1.1,
                            margin: [0, 0, 0, 1.5],
                          },
                          {
                            text: "• Mã xác nhận: 6 số cuối CCCD / Mã định danh",
                            fontSize: 7.8,
                            margin: [0, 0, 0, 1],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    text: "Quý Phụ huynh kiểm tra chi tiết phiếu và quét mã QR chuyển khoản trực tiếp trên ứng dụng.",
                    italics: true,
                    fontSize: 7.5,
                    margin: [0, 4, 0, 0],
                  },
                ],
                margin: [2, 2, 2, 2],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => "#333333",
          vLineColor: () => "#333333",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3.5,
          paddingBottom: () => 3.5,
        },
        margin: [0, 0, 0, 6],
      },

      // 4. Phương thức 2: Tiền mặt
      {
        stack: [
          {
            text: "2. Thanh toán bằng tiền mặt:",
            bold: true,
            fontSize: 8.8,
            margin: [0, 0, 0, 1.5],
          },
          {
            text: "Quý Phụ huynh vui lòng đến trực tiếp Căn tin nhà trường để đóng tiền.",
            fontSize: 8.5,
            margin: [8, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // 5. Lưu ý
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 256,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#000000",
          },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        stack: [
          {
            text: "• Nếu Quý Phụ huynh đã hoàn tất thanh toán trước đó, vui lòng bỏ qua thông báo này.",
            italics: true,
            fontSize: 7.8,
            margin: [0, 0, 0, 1.5],
          },
          {
            text: [
              {
                text: "• Mọi thắc mắc hoặc cần hỗ trợ, xin vui lòng liên hệ: ",
                fontSize: 7.8,
              },
              { text: "0909 932 627", bold: true, fontSize: 7.8 },
              { text: " (cô Thu Trang).", fontSize: 7.8 },
            ],
            margin: [0, 0, 0, 2],
          },
        ],
        margin: [0, 0, 0, 5],
      },

      // 6. Footer / Ký tên
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 256,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#000000",
          },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        stack: [
          {
            text: `TP. Hồ Chí Minh, tháng ${bill.month} năm ${bill.year}`,
            italics: true,
            fontSize: 7.8,
            alignment: "right",
          },
          {
            text: "CĂN TIN CHÂU PHƯƠNG THẢO",
            bold: true,
            fontSize: 8.8,
            alignment: "right",
            margin: [0, 1.5, 0, 0],
          },
        ],
      },
    ],
    margin: [2, 2, 2, 2],
  };
}

/**
 * Sinh Buffer PDF thông báo nợ chuẩn A4 dọc (4 phiếu A6) hoặc A5 ngang (2 phiếu A6)
 */
export async function generateDebtNotificationPdfBuffer(
  bills: DebtNotificationPdfBill[],
  options: DebtNotificationPdfOptions
): Promise<Buffer> {
  ensureFonts();

  const layout = options.layout || "A4_PORTRAIT_4UP";
  const isA5 = layout === "A5_LANDSCAPE_2UP";
  const schoolName = options.schoolName || "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN";

  // Tạo sẵn ảnh DataURL cho QR code đăng nhập
  const qrCodeDataUrl = await QRCode.toDataURL("https://bantrutlm.com/student-login", {
    width: 180,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const chunkSize = isA5 ? 2 : 4;
  const chunkedBills: DebtNotificationPdfBill[][] = [];
  for (let i = 0; i < bills.length; i += chunkSize) {
    chunkedBills.push(bills.slice(i, i + chunkSize));
  }

  const content: any[] = [];

  chunkedBills.forEach((group, pageIndex) => {
    let pageTable: any;

    if (isA5) {
      // Khổ A5 ngang: 1 hàng x 2 cột
      const b0 = group[0] || null;
      const b1 = group[1] || null;

      const cell0 = createA6BillCell(b0, schoolName, qrCodeDataUrl);
      const cell1 = createA6BillCell(b1, schoolName, qrCodeDataUrl);

      pageTable = {
        table: {
          widths: [275, 275],
          heights: [382],
          dontBreakRows: true,
          body: [[cell0, cell1]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i: number) => (i === 1 ? 0.6 : 0),
          vLineColor: () => "#888888",
          vLineStyle: () => ({ dash: { length: 2, space: 2 } }),
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 0],
      };
    } else {
      // Khổ A4 dọc: 2 hàng x 2 cột (4 phiếu A6)
      const b0 = group[0] || null;
      const b1 = group[1] || null;
      const b2 = group[2] || null;
      const b3 = group[3] || null;

      const cell0 = createA6BillCell(b0, schoolName, qrCodeDataUrl);
      const cell1 = createA6BillCell(b1, schoolName, qrCodeDataUrl);
      const cell2 = createA6BillCell(b2, schoolName, qrCodeDataUrl);
      const cell3 = createA6BillCell(b3, schoolName, qrCodeDataUrl);

      pageTable = {
        table: {
          widths: [275, 275],
          heights: [388, 388],
          dontBreakRows: true,
          body: [
            [cell0, cell1],
            [cell2, cell3],
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i === 1 ? 0.6 : 0),
          vLineWidth: (i: number) => (i === 1 ? 0.6 : 0),
          hLineColor: () => "#888888",
          vLineColor: () => "#888888",
          hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
          vLineStyle: () => ({ dash: { length: 2, space: 2 } }),
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 0],
      };
    }

    if (pageIndex > 0) {
      pageTable.pageBreak = "before";
    }

    content.push(pageTable);
  });

  const docDefinition: any = {
    pageSize: isA5 ? "A5" : "A4",
    pageOrientation: isA5 ? "landscape" : "portrait",
    pageMargins: [14, 10, 14, 10],
    content,
    defaultStyle: {
      font: "Times",
      fontSize: 8.5,
      color: "#000000",
    },
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
