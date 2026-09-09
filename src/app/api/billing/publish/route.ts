// API Route: Quản lý Phát hành / Thu hồi hóa đơn hàng tháng (Level 3)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PaymentStatus } from '@prisma/client';
import { broadcastChange } from '@/lib/realtime-hub';

// GET: Lấy thống kê trạng thái phát hành (Draft vs Published) theo tháng, năm, lớp
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const classId = searchParams.get('classId');

    const where: Record<string, unknown> = {};

    if (month) {
      const parsedMonth = parseInt(month, 10);
      if (!isNaN(parsedMonth)) where.month = parsedMonth;
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!isNaN(parsedYear)) where.year = parsedYear;
    }

    if (classId && classId !== 'ALL' && classId !== 'all') {
      where.student = { classId };
    }

    const [totalCount, publishedCount, draftCount] = await Promise.all([
      prisma.monthlyBill.count({ where }),
      prisma.monthlyBill.count({ where: { ...where, isPublished: true } }),
      prisma.monthlyBill.count({ where: { ...where, isPublished: false } }),
    ]);

    return NextResponse.json({
      success: true,
      month: where.month,
      year: where.year,
      classId: classId || 'ALL',
      totalCount,
      publishedCount,
      draftCount,
    });
  } catch (error) {
    console.error('Billing Publish GET error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi lấy trạng thái phát hành', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Thực hiện Phát hành hoặc Thu hồi hóa đơn
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month: rawMonth, year: rawYear, classId, action = 'publish' } = body;

    const month = parseInt(rawMonth, 10);
    const year = parseInt(rawYear, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Tháng không hợp lệ (cần từ 1 đến 12)' },
        { status: 400 }
      );
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Năm không hợp lệ' },
        { status: 400 }
      );
    }

    if (action === 'publish') {
      // Phát hành: Chuyển tất cả hóa đơn DRAFT thành PUBLISHED
      const where: Record<string, unknown> = {
        month,
        year,
        isPublished: false,
      };

      if (classId && classId !== 'ALL' && classId !== 'all') {
        where.student = { classId };
      }

      const result = await prisma.monthlyBill.updateMany({
        where,
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      // Phát tín hiệu Realtime cho tất cả client (admin + học sinh)
      broadcastChange('monthly_bills', 'UPDATE');

      const scopeText = classId && classId !== 'ALL' && classId !== 'all' ? `lớp ${classId}` : 'toàn trường';
      return NextResponse.json({
        success: true,
        action: 'publish',
        count: result.count,
        message: result.count > 0
          ? `Đã phát hành thành công ${result.count} hóa đơn tháng ${month}/${year} (${scopeText}). Phụ huynh hiện đã có thể xem và thanh toán trực tuyến.`
          : `Không có hóa đơn nào ở trạng thái Bản nháp cần phát hành cho tháng ${month}/${year} (${scopeText}).`,
      });
    } else if (action === 'unpublish') {
      // Thu hồi về nháp: CHỈ áp dụng cho các hóa đơn UNPAID chưa thanh toán
      const where: Record<string, unknown> = {
        month,
        year,
        isPublished: true,
        paymentStatus: PaymentStatus.UNPAID, // Giữ nguyên các phiếu đã thanh toán hoặc thanh toán 1 phần
      };

      if (classId && classId !== 'ALL' && classId !== 'all') {
        where.student = { classId };
      }

      const result = await prisma.monthlyBill.updateMany({
        where,
        data: {
          isPublished: false,
          publishedAt: null,
        },
      });

      broadcastChange('monthly_bills', 'UPDATE');

      const scopeText = classId && classId !== 'ALL' && classId !== 'all' ? `lớp ${classId}` : 'toàn trường';
      return NextResponse.json({
        success: true,
        action: 'unpublish',
        count: result.count,
        message: result.count > 0
          ? `Đã thu hồi ${result.count} hóa đơn chưa thanh toán tháng ${month}/${year} (${scopeText}) về trạng thái Bản nháp (DRAFT). Phụ huynh sẽ tạm thời không nhìn thấy các hóa đơn này.`
          : `Không có hóa đơn chưa thanh toán nào để thu hồi về nháp cho tháng ${month}/${year} (${scopeText}).`,
      });
    } else {
      return NextResponse.json(
        { error: `Hành động không hợp lệ: ${action}. Chỉ chấp nhận 'publish' hoặc 'unpublish'.` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Billing Publish POST error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi xử lý phát hành/thu hồi hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}
