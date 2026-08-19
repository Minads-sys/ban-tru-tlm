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

/**
 * Helper tạo mã VietQR thanh toán tiền ăn cho học sinh theo tháng
 * Cú pháp nội dung: BSTLM {studentId} T{month}
 * Đọc cấu hình từ biến môi trường:
 * - VIETQR_BANK_BIN (Mặc định: 970422 - MBBank)
 * - VIETQR_ACCOUNT_NO
 * - VIETQR_ACCOUNT_NAME
 */
export function generateMealPaymentQR(
  studentId: string,
  month: number,
  year: number,
  amount: number,
  customBankInfo?: { bankBin?: string; accountNo?: string; accountName?: string }
): string {
  const bankBin = customBankInfo?.bankBin || process.env.VIETQR_BANK_BIN || '970422';
  const accountNo = customBankInfo?.accountNo || process.env.VIETQR_ACCOUNT_NO || '';
  const accountName = customBankInfo?.accountName || process.env.VIETQR_ACCOUNT_NAME || 'TRUONG TH TLM';
  const description = `BSTLM ${studentId} T${month}`;

  return generateVietQR({
    bankBin,
    accountNo,
    accountName,
    amount,
    description,
  });
}
