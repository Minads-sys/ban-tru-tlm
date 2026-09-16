import prisma from '@/lib/db';
import { getWeekNumber } from '@/lib/utils';
import { BoardingStatus, CancellationStatus } from '@prisma/client';
import { broadcastChange } from '@/lib/realtime-hub';

/**
 * Đồng bộ và tính toán lại bảng DailyMealSummary cho một ngày nhất định
 * Đảm bảo số liệu chốt báo bếp luôn phản ánh đúng các đơn cắt suất và đổi món mới nhất.
 */
export async function syncDailyMealSummaryForDate(date: Date) {
  try {
    // 1. Kiểm tra xem ngày này đã có dữ liệu tổng hợp (DailyMealSummary) chưa
    const existingSummaries = await prisma.dailyMealSummary.findMany({
      where: { summaryDate: date },
    });

    if (existingSummaries.length === 0) {
      return { count: 0, message: 'Chưa có bản ghi tóm tắt nào cho ngày này' };
    }

    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const dayOfWeek = date.getUTCDay();

    const dayFieldMap: Record<number, string> = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };

    const dayField = dayFieldMap[dayOfWeek];
    if (!dayField) return { count: 0, message: 'Không có lịch ăn cho ngày Chủ nhật' };

    const weekNumber = getWeekNumber(date);
    const dateEndOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    // 2. Lấy danh sách lớp và học sinh theo thời khóa biểu
    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: y,
        weekNumber,
        [dayField]: { not: 'NONE' },
      },
      include: {
        class: {
          include: {
            students: {
              where: {
                AND: [
                  {
                    OR: [
                      { boardingStatus: BoardingStatus.ACTIVE },
                      {
                        boardingStatus: BoardingStatus.CANCELLED,
                        boardingCancelledAt: { gt: dateEndOfDay },
                      },
                    ],
                  },
                  {
                    OR: [
                      { mealStartDate: null },
                      { mealStartDate: { lte: date } },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    });

    // 3. Lấy tất cả đơn cắt suất đã duyệt (kể cả duyệt tay và máy duyệt)
    const approvedCancellations = await prisma.mealCancellation.findMany({
      where: {
        cancelDate: date,
        status: CancellationStatus.APPROVED,
      },
      select: { studentId: true },
    });
    const cancelledStudentIds = new Set(approvedCancellations.map((c) => c.studentId));

    // 4. Lấy danh sách đổi món (MealOverride)
    const mealOverrides = await prisma.mealOverride.findMany({
      where: { date },
    });
    const overrideMap = new Map(mealOverrides.map((o) => [o.studentId, o.mealType]));

    let updatedCount = 0;
    const now = new Date();

    for (const schedule of schedules) {
      const students = schedule.class.students;
      const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

      let man = 0;
      let chay = 0;
      let chao = 0;

      activeStudents.forEach((s) => {
        const finalMealType = overrideMap.get(s.id) || s.mealType;
        if (finalMealType === 'MAN') man++;
        else if (finalMealType === 'CHAY') chay++;
        else if (finalMealType === 'CHAO') chao++;
      });

      await prisma.dailyMealSummary.upsert({
        where: {
          summaryDate_classId: {
            summaryDate: date,
            classId: schedule.classId,
          },
        },
        update: {
          totalScheduleRegistered: students.length,
          totalCanceled: students.length - activeStudents.length,
          finalMan: man,
          finalChay: chay,
          finalChao: chao,
          isLocked: true,
          lockedAt: now,
        },
        create: {
          summaryDate: date,
          classId: schedule.classId,
          totalScheduleRegistered: students.length,
          totalCanceled: students.length - activeStudents.length,
          finalMan: man,
          finalChay: chay,
          finalChao: chao,
          isLocked: true,
          lockedAt: now,
        },
      });
      updatedCount++;
    }

    const dateStr = date.toISOString().split('T')[0];
    broadcastChange('daily_meals', 'UPDATE', { date: dateStr });
    return { count: updatedCount, success: true };
  } catch (error) {
    console.error('Lỗi khi đồng bộ DailyMealSummary:', error);
    return { count: 0, success: false, error };
  }
}
