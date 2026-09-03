/**
 * BAN-TRU-TLM - VietQR Utility
 * Tiện ích tạo mã VietQR thanh toán tiền ăn bán trú
 */

export interface VietQRParams {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
}

/**
 * Tạo URL hình ảnh VietQR từ thông tin tài khoản và số tiền
 * Sử dụng VietQR Quick Link API (compact2 template)
 */
export function generateVietQR(params: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
}): string {
  const { bankBin, accountNo, accountName, amount, description } = params;
  const roundedAmount = Math.max(0, Math.round(amount));
  const encodedDescription = encodeURIComponent(description || '');
  const encodedAccountName = encodeURIComponent(accountName || '');

  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.jpg?amount=${roundedAmount}&addInfo=${encodedDescription}&accountName=${encodedAccountName}`;
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
 * Helper tạo mã VietQR thanh toán tiền ăn cho học sinh theo tháng
 * Cú pháp nội dung: BSTLM {studentId} T{month}
 * Đọc cấu hình từ biến môi trường hoặc tùy chỉnh
 */
export function generateMealPaymentQR(
  studentId: string,
  month: number,
  year: number,
  amount: number,
  customBankInfo?: { bankBin?: string; bankName?: string; accountNo?: string; accountName?: string }
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
  });
}
