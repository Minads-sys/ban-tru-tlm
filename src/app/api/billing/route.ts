// API Route: Quản lý và Tính toán Hóa đơn tiền ăn bán trú hàng tháng (Billing)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { BoardingStatus, CancellationStatus, PaymentStatus } from '@prisma/client';
import { generateMealPaymentQR } from '@/lib/vietqr';
import { broadcastChange } from '@/lib/realtime-hub';

// GET: Lấy danh sách hóa đơn theo bộ lọc (month, year, classId, paymentStatus)
// Hỗ trợ phân trang server-side: page, limit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const classId = searchParams.get('classId');
    const paymentStatus = searchParams.get('paymentStatus');
    const studentId = searchParams.get('studentId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

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

    // Đếm tổng số records cho phân trang
    const total = await prisma.monthlyBill.count({ where });

    const skip = (page - 1) * limit;

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
      skip,
      take: limit,
    });

    // Tính tổng hợp trên toàn bộ dữ liệu (không phân trang)
    const stats = await prisma.monthlyBill.aggregate({
      where,
      _sum: { finalAmount: true },
      _count: { id: true },
    });

    const paidCount = await prisma.monthlyBill.count({
      where: { ...where, paymentStatus: 'PAID' },
    });

    const unpaidCount = await prisma.monthlyBill.count({
      where: { ...where, paymentStatus: 'UNPAID' },
    });

    return NextResponse.json({
      data: bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalBills: stats._count.id,
        totalAmount: stats._sum.finalAmount?.toString() || '0',
        paidCount,
        unpaidCount,
      },
    });
  } catch (error) {
    console.error('Billing GET error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi tải danh sách hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Tạo hóa đơn hàng tháng
// - Nếu có classId: chỉ tạo cho lớp đó (nhanh, an toàn)
// - Nếu không có classId: tạo cho tất cả học sinh ACTIVE
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month: rawMonth, year: rawYear, classId } = body;

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

    // Kiểm tra nằm trong năm học
    const schoolSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ["SCHOOL_YEAR_START", "SCHOOL_YEAR_END"] } }
    });
    const startSetting = schoolSettings.find(s => s.key === "SCHOOL_YEAR_START")?.value;
    const endSetting = schoolSettings.find(s => s.key === "SCHOOL_YEAR_END")?.value;
    
    if (startSetting && endSetting) {
      const [syY, syM] = startSetting.split("-").map(Number);
      const [eyY, eyM] = endSetting.split("-").map(Number);
      const startMonthValue = syY * 12 + syM;
      const endMonthValue = eyY * 12 + eyM;
      const requestMonthValue = year * 12 + month;
      
      if (requestMonthValue < startMonthValue || requestMonthValue > endMonthValue) {
        return NextResponse.json(
          { error: `Tháng ${month}/${year} không nằm trong thời gian của Năm học hiện tại. Vui lòng kiểm tra lại cấu hình Năm học.` },
          { status: 400 }
        );
      }
    }

    // 1. Lấy đơn giá suất ăn và cài đặt ngân hàng từ cài đặt hệ thống
    const systemSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ['MEAL_UNIT_PRICE', 'BANK_NAME', 'BANK_ACCOUNT_NO', 'BANK_ACCOUNT_NAME'] } },
    });
    
    const unitPriceSetting = systemSettings.find(s => s.key === 'MEAL_UNIT_PRICE');
    const unitPrice = unitPriceSetting ? parseFloat(unitPriceSetting.value) : 35000;

    const customBankInfo = {
      bankName: systemSettings.find(s => s.key === 'BANK_NAME')?.value,
      accountNo: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NO')?.value,
      accountName: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NAME')?.value,
    };

    // 2. Lấy danh sách học sinh đang ăn bán trú (ACTIVE), lọc theo lớp nếu có
    const studentWhere: Record<string, unknown> = {
      boardingStatus: BoardingStatus.ACTIVE,
    };
    if (classId) {
      studentWhere.classId = classId;
    }

    const activeStudents = await prisma.student.findMany({
      where: studentWhere,
      include: {
        class: true,
      },
    });

    if (activeStudents.length === 0) {
      return NextResponse.json({
        success: true,
        message: classId
          ? `Không có học sinh nào đang ăn bán trú trong lớp ${classId}`
          : 'Không có học sinh nào đang ở trạng thái ăn bán trú ACTIVE',
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

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const getWeekNumber = (d: Date): number => {
      return Math.ceil(
        ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
      );
    };

    // Tìm tất cả các tuần giao với tháng mục tiêu
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthWeekNumbers = new Set<number>();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() !== 0) { // Không tính Chủ nhật
        monthWeekNumbers.add(getWeekNumber(date));
      }
    }
    const monthWeeksList = Array.from(monthWeekNumbers).sort((a, b) => a - b);

    // Kiểm tra từng lớp xem có tuần nào trong tháng bị thiếu TKB không
    const classMissingWeeks = new Map<string, number[]>();
    const classIdToName = new Map<string, string>();
    activeStudents.forEach((s) => {
      if (s.class) classIdToName.set(s.classId, s.class.name || s.classId);
    });

    const uniqueClassIds = Array.from(new Set(activeStudents.map((s) => s.classId)));
    uniqueClassIds.forEach((cId) => {
      const missing = monthWeeksList.filter((w) => !scheduleMap.has(`${cId}_${w}`));
      if (missing.length > 0) {
        classMissingWeeks.set(cId, missing);
      }
    });

    // QUY TẮC NGHIÊM NGẶT: NẾU TẠO CHO 1 LỚP CỤ THỂ VÀ LỚP ĐÓ THIẾU TKB BẤT KỲ TUẦN NÀO:
    // Tuyệt đối không tạo hóa đơn, báo lỗi rõ ràng các tuần còn thiếu!
    if (classId && classMissingWeeks.has(classId)) {
      const missing = classMissingWeeks.get(classId)!;
      const cName = classIdToName.get(classId) || classId;
      return NextResponse.json(
        {
          error: `Lớp ${cName} chưa có Thời khóa biểu đầy đủ cho tháng ${month}/${year} (Đang thiếu: ${missing.map((w) => `Tuần ${w}`).join(', ')}). Vui lòng vào mục Thời khóa biểu để thiết lập lịch học trước khi tạo hóa đơn!`,
        },
        { status: 400 }
      );
    }

    // NẾU TẠO TOÀN TRƯỜNG VÀ TẤT CẢ CÁC LỚP ĐỀU CHƯA CÓ TKB ĐẦY ĐỦ: BÁO LỖI
    if (!classId && classMissingWeeks.size === uniqueClassIds.length) {
      return NextResponse.json(
        {
          error: `Chưa có lớp nào có Thời khóa biểu đầy đủ cho tháng ${month}/${year}. Vui lòng thiết lập Thời khóa biểu cho các lớp trước khi tạo hóa đơn!`,
        },
        { status: 400 }
      );
    }

    // Lọc ra các học sinh thuộc các lớp CÓ ĐỦ TKB 100% trong tháng
    const studentsWithFullSchedule = activeStudents.filter((s) => !classMissingWeeks.has(s.classId));

    // Hàm tính số ngày ăn theo TKB của 1 lớp trong tháng mục tiêu (Chỉ tính khi lớp có TKB, không đoán mò)
    const calculateScheduleMealDays = (cId: string): number => {
      let count = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const dayOfWeek = date.getUTCDay(); // 0=CN, 1=T2..6=T7
        if (dayOfWeek === 0) continue; // CN không tính

        const dayField = dayFieldMap[dayOfWeek];
        if (!dayField) continue;

        const weekNum = getWeekNumber(date);
        const scheduleKey = `${cId}_${weekNum}`;
        const schedule = scheduleMap.get(scheduleKey);

        if (schedule && schedule[dayField] && schedule[dayField] !== 'NONE') {
          count++;
        }
      }
      return count;
    };

    // 4. Tính số ngày cắt suất đã duyệt của tháng trước
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));

    const cancellationWhere: Record<string, unknown> = {
      status: CancellationStatus.APPROVED,
      cancelDate: {
        gte: prevMonthStart,
        lte: prevMonthEnd,
      },
    };

    if (classId) {
      cancellationWhere.student = { classId };
    }

    const approvedCancellations = await prisma.mealCancellation.findMany({
      where: cancellationWhere,
    });

    const cancellationsPerStudent = new Map<string, number>();
    approvedCancellations.forEach((c) => {
      cancellationsPerStudent.set(
        c.studentId,
        (cancellationsPerStudent.get(c.studentId) || 0) + 1
      );
    });

    // 5. Kiểm tra và bảo vệ hóa đơn đã thanh toán (PAID hoặc PARTIAL)
    const existingBills = await prisma.monthlyBill.findMany({
      where: {
        studentId: { in: studentsWithFullSchedule.map((s) => s.id) },
        month,
        year,
      },
      select: {
        studentId: true,
        paymentStatus: true,
      },
    });

    const paidOrPartialStudentIds = new Set(
      existingBills
        .filter((b) => b.paymentStatus === PaymentStatus.PAID || b.paymentStatus === PaymentStatus.PARTIAL)
        .map((b) => b.studentId)
    );

    const studentsToProcess = studentsWithFullSchedule.filter((s) => !paidOrPartialStudentIds.has(s.id));

    if (studentsToProcess.length === 0 && studentsWithFullSchedule.length > 0) {
      return NextResponse.json({
        success: true,
        message: `Tất cả ${studentsWithFullSchedule.length} học sinh đều đã có hóa đơn đã thanh toán (PAID). Hệ thống giữ nguyên dữ liệu gốc, không ghi đè.`,
        count: 0,
        preservedCount: paidOrPartialStudentIds.size,
        month,
        year,
        classId: classId || null,
      });
    }

    // 6. Tạo/Cập nhật hóa đơn cho các học sinh chưa thanh toán - dùng Prisma transaction
    let generatedCount = 0;
    const classMealDaysCache = new Map<string, number>();
    const BATCH_SIZE = 30;

    for (let i = 0; i < studentsToProcess.length; i += BATCH_SIZE) {
      const batch = studentsToProcess.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        batch.map((student) => {
          if (!classMealDaysCache.has(student.classId)) {
            classMealDaysCache.set(student.classId, calculateScheduleMealDays(student.classId));
          }

          const scheduleMealDays = classMealDaysCache.get(student.classId) || 0;
          const canceledDays = cancellationsPerStudent.get(student.id) || 0;
          const netPayableDays = scheduleMealDays;
          const previousDeduction = canceledDays * unitPrice;
          const totalAmount = netPayableDays * unitPrice;
          const finalAmount = Math.max(0, totalAmount - previousDeduction);

          const qrCodeUrl = generateMealPaymentQR(student.boardingCode || student.studentCode, month, year, finalAmount, customBankInfo);

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
        })
      );

      generatedCount += batch.length;
    }

    // Phát tín hiệu Realtime cho màn hình Hóa đơn
    broadcastChange('monthly_bills', 'UPDATE');

    const preservedCount = paidOrPartialStudentIds.size;
    const preservedText = preservedCount > 0 ? ` (Giữ nguyên ${preservedCount} hóa đơn đã thanh toán)` : '';

    let summaryMessage = classId
      ? `Đã tạo/cập nhật ${generatedCount} hóa đơn lớp ${classIdToName.get(classId) || classId} tháng ${month}/${year}${preservedText}`
      : `Đã tạo/cập nhật thành công ${generatedCount} hóa đơn cho tháng ${month}/${year}${preservedText}`;

    if (classMissingWeeks.size > 0) {
      const missingDetails = Array.from(classMissingWeeks.entries())
        .map(([cId, weeks]) => `${classIdToName.get(cId) || cId} (thiếu Tuần ${weeks.join(', ')})`)
        .join('; ');
      summaryMessage += `. ⚠️ Đã bỏ qua ${classMissingWeeks.size} lớp do chưa có đủ TKB: ${missingDetails}.`;
    }

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      count: generatedCount,
      preservedCount,
      skippedClassesCount: classMissingWeeks.size,
      month,
      year,
      classId: classId || null,
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

    const currentBill = await prisma.monthlyBill.findUnique({ 
      where: { id },
      include: { student: true }
    });
    if (!currentBill) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    const netPayableDays = scheduleMealDays;
    const totalAmount = netPayableDays * unitPrice;
    const finalAmount = Math.max(0, totalAmount - previousDeduction);
    
    // Fetch bank settings to generate QR code correctly
    const systemSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ['BANK_NAME', 'BANK_ACCOUNT_NO', 'BANK_ACCOUNT_NAME'] } },
    });
    const customBankInfo = {
      bankName: systemSettings.find(s => s.key === 'BANK_NAME')?.value,
      accountNo: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NO')?.value,
      accountName: systemSettings.find(s => s.key === 'BANK_ACCOUNT_NAME')?.value,
    };
    
    // Cập nhật QR code với số tiền mới
    const qrCodeUrl = generateMealPaymentQR(currentBill.student.boardingCode || currentBill.student.studentCode, currentBill.month, currentBill.year, finalAmount, customBankInfo);

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

    broadcastChange('monthly_bills', 'UPDATE');

    return NextResponse.json({ success: true, message: 'Cập nhật hóa đơn thành công', data: updatedBill });
  } catch (error) {
    console.error('Billing PUT error:', error);
    return NextResponse.json(
      { error: 'Lỗi khi cập nhật hóa đơn', details: String(error) },
      { status: 500 }
    );
  }
}
