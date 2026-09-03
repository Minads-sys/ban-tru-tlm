// API Route: SePay Webhook Handler
// Nhận và xử lý thông báo biến động số dư từ SePay để tự động gạch nợ tiền ăn bán trú
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processSepayTransaction, SePayWebhookPayload } from '@/lib/sepay';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[SePay Webhook] Received raw body:', rawBody);

    // 1. Xác thực Webhook Secret (từ Database hoặc file .env)
    const secretSetting = await prisma.systemSetting.findUnique({
      where: { key: 'SEPAY_WEBHOOK_SECRET' },
    });
    const webhookSecret = secretSetting?.value || process.env.SEPAY_WEBHOOK_SECRET;

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
