import { NextRequest, NextResponse } from "next/server";
import { autoApproveExpiredCancellations } from "@/app/admin/meal-cancel/actions";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/auto-approve-meal-cancel
 * Dùng cho Cron job VPS hoặc trigger tự động
 */
export async function GET(request: NextRequest) {
  const result = await autoApproveExpiredCancellations();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const result = await autoApproveExpiredCancellations();
  return NextResponse.json(result);
}
