// API Route: SePay Webhook Handler
// Nhận và xử lý thông báo biến động số dư từ SePay để gạch nợ tiền ăn bán trú
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PaymentStatus } from '@prisma/client';

interface SePayWebhookPayload {
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

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[SePay Webhook] Received raw body:', rawBody);

    // Xác thực Webhook Secret nếu có cấu hình trong môi trường
    const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== 'your-sepay-webhook-secret') {
      const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key') || '';
      const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();

      if (token !== webhookSecret && authHeader.trim() !== webhookSecret) {
        console.warn('[SePay Webhook] Unauthorized access attempt', { authHeader });
        return NextResponse.json(
          { success: false, message: 'Unauthorized: Invalid webhook secret' },
          { status: 401 }
        );
      }
    }

    if (!rawBody) {
      return NextResponse.json({ success: true, message: 'Empty body' }, { status: 200 });
    }

    let payload: SePayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[SePay Webhook] Failed to parse JSON payload');
      return NextResponse.json({ success: true, message: 'Invalid JSON payload' }, { status: 200 });
    }

    console.log('[SePay Webhook] Parsed payload:', payload);

    // Chỉ xử lý giao dịch tiền vào (transferType: 'in')
    if (payload.transferType && payload.transferType.toLowerCase() !== 'in') {
      console.log('[SePay Webhook] Ignoring non-incoming transaction:', payload.transferType);
      return NextResponse.json(
        { success: true, message: 'Ignoring non-incoming transaction' },
        { status: 200 }
      );
    }

    // Lấy nội dung giao dịch từ content hoặc description
    const textToMatch = `${payload.content || ''} ${payload.description || ''}`.trim();
    if (!textToMatch) {
      console.warn('[SePay Webhook] No content or description found in payload');
      return NextResponse.json(
        { success: true, message: 'No content to parse' },
        { status: 200 }
      );
    }

    // Regex trích xuất Mã học sinh và Tháng thanh toán: match "BSTLM {studentId} T{month}"
    // Hỗ trợ: "BSTLM HS001 T9", "BSTLM HS001 T09", "BSTLM HS001 T10", v.v.
    const match = textToMatch.match(/BSTLM\s+(HS\d+)\s+T(\d+)/i) || textToMatch.match(/BSTLM\s+([A-Za-z0-9_-]+)\s+T(\d+)/i);

    if (!match) {
      console.log('[SePay Webhook] Content does not match pattern BSTLM {studentId} T{month}:', textToMatch);
      return NextResponse.json(
        { success: true, message: 'Content pattern does not match meal payment format' },
        { status: 200 }
      );
    }

    const code = match[1].toUpperCase();
    const month = parseInt(match[2], 10);

    if (isNaN(month) || month < 1 || month > 12) {
      console.warn(`[SePay Webhook] Invalid month parsed: ${match[2]}`);
      return NextResponse.json(
        { success: true, message: `Invalid month: ${match[2]}` },
        { status: 200 }
      );
    }

    const sepayTransId = payload.id
      ? String(payload.id)
      : payload.referenceCode
      ? String(payload.referenceCode)
      : null;

    // Kiểm tra trùng lặp giao dịch (Idempotency)
    if (sepayTransId) {
      const existingTx = await prisma.paymentTransaction.findFirst({
        where: { sepayTransId },
      });

      if (existingTx) {
        console.log(`[SePay Webhook] Transaction ${sepayTransId} already processed.`);
        return NextResponse.json(
          { success: true, message: 'Transaction already processed', transactionId: existingTx.id },
          { status: 200 }
        );
      }
    }

    // Xác định năm giao dịch từ payload hoặc năm hiện tại
    let txYear = new Date().getFullYear();
    if (payload.transactionDate) {
      const parsedDate = new Date(payload.transactionDate);
      if (!isNaN(parsedDate.getTime())) {
        txYear = parsedDate.getFullYear();
      }
    }

    // Tìm hóa đơn hàng tháng của học sinh thông qua boardingCode
    let bill = await prisma.monthlyBill.findFirst({
      where: {
        student: {
          boardingCode: code
        },
        month,
        year: txYear,
      },
      include: {
        transactions: true,
      },
    });

    // Fallback nếu không tìm thấy đúng năm: lấy hóa đơn gần nhất theo tháng của học sinh
    if (!bill) {
      bill = await prisma.monthlyBill.findFirst({
        where: {
          student: {
            boardingCode: code
          },
          month,
        },
        orderBy: { year: 'desc' },
        include: {
          transactions: true,
        },
      });
    }

    if (!bill) {
      console.warn(`[SePay Webhook] Monthly bill not found for student ${code}, month ${month}`);
      return NextResponse.json(
        {
          success: true,
          message: `Monthly bill not found for student ${code}, month ${month}`,
        },
        { status: 200 }
      );
    }

    const transferAmount = Number(payload.transferAmount || 0);
    const transDate = payload.transactionDate ? new Date(payload.transactionDate) : new Date();
    const finalTransDate = isNaN(transDate.getTime()) ? new Date() : transDate;

    // Tạo bản ghi giao dịch thanh toán
    const newTransaction = await prisma.paymentTransaction.create({
      data: {
        billId: bill.id,
        sepayTransId,
        amount: transferAmount,
        content: payload.content || payload.description || `Thanh toán BSTLM ${code} T${month}`,
        transDate: finalTransDate,
      },
    });

    // Tính tổng số tiền đã thanh toán cho hóa đơn này
    const existingPaid = bill.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalPaid = existingPaid + transferAmount;
    const finalAmount = Number(bill.finalAmount);

    // Cập nhật trạng thái thanh toán của hóa đơn
    let updatedStatus: PaymentStatus = bill.paymentStatus;
    if (totalPaid >= finalAmount && finalAmount > 0) {
      updatedStatus = PaymentStatus.PAID;
    } else if (totalPaid > 0) {
      updatedStatus = PaymentStatus.PARTIAL;
    }

    if (updatedStatus !== bill.paymentStatus) {
      await prisma.monthlyBill.update({
        where: { id: bill.id },
        data: { paymentStatus: updatedStatus },
      });
    }

    console.log(
      `[SePay Webhook] Successfully processed payment for student ${code}, month ${month}: ` +
        `Amount=${transferAmount}, TotalPaid=${totalPaid}/${finalAmount}, Status=${updatedStatus}`
    );

    return NextResponse.json(
      {
        success: true,
        transactionId: newTransaction.id,
        billId: bill.id,
        studentId: code,
        month,
        amount: transferAmount,
        totalPaid,
        finalAmount,
        paymentStatus: updatedStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SePay Webhook] Internal server error:', error);
    // Luôn trả về 200 OK để tránh SePay retry liên tục khi có lỗi logic/hệ thống
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 200 }
    );
  }
}
