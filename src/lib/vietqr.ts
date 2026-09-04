/**
 * BAN-TRU-TLM - VietQR Utility
 * Tiện ích tạo mã VietQR thanh toán tiền ăn bán trú
 */

export interface VietQRParams {
  bankBin: string;
  accountNo: string;
  accountName?: string;
  amount?: number;
  description?: string;
  template?: "compact2" | "compact" | "qr_only" | "print";
}

/**
 * Xóa dấu tiếng Việt, đảm bảo nội dung chuyển khoản chỉ gồm ký tự ASCII hợp lệ theo chuẩn Napas 24/7
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s-_.]/g, "")
    .trim();
}

/**
 * Tính số byte UTF-8 của chuỗi (an toàn cho cả browser và Node.js)
 */
function getByteLength(str: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str).length;
  }
  return str.length;
}

/**
 * Đóng gói TLV (Tag - Length - Value)
 */
function formatTLV(tag: string, value: string): string {
  const len = getByteLength(value).toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Tính CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF, No final XOR) chuẩn EMVCo
 */
export function calculateCRC16CCITT(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Sinh chuỗi payload EMVCo VietQR chuẩn Napas 24/7
 * Chuỗi này được mã hóa trực tiếp vào QR Code, cho phép tất cả các ứng dụng ngân hàng quét
 * và tự động điền: Ngân hàng thụ hưởng, Số tài khoản, Tên tài khoản, Số tiền, Nội dung chuyển khoản.
 */
export function generateVietQREMVCo(params: {
  bankBin: string;
  accountNo: string;
  amount?: number;
  description?: string;
}): string {
  const { bankBin, accountNo, amount, description } = params;

  // 1. Tag 00: Payload Format Indicator (01)
  let payload = formatTLV("00", "01");

  // 2. Tag 01: Point of Initiation Method (11: Tĩnh, 12: Động - đã kèm số tiền)
  const isDynamic = amount !== undefined && amount > 0;
  payload += formatTLV("01", isDynamic ? "12" : "11");

  // 3. Tag 38: Thông tin tài khoản thụ hưởng (Napas 24/7)
  const cleanBin = bankBin.replace(/\D/g, "").trim();
  const cleanAccount = accountNo.trim();

  // Sub-tag 00: GUID Napas (A000000727)
  const subTag00 = formatTLV("00", "A000000727");
  // Sub-tag 01: Tổ chức thụ hưởng (BIN + Số tài khoản)
  const subSub00 = formatTLV("00", cleanBin);
  const subSub01 = formatTLV("01", cleanAccount);
  const subTag01 = formatTLV("01", subSub00 + subSub01);
  // Sub-tag 02: Mã dịch vụ chuyển khoản nhanh tới tài khoản (QRIBFTTA)
  const subTag02 = formatTLV("02", "QRIBFTTA");
  const tag38Value = subTag00 + subTag01 + subTag02;
  payload += formatTLV("38", tag38Value);

  // 4. Tag 53: Đơn vị tiền tệ (704 = VND)
  payload += formatTLV("53", "704");

  // 5. Tag 54: Số tiền giao dịch (chỉ khi có số tiền)
  if (isDynamic) {
    const roundedAmount = Math.max(0, Math.round(amount)).toString();
    payload += formatTLV("54", roundedAmount);
  }

  // 6. Tag 58: Mã quốc gia (VN)
  payload += formatTLV("58", "VN");

  // 7. Tag 62: Thông tin bổ sung (Nội dung chuyển khoản - Sub-tag 08)
  if (description && description.trim()) {
    const cleanDesc = removeVietnameseTones(description.trim());
    const subTag08 = formatTLV("08", cleanDesc);
    payload += formatTLV("62", subTag08);
  }

  // 8. Tag 63: CRC16 Checksum
  payload += "6304";
  const crc = calculateCRC16CCITT(payload);
  payload += crc;

  return payload;
}

/**
 * Tạo URL hình ảnh VietQR từ thông tin tài khoản và số tiền
 * Sử dụng VietQR Quick Link API
 */
export function generateVietQR(params: VietQRParams): string {
  const { bankBin, accountNo, accountName, amount, description, template = "compact2" } = params;
  const roundedAmount = Math.max(0, Math.round(amount || 0));
  const encodedDescription = encodeURIComponent(description || "");
  const encodedAccountName = encodeURIComponent(accountName || "");

  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-${template}.jpg?amount=${roundedAmount}&addInfo=${encodedDescription}&accountName=${encodedAccountName}`;
}

const BANK_BINS: Record<string, string> = {
  "Vietcombank": "970436",
  "VietinBank": "970415",
  "BIDV": "970418",
  "Agribank": "970405",
  "MBBank": "970422",
  "Techcombank": "970407",
  "ACB": "970416",
  "VPBank": "970432",
  "TPBank": "970423",
  "VIB": "970441",
  "HDBank": "970437",
  "Sacombank": "970403",
  "SHB": "970443",
  "SeABank": "970440",
  "MSB": "970426",
  "OCB": "970448",
  "DongA Bank": "970406",
  "Eximbank": "970431",
  "LPBank": "970449",
  "Nam A Bank": "970428",
  "NCB": "970419",
  "VietABank": "970427",
  "BaoViet Bank": "970438",
  "Kienlongbank": "970452",
  "Bac A Bank": "970409",
  "Vietbank": "970433",
  "Saigonbank": "970400",
  "PGBank": "970430",
  "OceanBank": "970414",
  "CBBank": "970444", 
  "GPBank": "970408",
  "Shinhan Bank": "970424",
  "Timo": "970459",
  "Cake by VPBank": "970458",
};

/**
 * Helper tạo chuỗi mã QR EMVCo Napas 24/7 thanh toán tiền ăn cho học sinh
 * Dùng cho thư viện QRCode.toDataURL(...) để in ấn hoặc quét trên mọi App Ngân hàng
 */
export function generateMealPaymentEMVCo(
  studentId: string,
  month: number,
  year: number,
  amount: number,
  customBankInfo?: { bankBin?: string; bankName?: string; accountNo?: string; accountName?: string }
): string {
  let bankBin = customBankInfo?.bankBin || process.env.VIETQR_BANK_BIN || "970418";
  if (customBankInfo?.bankName && BANK_BINS[customBankInfo.bankName]) {
    bankBin = BANK_BINS[customBankInfo.bankName];
  }

  const accountNo = customBankInfo?.accountNo || process.env.VIETQR_ACCOUNT_NO || "96247BANTRUTLM08";

  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  const description = `BSTLM ${studentId} T${mm}${yy}`;

  return generateVietQREMVCo({
    bankBin,
    accountNo,
    amount,
    description,
  });
}

/**
 * Helper tạo URL ảnh VietQR thanh toán tiền ăn cho học sinh theo tháng
 * Cú pháp nội dung: BSTLM {studentId} T{month}
 * Đọc cấu hình từ biến môi trường hoặc tùy chỉnh
 */
export function generateMealPaymentQR(
  studentId: string,
  month: number,
  year: number,
  amount: number,
  customBankInfo?: { bankBin?: string; bankName?: string; accountNo?: string; accountName?: string },
  template: "compact2" | "compact" | "qr_only" | "print" = "compact2"
): string {
  let bankBin = customBankInfo?.bankBin || process.env.VIETQR_BANK_BIN || '970418';
  if (customBankInfo?.bankName && BANK_BINS[customBankInfo.bankName]) {
    bankBin = BANK_BINS[customBankInfo.bankName];
  }
  
  const accountNo = customBankInfo?.accountNo || process.env.VIETQR_ACCOUNT_NO || '96247BANTRUTLM08';
  const accountName = customBankInfo?.accountName || process.env.VIETQR_ACCOUNT_NAME || 'HOANG KIM';
  
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  const description = `BSTLM ${studentId} T${mm}${yy}`;

  return generateVietQR({
    bankBin,
    accountNo,
    accountName,
    amount,
    description,
    template,
  });
}

