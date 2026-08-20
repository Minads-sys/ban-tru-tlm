import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {
      SCHOOL_NAME: '',
      MEAL_UNIT_PRICE: '35000',
      CUTOFF_TIME: '07:30',
      SCHOOL_YEAR: '2025-2026',
      DEFAULT_VISIBLE_DAYS: '["monday", "tuesday", "wednesday", "thursday", "friday"]',
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
