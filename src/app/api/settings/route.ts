import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-log';

export async function GET() {
  try {
    // Chỉ cho phép user đã đăng nhập (staff) đọc cài đặt hệ thống
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {
      SCHOOL_NAME: '',
      SCHOOL_ADDRESS: '',
      SCHOOL_PHONE: '(028) 3829 7990',
      MEAL_UNIT_PRICE: '35000',
      CUTOFF_TIME: '16:00',
      MEAL_LOCK_TIME_1: '16:00',
      MEAL_LOCK_TIME_1_SUNDAY: '19:00',
      MEAL_LOCK_TIME_2: '07:00',
      SCHOOL_YEAR: '2026-2027',
      DEFAULT_VISIBLE_DAYS: '["monday", "tuesday", "wednesday", "thursday", "friday"]',
      STUDENT_PORTAL_MAINTENANCE: 'false',
      STUDENT_MAINTENANCE_MESSAGE: '',
      STUDENT_SHOW_DEBT_TAB: 'false',
      STUDENT_SHOW_HISTORY_TAB: 'false',
      STUDENT_PORTAL_THEME: 'red_star',
      STUDENT_PORTAL_BANNER_URL: '',
      SCHOOL_LOGO_URL: '',
      STUDENT_PORTAL_MOTTO: 'Nhiệt liệt chào mừng năm học mới',
      STUDENT_PORTAL_ANNOUNCEMENT: '',
      KITCHEN_DISPLAY_PASSKEY: '123456',
      KITCHEN_MARKET_LOCK_TIME: '20:00',
      KITCHEN_MEAL_LOCK_TIME: '08:00',
      KITCHEN_DAY_TRANSITION_TIME: '14:00',
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

    if (body.KITCHEN_DISPLAY_PASSKEY !== undefined) {
      const pin = String(body.KITCHEN_DISPLAY_PASSKEY).trim();
      if (!/^\d{6}$/.test(pin)) {
        return NextResponse.json(
          { error: "Mã khóa màn hình TV (Passkey) phải gồm đúng 6 chữ số (0-9)" },
          { status: 400 }
        );
      }
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
