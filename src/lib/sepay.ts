/**
 * BAN-TRU-TLM - SePay Integration Library
 * Xử lý nhận diện cú pháp, tự động gạch nợ và đồng bộ giao dịch ngân hàng
 */

import prisma from '@/lib/db';
import { PaymentStatus, PaymentTransactionStatus } from '@prisma/client';
import { broadcastChange } from '@/lib/realtime-hub';

export interface SePayWebhookPayload {
  // Webhook format (camelCase)
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  transferType?: 'in' | 'out' | string;
  transferAmount?: number | string;
  accumulated?: number | string;
  code?: string | null;
  content?: string;
  referenceCode?: string;
  description?: string;

  // REST API format (snake_case)
  bank_brand_name?: string;
  transaction_date?: string;
  account_number?: string;
  sub_account?: string | null;
  amount_in?: number | string;
  amount_out?: number | string;
  transaction_content?: string;
  reference_number?: string;
}

export interface ParsedTransferContent {
  matched: boolean;
  code?: string;
  month?: number;
  year?: number;
  patternUsed?: string;
}

/**
 * Phân tích nội dung chuyển khoản để tìm Mã học sinh/Mã bán trú và Tháng/Năm thanh toán
 * Hỗ trợ các định dạng:
 * 1. Chuẩn mới: "BSTLM BT00001 T0926", "BSTLM BT00001 T1026", "BSTLM BT00001 T926" (T[Tháng][Năm])
 * 2. Chuẩn cũ & Có dấu: "BSTLM BT00001 T9", "BSTLM BT00001 T09", "BSTLM BT00001 T9 2026", "BSTLM BT00001 T09/2026", "BSTLM BT00001 T9-26"
 * 3. Bị dính text ngân hàng: "...MBVCB.12345.BSTLM BT00001 T0926.CT tu NGUYEN VAN A..."
 * 4. Rút gọn không có tiền tố BSTLM: "BT00001 T0926", "BT00001 T9", "HS0001 T0926"
 */
export function parseTransferContent(content: string): ParsedTransferContent {
  if (!content) return { matched: false };
  const cleanContent = content.trim();

  // Chuẩn hóa: hỗ trợ nếu SePay hoặc người chuyển có thêm tiền tố SEVQR hoặc SE
  // Ví dụ: "SEVQR BSTLM BT00001 T0926", "SEVQRBSTLM BT00001 T0926", "SEVQR BT00001 T0926", "SEVQRBT00001 T0926"
  const normalizedContent = cleanContent.replace(/^(?:SEVQR|SE)[_\s-]*/i, '');
  const candidateTexts = cleanContent !== normalizedContent ? [cleanContent, normalizedContent] : [cleanContent];

  for (const text of candidateTexts) {
    // Pattern 1: Chuẩn BSTLM + Mã + T + (Tháng + Năm liền nhau hoặc cách nhau)
    // Hỗ trợ: T0926, T926, T1026, T092026, T9-26, T09/26, T9 2026, T9, T09
    const bstlmRegex = /(?:^|[^A-Za-z0-9])BSTLM\s*[-_./\s]?\s*([A-Za-z0-9_-]+)\s*[-_./\s]?\s*T(?:HÁNG|HANG)?\s*(0[1-9]|1[0-2]|[1-9])(?:[\s/_-]*(\d{4}|\d{2}))?(?![0-9])/i;
    const match1 = text.match(bstlmRegex);
    if (match1) {
      const rawCode = match1[1].trim().replace(/[-_.]+$/, '').toUpperCase();
      const month = parseInt(match1[2], 10);
      let year: number | undefined = undefined;
      if (match1[3]) {
        const parsedYear = parseInt(match1[3], 10);
        year = match1[3].length === 2 ? 2000 + parsedYear : parsedYear;
      }

      if (month >= 1 && month <= 12) {
        return {
          matched: true,
          code: rawCode,
          month,
          year,
          patternUsed: 'BSTLM_STANDARD',
        };
      }
    }

    // Pattern 2: Dạng rút gọn cho phụ huynh quên chữ BSTLM: "BT00001 T0926", "BT00001 T9"
    const shortRegex = /(?:^|[^A-Za-z0-9])(BT\d+|HS\d+)\s*[-_./\s]?\s*T(?:HÁNG|HANG)?\s*(0[1-9]|1[0-2]|[1-9])(?:[\s/_-]*(\d{4}|\d{2}))?(?![0-9])/i;
    const match2 = text.match(shortRegex);
    if (match2) {
      const rawCode = match2[1].trim().replace(/[-_.]+$/, '').toUpperCase();
      const month = parseInt(match2[2], 10);
      let year: number | undefined = undefined;
      if (match2[3]) {
        const parsedYear = parseInt(match2[3], 10);
        year = match2[3].length === 2 ? 2000 + parsedYear : parsedYear;
      }

      if (month >= 1 && month <= 12) {
        return {
          matched: true,
          code: rawCode,
          month,
          year,
          patternUsed: 'SHORT_CODE',
        };
      }
    }

    // Pattern 3: Dạng mã kèm ngày tháng giờ (VD: "BT00864-030926-22:19:55")
    const timestampRegex = /(?:^|[^A-Za-z0-9])(BT\d+|HS\d+)[-_](\d{2})(0[1-9]|1[0-2])(\d{2}|\d{4})[-_]/i;
    const match3 = text.match(timestampRegex);
    if (match3) {
      const rawCode = match3[1].trim().toUpperCase();
      const month = parseInt(match3[3], 10);
      const parsedYear = parseInt(match3[4], 10);
      const year = match3[4].length === 2 ? 2000 + parsedYear : parsedYear;

      if (month >= 1 && month <= 12) {
        return {
          matched: true,
          code: rawCode,
          month,
          year,
          patternUsed: 'TIMESTAMP_CODE',
        };
      }
    }
  }

  return { matched: false };
}

/**
 * Xử lý gạch nợ tự động một giao dịch từ SePay (Webhook hoặc Sync)
 */
export async function processSepayTransaction(payload: SePayWebhookPayload) {
  const sepayTransId = payload.id
    ? String(payload.id)
    : payload.reference_number
    ? String(payload.reference_number)
    : payload.referenceCode
    ? String(payload.referenceCode)
    : null;

  // 1. Chuẩn hóa số tiền vào & tiền ra (hỗ trợ cả REST API snake_case và Webhook camelCase)
  const rawAmountIn =
    payload.amount_in !== undefined && payload.amount_in !== null
      ? payload.amount_in
      : payload.transferAmount;
  const amountIn = Number(rawAmountIn || 0);

  const rawAmountOut =
    payload.amount_out !== undefined && payload.amount_out !== null
      ? payload.amount_out
      : 0;
  const amountOut = Number(rawAmountOut || 0);

  const transferAmount = amountIn;

  // 2. Bỏ qua giao dịch tiền ra (transferType != 'in' hoặc amount_out > 0)
  if (payload.transferType && payload.transferType.toLowerCase() !== 'in') {
    return {
      success: true,
      ignored: true,
      message: 'Bỏ qua giao dịch không phải tiền vào (non-incoming)',
    };
  }

  if (amountOut > 0 && amountIn <= 0) {
    return {
      success: true,
      ignored: true,
      message: 'Bỏ qua giao dịch chi tiền ra (amount_out > 0)',
    };
  }

  // 3. Tuyệt đối bỏ qua giao dịch 0đ hoặc số tiền âm
  if (transferAmount <= 0) {
    return {
      success: true,
      ignored: true,
      message: 'Bỏ qua giao dịch 0đ hoặc không có số tiền',
    };
  }

  // 4. Kiểm tra Idempotency - Không xử lý trùng lặp giao dịch
  if (sepayTransId) {
    const existingTx = await prisma.paymentTransaction.findFirst({
      where: { sepayTransId },
      include: {
        bill: true,
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    if (existingTx) {
      // Nếu trước đó bị lưu lỗi thành giao dịch 0đ UNMATCHED do lỗi mapping:
      // Tự động xóa bản ghi lỗi cũ để xử lý lại đúng dữ liệu mới
      if (existingTx.status === PaymentTransactionStatus.UNMATCHED && Number(existingTx.amount) <= 0) {
        await prisma.paymentTransaction.delete({
          where: { id: existingTx.id },
        });
      } else {
        return {
          success: true,
          duplicate: true,
          message: `Giao dịch ${sepayTransId} đã được xử lý trước đó`,
          transaction: existingTx,
        };
      }
    }
  }

  // 5. Chuẩn hóa nội dung chuyển khoản
  const rawText = (
    payload.transaction_content ||
    payload.content ||
    payload.description ||
    ''
  ).trim();

  // 6. Chuẩn hóa ngày giờ giao dịch
  let transDate = new Date();
  const rawDateStr = payload.transaction_date || payload.transactionDate;
  if (rawDateStr) {
    const cleanDateStr = rawDateStr.includes('T') ? rawDateStr : rawDateStr.replace(' ', 'T');
    const parsed = new Date(cleanDateStr);
    if (!isNaN(parsed.getTime())) {
      transDate = parsed;
    }
  }

  // 7. Chuẩn hóa cổng / tài khoản
  const gateway = payload.bank_brand_name || payload.gateway || null;
  const accountNumber = payload.account_number || payload.accountNumber || null;
  const subAccount = payload.sub_account || payload.subAccount || null;
  const displayAccount = subAccount ? `${accountNumber || ''} (${subAccount})`.trim() : accountNumber;

  const parsed = parseTransferContent(rawText);

  // TRƯỜNG HỢP 1: Nội dung không đúng cú pháp -> Lưu UNMATCHED để kế toán gạch tay
  if (!parsed.matched || !parsed.code || !parsed.month) {
    const unmatchedTx = await prisma.paymentTransaction.create({
      data: {
        sepayTransId,
        amount: transferAmount,
        content: rawText || 'Không có nội dung',
        transDate,
        gateway,
        accountNumber: displayAccount,
        status: PaymentTransactionStatus.UNMATCHED,
        unmatchedReason: 'Nội dung chuyển khoản không đúng định dạng BSTLM {Mã} T{Tháng}',
        rawPayload: JSON.stringify(payload),
      },
    });

    return {
      success: true,
      matched: false,
      message: 'Giao dịch không khớp định dạng, đã lưu vào danh sách chờ đối soát thủ công',
      transaction: unmatchedTx,
    };
  }

  // TRƯỜNG HỢP 2: Đã bóc tách được mã học sinh và tháng
  const studentCode = parsed.code;
  const month = parsed.month;
  let targetYear = parsed.year || transDate.getFullYear();

  // Tìm học sinh theo: boardingCode, studentCode hoặc id
  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { boardingCode: { equals: studentCode, mode: 'insensitive' } },
        { studentCode: { equals: studentCode, mode: 'insensitive' } },
        { id: studentCode },
      ],
    },
    include: {
      user: { select: { fullName: true } },
      class: { select: { name: true } },
    },
  });

  if (!student) {
    const unmatchedTx = await prisma.paymentTransaction.create({
      data: {
        sepayTransId,
        amount: transferAmount,
        content: rawText,
        transDate,
        gateway,
        accountNumber: displayAccount,
        status: PaymentTransactionStatus.UNMATCHED,
        unmatchedReason: `Không tìm thấy học sinh với mã "${studentCode}" trong hệ thống`,
        rawPayload: JSON.stringify(payload),
      },
    });

    return {
      success: true,
      matched: false,
      message: `Không tìm thấy học sinh với mã ${studentCode}`,
      transaction: unmatchedTx,
    };
  }

  // 1. Tìm hóa đơn đúng tháng và năm (targetYear)
  let bill = await prisma.monthlyBill.findFirst({
    where: {
      studentId: student.id,
      month,
      year: targetYear,
    },
    include: {
      transactions: true,
    },
  });

  // 2. Nếu nội dung KHÔNG ghi rõ năm (ví dụ phụ huynh chỉ gõ "T9") mà hóa đơn targetYear đã PAID hoặc không tồn tại:
  // Tự động tìm hóa đơn tháng đó đang còn nợ (UNPAID hoặc PARTIAL) để ưu tiên xóa nợ cũ
  if (!bill || (!parsed.year && bill.paymentStatus === PaymentStatus.PAID)) {
    const unpaidBill = await prisma.monthlyBill.findFirst({
      where: {
        studentId: student.id,
        month,
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
      },
      orderBy: { year: 'desc' },
      include: {
        transactions: true,
      },
    });
    if (unpaidBill) {
      bill = unpaidBill;
    }
  }

  // 3. Fallback chung nếu vẫn không tìm thấy: tìm hóa đơn gần nhất theo tháng của học sinh
  if (!bill) {
    bill = await prisma.monthlyBill.findFirst({
      where: {
        studentId: student.id,
        month,
      },
      orderBy: { year: 'desc' },
      include: {
        transactions: true,
      },
    });
  }

  if (!bill) {
    const unmatchedTx = await prisma.paymentTransaction.create({
      data: {
        sepayTransId,
        studentId: student.id,
        amount: transferAmount,
        content: rawText,
        transDate,
        gateway,
        accountNumber: displayAccount,
        status: PaymentTransactionStatus.UNMATCHED,
        unmatchedReason: `Không tìm thấy hóa đơn tháng ${month}/${targetYear} của học sinh ${student.user?.fullName} (${student.boardingCode || student.studentCode})`,
        rawPayload: JSON.stringify(payload),
      },
    });

    broadcastChange('payment_transactions', 'INSERT', { transactionId: unmatchedTx.id });

    return {
      success: true,
      matched: false,
      message: `Không tìm thấy hóa đơn tháng ${month} cho học sinh ${student.user?.fullName}`,
      transaction: unmatchedTx,
    };
  }

  // TRƯỜNG HỢP 3: Tìm thấy hóa đơn -> Tiến hành gạch nợ trong Transaction an toàn
  const result = await prisma.$transaction(async (tx) => {
    // 1. Tạo bản ghi giao dịch
    const newTx = await tx.paymentTransaction.create({
      data: {
        billId: bill.id,
        studentId: student.id,
        sepayTransId,
        amount: transferAmount,
        content: rawText,
        transDate,
        gateway,
        accountNumber: displayAccount,
        status: PaymentTransactionStatus.MATCHED,
        rawPayload: JSON.stringify(payload),
      },
    });

    // 2. Tính tổng số tiền đã đóng cho hóa đơn này
    const existingPaid = bill.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPaid = existingPaid + transferAmount;
    const finalAmount = Number(bill.finalAmount);

    let updatedStatus: PaymentStatus = bill.paymentStatus;
    if (totalPaid >= finalAmount && finalAmount > 0) {
      updatedStatus = PaymentStatus.PAID;
    } else if (totalPaid > 0) {
      updatedStatus = PaymentStatus.PARTIAL;
    }

    // 3. Cập nhật trạng thái hóa đơn
    const updatedBill = await tx.monthlyBill.update({
      where: { id: bill.id },
      data: { paymentStatus: updatedStatus },
    });

    return {
      transaction: newTx,
      bill: updatedBill,
      totalPaid,
      finalAmount,
      paymentStatus: updatedStatus,
    };
  });

  // Phát tín hiệu Realtime tức thì xuống VPS Client
  broadcastChange('monthly_bills', 'UPDATE', { billId: bill.id, studentId: student.id, paymentStatus: result.paymentStatus });
  broadcastChange('payment_transactions', 'INSERT', { transactionId: result.transaction.id });

  return {
    success: true,
    matched: true,
    studentName: student.user?.fullName,
    className: student.class?.name,
    billId: bill.id,
    month,
    year: bill.year,
    amount: transferAmount,
    totalPaid: result.totalPaid,
    finalAmount: result.finalAmount,
    paymentStatus: result.paymentStatus,
    transaction: result.transaction,
  };
}

/**
 * Gọi REST API SePay để chủ động kéo danh sách giao dịch gần nhất
 * Hỗ trợ lọc theo số tài khoản (account_number) để chỉ lấy đúng tài khoản bán trú
 */
export async function fetchSepayTransactions(limit = 50, specificAccountNumber?: string) {
  // Lấy API key từ cấu hình hệ thống hoặc biến môi trường
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'SEPAY_API_KEY' },
  });
  const apiKey = setting?.value || process.env.SEPAY_API_KEY;

  if (!apiKey || apiKey === 'your-sepay-api-key') {
    throw new Error('Chưa cấu hình SEPAY_API_KEY trong hệ thống hoặc file .env');
  }

  // Xác định số tài khoản ngân hàng SePay để lọc nếu có cấu hình
  let accNo = specificAccountNumber?.trim();
  if (!accNo) {
    const sepayAccSetting = await prisma.systemSetting.findUnique({
      where: { key: 'SEPAY_ACCOUNT_NO' },
    });
    if (sepayAccSetting?.value?.trim()) {
      accNo = sepayAccSetting.value.trim();
    }
  }

  let url = `https://my.sepay.vn/userapi/transactions/list?limit=${limit}`;
  if (accNo) {
    url += `&account_number=${encodeURIComponent(accNo)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi kết nối SePay API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  // SePay API trả về: { status: 200, messages: "success", transactions: [...] }
  const transactions: SePayWebhookPayload[] = data.transactions || data.data || [];
  return transactions;
}
