import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-log';

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {
      SCHOOL_NAME: '',
      MEAL_UNIT_PRICE: '35000',
      CUTOFF_TIME: '07:30',
      SCHOOL_YEAR: '2025-2026',
      DEFAULT_VISIBLE_DAYS: '["monday", "tuesday", "wednesday", "thursday", "friday"]',
      STUDENT_PORTAL_MAINTENANCE: 'false',
      STUDENT_MAINTENANCE_MESSAGE: '',
      STUDENT_SHOW_DEBT_TAB: 'false',
      STUDENT_SHOW_HISTORY_TAB: 'false',
    };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Không thể tải cài đặt hệ thống' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ' },
        { status: 400 }
      );
    }

    const updates = Object.entries(body).map(([key, value]) => {
      const stringVal = value !== null && value !== undefined ? String(value) : '';
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value: stringVal },
        create: {
          key,
          value: stringVal,
          description: '',
        },
      });
    });

    await prisma.$transaction(updates);

    const updatedKeys = Object.keys(body).join(", ");
    await logAudit({
      req: request,
      userId: session?.user?.id,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.SETTINGS,
      description: `Cập nhật cài đặt hệ thống (${updatedKeys})`,
      metadata: body,
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cài đặt hệ thống thành công',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật cài đặt hệ thống' },
      { status: 500 }
    );
  }
}
