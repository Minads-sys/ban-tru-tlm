// API Route: SePay Webhook Handler
// Nhận và xử lý thông báo biến động số dư từ SePay để tự động gạch nợ tiền ăn bán trú
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processSepayTransaction, SePayWebhookPayload } from '@/lib/sepay';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[SePay Webhook] Received raw body:', rawBody);

    // 1. Xác thực bắt buộc API Key / Webhook Secret để chống giả mạo
    const secretSetting = await prisma.systemSetting.findUnique({
      where: { key: 'SEPAY_WEBHOOK_SECRET' },
    });
    const apiKeySetting = await prisma.systemSetting.findUnique({
      where: { key: 'SEPAY_API_KEY' },
    });

    const configuredKeys = [
      secretSetting?.value,
      apiKeySetting?.value,
      process.env.SEPAY_WEBHOOK_SECRET,
      process.env.SEPAY_API_KEY,
    ].filter((k): k is string => Boolean(k && k.trim() && !k.startsWith('your-sepay-')));

    const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key') || '';
    const incomingToken = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();

    // Nếu server chưa được cấu hình khóa: Chặn ngay lập tức để bảo vệ dữ liệu tài chính
    if (configuredKeys.length === 0) {
      console.error('[SePay Webhook] 403 Forbidden: Server chưa cấu hình API Key bảo mật.');
      return NextResponse.json(
        { success: false, message: 'Server security error: SEPAY_WEBHOOK_SECRET or SEPAY_API_KEY is not configured yet.' },
        { status: 403 }
      );
    }

    // Kiểm tra so khớp API Key: Phải đúng 100% với giá trị đã cấu hình
    const isAuthorized = configuredKeys.some(
      (validKey) => validKey === incomingToken || validKey === authHeader.trim()
    );

    if (!isAuthorized) {
      console.warn('[SePay Webhook] 401 Unauthorized - Phát hiện truy cập không hợp lệ hoặc sai API Key:', {
        authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Invalid or missing SePay API Key' },
        { status: 401 }
      );
    }

    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ success: true, message: 'Empty body' }, { status: 200 });
    }

    let payload: SePayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[SePay Webhook] Failed to parse JSON payload');
      return NextResponse.json({ success: true, message: 'Invalid JSON payload' }, { status: 200 });
    }

    console.log('[SePay Webhook] Processing payload for transaction:', payload.id || payload.referenceCode);

    // 2. Xử lý gạch nợ tự động thông qua thư viện sepay.ts
    const result = await processSepayTransaction(payload);

    console.log('[SePay Webhook] Result:', result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[SePay Webhook] Internal server error:', error);
    // Luôn trả về 200 để tránh SePay retry vô tận khi gặp lỗi ngoại lệ logic
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 200 }
    );
  }
}
