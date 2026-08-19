// API Route: Quản lý và Tính toán Hóa đơn tiền ăn bán trú hàng tháng (Billing)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { BoardingStatus, CancellationStatus, PaymentStatus } from '@prisma/client';
import { generateMealPaymentQR } from '@/lib/vietqr';

// GET: Lấy danh sách hóa đơn theo bộ lọc (month, year, classId, paymentStatus)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const classId = searchParams.get('classId');
    const paymentStatus = searchParams.get('paymentStatus');
    const studentId = searchParams.get('studentId');

    const where: Record<string, unknown> = {};

    if (month) {
      const parsedMonth = parseInt(month, 10);
      if (!isNaN(parsedMonth)) where.month = parsedMonth;
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!isNaN(parsedYear)) where.year = parsedYear;
    }

    if (paymentStatus && Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
      where.paymentStatus = paymentStatus as PaymentStatus;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (classId) {
      where.student = {
        classId,
      };
    }

    let mealCancellationsQuery: any = false;
    if (month && year) {
      const parsedMonth = parseInt(month, 10);
      const parsedYear = parseInt(year, 10);
      if (!isNaN(parsedMonth) && !isNaN(parsedYear)) {
        const prevMonth = parsedMonth === 1 ? 12 : parsedMonth - 1;
        const prevYear = parsedMonth === 1 ? parsedYear - 1 : parsedYear;
        const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
        const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));
        
        mealCancellationsQuery = {
          where: {
            status: 'APPROVED',
            cancelDate: {
              gte: prevMonthStart,
              lte: prevMonthEnd,
            }
          },
          orderBy: { cancelDate: 'asc' },
          select: { cancelDate: true }
        };
      }
    }

    const bills = await prisma.monthlyBill.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                fullName: true,
                username: true,
                isActive: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            mealCancellations: mealCancellationsQuery,
          },
        },
        transactions: {
          orderBy: {
            transDate: 'desc',
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { studentId: 'asc' }],
    });

    return NextResponse.json(bills);
  } catch (error) {
    console.error('Billing GET error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi tải danh sách hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Tạo hóa đơn hàng tháng cho toàn bộ học sinh đang ăn bán trú
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month: rawMonth, year: rawYear } = body;

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

    // 1. Lấy đơn giá suất ăn từ cài đặt hệ thống
    const unitPriceSetting = await prisma.systemSetting.findUnique({
      where: { key: 'MEAL_UNIT_PRICE' },
    });
    const unitPrice = unitPriceSetting ? parseFloat(unitPriceSetting.value) : 35000;

    // 2. Lấy danh sách học sinh đang ăn bán trú (ACTIVE)
    const activeStudents = await prisma.student.findMany({
      where: {
        boardingStatus: BoardingStatus.ACTIVE,
      },
      include: {
        class: true,
      },
    });

    if (activeStudents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Không có học sinh nào đang ở trạng thái ăn bán trú ACTIVE',
        count: 0,
      });
    }

    // 3. Lấy thời khóa biểu các lớp trong năm để tính số ngày ăn dự kiến của tháng mục tiêu
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: { year },
    });

    // Map schedule theo classId và weekNumber
    const scheduleMap = new Map<string, (typeof schedules)[0]>();
    schedules.forEach((s) => {
      scheduleMap.set(`${s.classId}_${s.weekNumber}`, s);
    });

    const dayFieldMap: Record<number, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };

    // Hàm tính số ngày ăn theo TKB của 1 lớp trong tháng mục tiêu
    const calculateScheduleMealDays = (classId: string): number => {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      let count = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const dayOfWeek = date.getUTCDay(); // 0=CN, 1=T2..6=T7
        if (dayOfWeek === 0) continue; // CN không tính

        const dayField = dayFieldMap[dayOfWeek];
        if (!dayField) continue;

        const startOfYear = new Date(Date.UTC(year, 0, 1));
        const weekNumber = Math.ceil(
          ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
        );

        const scheduleKey = `${classId}_${weekNumber}`;
        const schedule = scheduleMap.get(scheduleKey);

        if (schedule) {
          if (schedule[dayField]) count++;
        } else {
          // Mặc định từ Thứ 2 đến Thứ 6 có ăn bán trú nếu chưa tạo TKB chi tiết
          if (dayOfWeek >= 1 && dayOfWeek <= 5) count++;
        }
      }

      return count;
    };

    // 4. Tính số ngày cắt suất đã duyệt của tháng trước (hoặc chu kỳ tính cấn trừ hiện tại)
    // Tháng trước để cấn trừ vào hóa đơn tháng này:
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));

    const approvedCancellations = await prisma.mealCancellation.findMany({
      where: {
        status: CancellationStatus.APPROVED,
        cancelDate: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
    });

    const cancellationsPerStudent = new Map<string, number>();
    approvedCancellations.forEach((c) => {
      cancellationsPerStudent.set(
        c.studentId,
        (cancellationsPerStudent.get(c.studentId) || 0) + 1
      );
    });

    let generatedCount = 0;
    const classMealDaysCache = new Map<string, number>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < activeStudents.length; i += BATCH_SIZE) {
      const batch = activeStudents.slice(i, i + BATCH_SIZE);

      const upsertPromises = batch.map(async (student) => {
        if (!classMealDaysCache.has(student.classId)) {
          classMealDaysCache.set(student.classId, calculateScheduleMealDays(student.classId));
        }

        const scheduleMealDays = classMealDaysCache.get(student.classId) || 0;
        const canceledDays = cancellationsPerStudent.get(student.id) || 0;
        const netPayableDays = scheduleMealDays;
        const previousDeduction = canceledDays * unitPrice;
        const totalAmount = netPayableDays * unitPrice;
        const finalAmount = Math.max(0, totalAmount - previousDeduction);

        // Tạo link VietQR thanh toán
        const qrCodeUrl = generateMealPaymentQR(student.id, month, year, finalAmount);

        return prisma.monthlyBill.upsert({
          where: {
            studentId_month_year: {
              studentId: student.id,
              month,
              year,
            },
          },
          update: {
            scheduleMealDays,
            canceledDays,
            netPayableDays,
            unitPrice,
            totalAmount,
            previousDeduction,
            finalAmount,
            qrCodeUrl,
          },
          create: {
            studentId: student.id,
            month,
            year,
            scheduleMealDays,
            canceledDays,
            netPayableDays,
            unitPrice,
            totalAmount,
            previousDeduction,
            finalAmount,
            paymentStatus: finalAmount === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
            qrCodeUrl,
          },
        });
      });

      await Promise.all(upsertPromises);
      generatedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Đã tạo/cập nhật thành công ${generatedCount} hóa đơn cho tháng ${month}/${year}`,
      count: generatedCount,
      month,
      year,
    });
  } catch (error) {
    console.error('Billing POST error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi tạo hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật thông tin 1 hóa đơn cụ thể
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, scheduleMealDays, canceledDays, unitPrice, previousDeduction, paymentStatus } = body;

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID hóa đơn' }, { status: 400 });
    }

    const currentBill = await prisma.monthlyBill.findUnique({ where: { id } });
    if (!currentBill) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    const netPayableDays = scheduleMealDays;
    const totalAmount = netPayableDays * unitPrice;
    const finalAmount = Math.max(0, totalAmount - previousDeduction);
    
    // Cập nhật QR code với số tiền mới
    const qrCodeUrl = generateMealPaymentQR(currentBill.studentId, currentBill.month, currentBill.year, finalAmount);

    const updatedBill = await prisma.monthlyBill.update({
      where: { id },
      data: {
        scheduleMealDays,
        canceledDays,
        netPayableDays,
        unitPrice,
        totalAmount,
        previousDeduction,
        finalAmount,
        paymentStatus,
        qrCodeUrl,
      }
    });

    return NextResponse.json({ success: true, message: 'Cập nhật hóa đơn thành công', data: updatedBill });
  } catch (error) {
    console.error('Billing PUT error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi cập nhật hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}
