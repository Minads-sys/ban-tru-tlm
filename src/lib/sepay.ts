/**
 * BAN-TRU-TLM - SePay Integration Library
 * Xử lý nhận diện cú pháp, tự động gạch nợ và đồng bộ giao dịch ngân hàng
 */

import prisma from '@/lib/db';
import { PaymentStatus, PaymentTransactionStatus } from '@prisma/client';
import { broadcastChange } from '@/lib/realtime-hub';

export interface SePayWebhookPayload {
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  transferType?: 'in' | 'out' | string;
  transferAmount?: number;
  accumulated?: number;
  code?: string | null;
  content?: string;
  referenceCode?: string;
  description?: string;
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

  // Pattern 1: Chuẩn BSTLM + Mã + T + (Tháng + Năm liền nhau hoặc cách nhau)
  // Hỗ trợ: T0926, T926, T1026, T092026, T9-26, T09/26, T9 2026, T9, T09
  const bstlmRegex = /(?:^|[^A-Za-z0-9])BSTLM\s*[-_./\s]?\s*([A-Za-z0-9_-]+)\s*[-_./\s]?\s*T(?:HÁNG|HANG)?\s*(0[1-9]|1[0-2]|[1-9])(?:[\s/_-]*(\d{4}|\d{2}))?(?![0-9])/i;
  const match1 = cleanContent.match(bstlmRegex);
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
  const match2 = cleanContent.match(shortRegex);
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

  return { matched: false };
}

/**
 * Xử lý gạch nợ tự động một giao dịch từ SePay (Webhook hoặc Sync)
 */
export async function processSepayTransaction(payload: SePayWebhookPayload) {
  const sepayTransId = payload.id
    ? String(payload.id)
    : payload.referenceCode
    ? String(payload.referenceCode)
    : null;

  // 1. Kiểm tra Idempotency - Không xử lý trùng lặp giao dịch
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
      return {
        success: true,
        duplicate: true,
        message: `Giao dịch ${sepayTransId} đã được xử lý trước đó`,
        transaction: existingTx,
      };
    }
  }

  // 2. Chỉ xử lý tiền vào (in)
  if (payload.transferType && payload.transferType.toLowerCase() !== 'in') {
    return {
      success: true,
      ignored: true,
      message: 'Bỏ qua giao dịch không phải tiền vào (non-incoming)',
    };
  }

  const rawText = `${payload.content || ''} ${payload.description || ''}`.trim();
  const transferAmount = Number(payload.transferAmount || 0);

  let transDate = new Date();
  if (payload.transactionDate) {
    const parsed = new Date(payload.transactionDate);
    if (!isNaN(parsed.getTime())) {
      transDate = parsed;
    }
  }

  const parsed = parseTransferContent(rawText);

  // TRƯỜNG HỢP 1: Nội dung không đúng cú pháp -> Lưu UNMATCHED để kế toán gạch tay
  if (!parsed.matched || !parsed.code || !parsed.month) {
    const unmatchedTx = await prisma.paymentTransaction.create({
      data: {
        sepayTransId,
        amount: transferAmount,
        content: rawText || 'Không có nội dung',
        transDate,
        gateway: payload.gateway || null,
        accountNumber: payload.accountNumber || null,
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
        gateway: payload.gateway || null,
        accountNumber: payload.accountNumber || null,
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
        gateway: payload.gateway || null,
        accountNumber: payload.accountNumber || null,
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
        gateway: payload.gateway || null,
        accountNumber: payload.accountNumber || null,
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
 */
export async function fetchSepayTransactions(limit = 50) {
  // Lấy API key từ cấu hình hệ thống hoặc biến môi trường
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'SEPAY_API_KEY' },
  });
  const apiKey = setting?.value || process.env.SEPAY_API_KEY;

  if (!apiKey || apiKey === 'your-sepay-api-key') {
    throw new Error('Chưa cấu hình SEPAY_API_KEY trong hệ thống hoặc file .env');
  }

  const response = await fetch(`https://my.sepay.vn/userapi/transactions/list?limit=${limit}`, {
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
