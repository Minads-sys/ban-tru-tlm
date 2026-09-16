import { NextRequest, NextResponse } from "next/server";
import { autoApproveExpiredCancellations } from "@/app/admin/meal-cancel/actions";

export const dynamic = "force-dynamic";

/**
 * Kiểm tra xác thực Cron Secret để tránh gọi tùy ý từ bên ngoài.
 * Caller (VPS cron job) phải gửi header: x-cron-secret: <CRON_SECRET>
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Nếu chưa cấu hình secret → chặn hoàn toàn
  if (!cronSecret || cronSecret.trim() === '') return false;
  const incoming = request.headers.get('x-cron-secret') || '';
  return incoming === cronSecret;
}

/**
 * GET/POST /api/cron/auto-approve-meal-cancel
 * Dùng cho Cron job VPS hoặc trigger tự động
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await autoApproveExpiredCancellations();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await autoApproveExpiredCancellations();
  return NextResponse.json(result);
}
