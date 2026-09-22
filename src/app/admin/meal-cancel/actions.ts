'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { broadcastChange } from '@/lib/realtime-hub';
import { getVietnamTodayUTC, isPastCutoffTime, getWeekNumber, getSchoolWeekInfo, removeVietnameseTones, parseDateValue } from '@/lib/utils';
import type { MealCancelImportRow } from '@/lib/excel';
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-log';
import { syncDailyMealSummaryForDate } from '@/lib/daily-meals';

/**
 * Duyệt 1 đơn cắt suất thủ công bởi giáo viên/admin
 */
export async function approveCancellation(id: string, note?: string) {
  try {
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán chỉ có quyền xem, không được duyệt cắt suất' };
    }
    const approverId = session?.user?.id;

    const updated = await prisma.mealCancellation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalType: 'MANUAL',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
        note: note?.trim() || null,
      },
    });

    broadcastChange('meal_cancellations', 'UPDATE', updated);
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    try {
      await syncDailyMealSummaryForDate(updated.cancelDate);
    } catch (syncErr) {
      console.error('Lỗi khi syncDailyMealSummaryForDate sau khi duyệt:', syncErr);
    }

    await logAudit({
      userId: approverId,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.APPROVE,
      module: AUDIT_MODULES.MEALS,
      description: `Duyệt đơn cắt suất ăn (ID: ${id})`,
      targetId: id,
      metadata: { note },
    });

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');
    return { success: true, message: 'Đã duyệt yêu cầu cắt suất thành công' };
  } catch (error) {
    console.error('Lỗi khi duyệt yêu cầu cắt suất:', error);
    return { success: false, error: 'Không thể duyệt yêu cầu cắt suất' };
  }
}

/**
 * Từ chối 1 đơn cắt suất thủ công bởi giáo viên/admin
 */
export async function rejectCancellation(id: string, reason?: string) {
  try {
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán chỉ có quyền xem, không được từ chối cắt suất' };
    }
    const approverId = session?.user?.id;

    const updated = await prisma.mealCancellation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvalType: 'MANUAL',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
        note: reason?.trim() || 'Giáo viên/Admin từ chối yêu cầu',
      },
    });

    broadcastChange('meal_cancellations', 'UPDATE', updated);
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    await logAudit({
      userId: approverId,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.REJECT,
      module: AUDIT_MODULES.MEALS,
      description: `Từ chối đơn cắt suất ăn (ID: ${id}): ${reason || "Không có lý do"}`,
      targetId: id,
      metadata: { reason },
    });

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');
    return { success: true, message: 'Đã từ chối yêu cầu cắt suất' };
  } catch (error) {
    console.error('Lỗi khi từ chối yêu cầu cắt suất:', error);
    return { success: false, error: 'Không thể từ chối yêu cầu cắt suất' };
  }
}

/**
 * Hủy duyệt / Khôi phục suất ăn cho học sinh (chuyển đơn APPROVED sang REJECTED)
 * Dùng khi học sinh đã được duyệt cắt suất nhưng sau đó vẫn đến ăn hoặc xin ăn lại
 */
export async function revertApprovalCancellation(id: string, reason?: string) {
  try {
    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán chỉ có quyền xem, không được thao tác' };
    }
    const approverId = session?.user?.id;

    // 1. Kiểm tra đơn tồn tại và đang ở trạng thái APPROVED
    const existing = await prisma.mealCancellation.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: 'Không tìm thấy đơn cắt suất cần hủy duyệt' };
    }

    if (existing.status !== 'APPROVED') {
      return { success: false, error: 'Đơn này hiện không ở trạng thái Đã duyệt' };
    }

    const revertReason = reason?.trim() || 'Học sinh vẫn đến ăn tại trường / xin ăn lại (GV hủy duyệt cắt suất)';

    // 2. Chuyển trạng thái sang REJECTED
    const updated = await prisma.mealCancellation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvalType: 'MANUAL',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
        note: revertReason,
      },
    });

    // 3. Phát sóng Realtime
    broadcastChange('meal_cancellations', 'UPDATE', updated);
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    const studentName = existing.student?.user?.fullName || existing.studentId;
    const className = existing.student?.class?.name || '';
    const cancelDateStr = existing.cancelDate.toISOString().split('T')[0];

    // 4. Ghi Audit Log
    await logAudit({
      userId: approverId,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || 'Quản trị viên',
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.MEALS,
      description: `Hủy duyệt cắt suất / Khôi phục suất ăn cho học sinh ${studentName} (${className}) ngày ${cancelDateStr}: ${revertReason}`,
      targetId: id,
      metadata: {
        previousStatus: 'APPROVED',
        newStatus: 'REJECTED',
        reason: revertReason,
        cancelDate: cancelDateStr,
      },
    });

    try {
      await syncDailyMealSummaryForDate(existing.cancelDate);
    } catch (syncErr) {
      console.error('Lỗi khi syncDailyMealSummaryForDate sau khi hủy duyệt cắt suất:', syncErr);
    }

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');
    return {
      success: true,
      message: `Đã hủy duyệt cắt suất và khôi phục suất ăn cho học sinh ${studentName} thành công`,
      data: updated,
    };
  } catch (error) {
    console.error('Lỗi khi hủy duyệt cắt suất:', error);
    return { success: false, error: 'Không thể hủy duyệt cắt suất' };
  }
}

/**
 * Duyệt hàng loạt các đơn cắt suất được chọn bởi giáo viên/admin
 */
export async function bulkApproveCancellations(ids: string[]) {
  try {
    if (!ids || ids.length === 0) {
      return { success: false, error: 'Không có yêu cầu nào được chọn' };
    }

    const session = await auth();
    if (session?.user?.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán không có quyền duyệt cắt suất' };
    }
    const approverId = session?.user?.id;

    const result = await prisma.mealCancellation.updateMany({
      where: {
        id: { in: ids },
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        approvalType: 'MANUAL',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
      },
    });

    broadcastChange('meal_cancellations', 'UPDATE');
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    await logAudit({
      userId: approverId,
      userName: (session?.user as any)?.name || (session?.user as any)?.username || "Quản trị viên",
      userRole: session?.user?.role,
      action: AUDIT_ACTIONS.APPROVE,
      module: AUDIT_MODULES.MEALS,
      description: `Duyệt hàng loạt ${result.count} đơn cắt suất ăn`,
      metadata: { ids, count: result.count },
    });

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');
    return { 
      success: true, 
      message: `Đã duyệt thành công ${result.count} yêu cầu cắt suất` 
    };
  } catch (error) {
    console.error('Lỗi khi duyệt hàng loạt:', error);
    return { success: false, error: 'Không thể duyệt hàng loạt yêu cầu' };
  }
}

/**
 * Tự động duyệt các đơn PENDING khi đã qua giờ chốt sáng trong Cài đặt hệ thống
 * Đọc cấu hình MEAL_LOCK_TIME_2 (fallback CUTOFF_TIME, mặc định 08:00)
 */
export async function autoApproveExpiredCancellations() {
  try {
    // 1. Lấy giờ chốt sáng từ cài đặt hệ thống
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
    });
    const cutoffTime = settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value 
                    || settings.find((s) => s.key === 'CUTOFF_TIME')?.value 
                    || '08:00';

    // 2. Kiểm tra hiện tại đã quá giờ chốt chưa
    if (!isPastCutoffTime(cutoffTime)) {
      return { 
        success: true, 
        autoApprovedCount: 0, 
        cutoffTime, 
        message: `Chưa đến giờ chốt sáng (${cutoffTime})` 
      };
    }

    // 3. Quét các đơn PENDING từ ngày hôm nay trở về trước
    const todayUTC = getVietnamTodayUTC();

    const pendingList = await prisma.mealCancellation.findMany({
      where: {
        status: 'PENDING',
        cancelDate: { lte: todayUTC },
      },
      select: { id: true, cancelDate: true },
    });

    if (pendingList.length === 0) {
      return { 
        success: true, 
        autoApprovedCount: 0, 
        cutoffTime, 
        message: 'Không có đơn nào cần tự động duyệt' 
      };
    }

    const pendingIds = pendingList.map((item) => item.id);

    // 4. Cập nhật sang APPROVED với nhãn AUTO
    const updateResult = await prisma.mealCancellation.updateMany({
      where: {
        id: { in: pendingIds },
      },
      data: {
        status: 'APPROVED',
        approvalType: 'AUTO',
        approvedBy: null,
        approvedAt: new Date(),
        note: `Hệ thống tự động duyệt lúc ${cutoffTime} (hết giờ chốt sổ, GV chưa thao tác)`,
      },
    });

    // 5. Tự động đồng bộ lại bảng chốt suất DailyMealSummary cho các ngày bị ảnh hưởng
    const distinctDates = Array.from(new Set(pendingList.map((item) => item.cancelDate.toISOString())));
    for (const dateIso of distinctDates) {
      try {
        await syncDailyMealSummaryForDate(new Date(dateIso));
      } catch (syncErr) {
        console.error(`Lỗi khi syncDailyMealSummaryForDate cho ngày ${dateIso}:`, syncErr);
      }
    }

    broadcastChange('meal_cancellations', 'UPDATE');
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');

    return {
      success: true,
      autoApprovedCount: updateResult.count,
      cutoffTime,
      message: `Đã tự động duyệt ${updateResult.count} đơn cắt suất theo giờ chốt ${cutoffTime}`,
    };
  } catch (error) {
    console.error('Lỗi khi tự động duyệt cắt suất:', error);
    return { success: false, error: 'Lỗi trong quá trình tự động duyệt' };
  }
}

/**
 * Lấy danh sách học sinh của 1 lớp và trạng thái cắt suất / đổi món vào ngày chỉ định
 * Dùng để hiển thị dữ liệu thời gian thực lên modal Cắt suất & Đổi món hàng loạt
 */
export async function getBulkActionStudentStatus(classId: string, dateStr: string) {
  try {
    if (!classId || !dateStr) {
      return { success: false, error: 'Thiếu mã lớp hoặc ngày' };
    }

    const [reqYear, reqMonth, reqDay] = dateStr.split('-').map(Number);
    const requestDate = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));

    const dayOfWeek = requestDate.getUTCDay();
    const isSunday = dayOfWeek === 0;

    // 1. Kiểm tra Cài đặt hệ thống
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['SCHOOL_YEAR_START', 'SCHOOL_YEAR_END', 'MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
    });
    const startSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_START')?.value;
    const endSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_END')?.value;
    // Giờ chốt chính thức của ngày ăn (ưu tiên MEAL_LOCK_TIME_2 từ cài đặt, fallback CUTOFF_TIME, mặc định 07:30)
    const officialCutoff = settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value 
                        || settings.find((s) => s.key === 'CUTOFF_TIME')?.value 
                        || '07:00';

    let isOutOfSchoolYear = false;
    if (startSetting && endSetting) {
      const [syY, syM, syD] = startSetting.split('-').map(Number);
      const syStart = new Date(Date.UTC(syY, syM - 1, syD));
      const [eyY, eyM, eyD] = endSetting.split('-').map(Number);
      const syEnd = new Date(Date.UTC(eyY, eyM - 1, eyD, 23, 59, 59));
      if (requestDate < syStart || requestDate > syEnd) {
        isOutOfSchoolYear = true;
      }
    }

    // 2. Kiểm tra ngày quá khứ / hôm nay / quá giờ chốt
    // Quy tắc: Giờ khóa sổ cắt suất và đổi món là giờ trong cài đặt của chính ngày ăn
    const localToday = getVietnamTodayUTC();
    const isPastDate = requestDate < localToday;
    const isToday = requestDate.getTime() === localToday.getTime();
    // Nếu là ngày hôm nay thì so sánh giờ hiện tại với giờ khóa sổ của ngày ăn; ngày quá khứ coi như đã qua; ngày tương lai chưa tới giờ khóa sổ
    const isPastCutoff = isToday ? isPastCutoffTime(officialCutoff) : isPastDate;

    const tomorrow = new Date(localToday);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const isTomorrow = requestDate.getTime() === tomorrow.getTime();

    // 3. Kiểm tra Thời khóa biểu của Lớp
    let hasSchedule = false;
    let scheduleScheduleType = 'NONE';
    if (!isSunday) {
      const dayFieldMap: Record<number, string> = {
        1: 'monday', 2: 'tuesday', 3: 'wednesday',
        4: 'thursday', 5: 'friday', 6: 'saturday',
      };
      const dayField = dayFieldMap[dayOfWeek];

      const calendarWeekNumber = getWeekNumber(requestDate);
      const schoolWeekInfo = getSchoolWeekInfo(requestDate);
      const schoolWeekNumber = schoolWeekInfo.schoolWeekNumber;
      const possibleWeeks = Array.from(new Set([calendarWeekNumber, schoolWeekNumber]));
      const possibleYears = Array.from(new Set([requestDate.getUTCFullYear(), schoolWeekInfo.calendarYear]));

      if (dayField) {
        const schedule = await prisma.classWeeklySchedule.findFirst({
          where: {
            classId,
            year: { in: possibleYears },
            weekNumber: { in: possibleWeeks },
            [dayField]: { not: 'NONE' },
          },
        });
        if (schedule) {
          hasSchedule = true;
          scheduleScheduleType = (schedule as any)[dayField] || 'LUNCH';
        } else {
          // Kiểm tra thêm xem lớp có học sinh nào có Lịch ăn đặc biệt ngày này không
          const specialCount = await prisma.studentSpecialMeal.count({
            where: {
              student: { classId },
              date: requestDate,
              shift: { not: 'NONE' },
            },
          });
          if (specialCount > 0) {
            hasSchedule = true;
            scheduleScheduleType = 'Đặc biệt';
          }
        }
      }
    }

    // 4. Lấy danh sách học sinh đang ăn bán trú (ACTIVE) của Lớp
    const students = await prisma.student.findMany({
      where: {
        classId,
        boardingStatus: 'ACTIVE',
      },
      select: {
        id: true,
        studentCode: true,
        boardingCode: true,
        mealType: true,
        user: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: [
        { studentCode: 'asc' },
        { id: 'asc' },
      ],
    });

    const studentIds = students.map((s) => s.id);

    // 5. Lấy danh sách đơn cắt suất trong ngày của các học sinh này
    const cancellations = await prisma.mealCancellation.findMany({
      where: {
        studentId: { in: studentIds },
        cancelDate: requestDate,
      },
      select: {
        studentId: true,
        status: true,
        reason: true,
        approvalType: true,
      },
    });

    // 6. Lấy danh sách đổi món trong ngày của các học sinh này
    const overrides = await prisma.mealOverride.findMany({
      where: {
        studentId: { in: studentIds },
        date: requestDate,
      },
      select: {
        studentId: true,
        mealType: true,
      },
    });

    const studentData = students.map((s) => {
      const cancel = cancellations.find((c) => c.studentId === s.id);
      const override = overrides.find((o) => o.studentId === s.id);
      return {
        id: s.id,
        studentCode: s.studentCode,
        boardingCode: s.boardingCode,
        fullName: s.user?.fullName || s.id,
        mealType: s.mealType,
        cancellation: cancel ? {
          status: cancel.status,
          reason: cancel.reason,
          approvalType: cancel.approvalType,
        } : null,
        override: override ? {
          mealType: override.mealType,
        } : null,
      };
    });

    return {
      success: true,
      data: {
        isSunday,
        isOutOfSchoolYear,
        hasSchedule,
        scheduleScheduleType,
        isPastDate,
        isToday,
        isTomorrow,
        isPastCutoff,
        isPastMorningCutoff: isPastCutoff,
        isPastAfternoonCutoff: isPastCutoff,
        cutoffTime: officialCutoff,
        cutoffMorning: officialCutoff,
        cutoffAfternoon: officialCutoff,
        students: studentData,
      },
    };
  } catch (error) {
    console.error('Lỗi khi lấy thông tin học sinh cho thao tác hàng loạt:', error);
    return { success: false, error: 'Không thể lấy danh sách học sinh của lớp' };
  }
}

/**
 * Server Action: Tạo và duyệt cắt suất ăn hàng loạt cho giáo viên/quản lý
 */
export async function bulkCreateAndApproveCancellations(params: {
  classId: string;
  studentIds: string[];
  cancelDate: string; // YYYY-MM-DD
  reason: string;
  autoApprove?: boolean;
  bypassCutoff?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (session.user.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán không có quyền tạo đơn cắt suất' };
    }

    const { classId, studentIds, cancelDate, reason, autoApprove = true, bypassCutoff = false } = params;

    if (!classId || !studentIds || studentIds.length === 0) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 học sinh' };
    }

    if (!cancelDate) {
      return { success: false, error: 'Vui lòng chọn ngày cắt suất' };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: 'Vui lòng nhập lý do cắt suất' };
    }

    const [reqYear, reqMonth, reqDay] = cancelDate.split('-').map(Number);
    const requestDate = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));

    // 1. Kiểm tra Chủ nhật
    if (requestDate.getUTCDay() === 0) {
      return { success: false, error: 'Không thể cắt suất vào Chủ nhật (không có suất ăn bán trú)' };
    }

    // 2. Kiểm tra Năm học
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['SCHOOL_YEAR_START', 'SCHOOL_YEAR_END', 'MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
    });
    const startSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_START')?.value;
    const endSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_END')?.value;
    const cutoffTime = settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value 
                    || settings.find((s) => s.key === 'CUTOFF_TIME')?.value 
                    || '07:00';

    if (startSetting && endSetting) {
      const [syY, syM, syD] = startSetting.split('-').map(Number);
      const syStart = new Date(Date.UTC(syY, syM - 1, syD));
      const [eyY, eyM, eyD] = endSetting.split('-').map(Number);
      const syEnd = new Date(Date.UTC(eyY, eyM - 1, eyD, 23, 59, 59));
      if (requestDate < syStart || requestDate > syEnd) {
        return { success: false, error: 'Ngày yêu cầu không nằm trong thời gian Năm học hiện tại.' };
      }
    }

    // 3. Kiểm tra Giờ chốt & Quá khứ: Admin hoặc có cờ bypassCutoff được phép cắt suất sau giờ chốt sáng
    const localToday = getVietnamTodayUTC();
    const isPastDate = requestDate < localToday;
    const isToday = requestDate.getTime() === localToday.getTime();
    const isAdmin = session.user.role === 'ADMIN';

    if (isPastDate) {
      return { success: false, error: 'Không thể cắt suất cho ngày trong quá khứ.' };
    }
    if (isToday && isPastCutoffTime(cutoffTime) && !isAdmin && !bypassCutoff) {
      return { 
        success: false, 
        error: `Đã quá giờ khóa sổ của ngày hôm nay (${cutoffTime}). Hệ thống chỉ cho phép cắt suất từ ngày tiếp theo.` 
      };
    }

    // 4. Kiểm tra TKB của lớp
    const dayOfWeek = requestDate.getUTCDay();
    const dayFieldMap: Record<number, string> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    const dayField = dayFieldMap[dayOfWeek];
    const calendarWeekNumber = getWeekNumber(requestDate);
    const schoolWeekInfo = getSchoolWeekInfo(requestDate);
    const schoolWeekNumber = schoolWeekInfo.schoolWeekNumber;
    const possibleWeeks = Array.from(new Set([calendarWeekNumber, schoolWeekNumber]));
    const possibleYears = Array.from(new Set([requestDate.getUTCFullYear(), schoolWeekInfo.calendarYear]));

    const schedule = await prisma.classWeeklySchedule.findFirst({
      where: {
        classId,
        year: { in: possibleYears },
        weekNumber: { in: possibleWeeks },
        [dayField]: { not: 'NONE' },
      },
    });

    if (!schedule) {
      // Kiểm tra xem các học sinh được chọn có Lịch ăn đặc biệt ngày này không
      const specialMealsCount = await prisma.studentSpecialMeal.count({
        where: {
          studentId: { in: studentIds },
          date: requestDate,
          shift: { not: 'NONE' },
        },
      });

      if (specialMealsCount === 0) {
        return { success: false, error: `Lớp và các học sinh được chọn không có lịch ăn bán trú vào ngày ${cancelDate}.` };
      }
    }

    // 5. Thực thi Transaction Upsert các bản ghi MealCancellation
    const approverId = session.user.id;
    const noteText = autoApprove
      ? `GV tạo & duyệt hàng loạt: ${reason.trim()}`
      : `GV tạo hàng loạt: ${reason.trim()}`;

    await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.mealCancellation.upsert({
          where: {
            studentId_cancelDate: {
              studentId,
              cancelDate: requestDate,
            },
          },
          update: {
            reason: reason.trim(),
            status: autoApprove ? 'APPROVED' : 'PENDING',
            approvalType: 'MANUAL',
            approvedBy: autoApprove ? approverId : null,
            approvedAt: autoApprove ? new Date() : null,
            note: noteText,
          },
          create: {
            studentId,
            cancelDate: requestDate,
            reason: reason.trim(),
            status: autoApprove ? 'APPROVED' : 'PENDING',
            approvalType: 'MANUAL',
            approvedBy: autoApprove ? approverId : null,
            approvedAt: autoApprove ? new Date() : null,
            note: noteText,
          },
        })
      )
    );

    // 6. Lấy tên lớp để ghi log
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true },
    });
    const className = cls?.name || classId;

    // 7. Ghi Audit Log
    await logAudit({
      userId: approverId,
      userName: (session.user as any)?.name || (session.user as any)?.username || 'Quản trị viên',
      userRole: session.user.role,
      action: autoApprove ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.MEALS,
      description: `${autoApprove ? 'Tạo và duyệt' : 'Tạo'} cắt suất hàng loạt cho ${studentIds.length} học sinh lớp ${className} ngày ${cancelDate}: ${reason.trim()}`,
      metadata: {
        classId,
        className,
        count: studentIds.length,
        cancelDate,
        reason: reason.trim(),
        autoApprove,
        bypassCutoff,
      },
    });

    // 8. Phát sóng Realtime & Revalidate
    broadcastChange('meal_cancellations', 'INSERT');
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    if (autoApprove) {
      try {
        await syncDailyMealSummaryForDate(requestDate);
      } catch (syncErr) {
        console.error('Lỗi khi syncDailyMealSummaryForDate sau khi bulkCancelMeals:', syncErr);
      }
    }

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');

    return {
      success: true,
      message: `Đã ${autoApprove ? 'tạo và duyệt' : 'tạo'} thành công cắt suất cho ${studentIds.length} học sinh.`,
    };
  } catch (error) {
    console.error('Lỗi khi cắt suất hàng loạt:', error);
    return { success: false, error: 'Lỗi trong quá trình xử lý cắt suất hàng loạt' };
  }
}

/**
 * Server Action: Đổi món ăn hàng loạt cho học sinh của 1 lớp
 */
export async function bulkOverrideMeals(params: {
  classId: string;
  studentIds: string[];
  date: string; // YYYY-MM-DD
  mealType: 'MAN' | 'CHAY' | 'CHAO';
  bypassCutoff?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (session.user.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán không có quyền đổi món ăn' };
    }

    const { classId, studentIds, date, mealType, bypassCutoff = false } = params;

    if (!classId || !studentIds || studentIds.length === 0) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 học sinh' };
    }

    if (!date) {
      return { success: false, error: 'Vui lòng chọn ngày áp dụng' };
    }

    if (!['MAN', 'CHAY', 'CHAO'].includes(mealType)) {
      return { success: false, error: 'Loại món ăn không hợp lệ' };
    }

    const [reqYear, reqMonth, reqDay] = date.split('-').map(Number);
    const requestDate = new Date(Date.UTC(reqYear, reqMonth - 1, reqDay));

    // 1. Kiểm tra Chủ nhật
    if (requestDate.getUTCDay() === 0) {
      return { success: false, error: 'Không thể đổi món vào Chủ nhật (không có suất ăn bán trú)' };
    }

    // 2. Kiểm tra Năm học & Cài đặt
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['SCHOOL_YEAR_START', 'SCHOOL_YEAR_END', 'MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
    });
    const startSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_START')?.value;
    const endSetting = settings.find((s) => s.key === 'SCHOOL_YEAR_END')?.value;
    const cutoffTime = settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value 
                    || settings.find((s) => s.key === 'CUTOFF_TIME')?.value 
                    || '07:30';

    if (startSetting && endSetting) {
      const [syY, syM, syD] = startSetting.split('-').map(Number);
      const syStart = new Date(Date.UTC(syY, syM - 1, syD));
      const [eyY, eyM, eyD] = endSetting.split('-').map(Number);
      const syEnd = new Date(Date.UTC(eyY, eyM - 1, eyD, 23, 59, 59));
      if (requestDate < syStart || requestDate > syEnd) {
        return { success: false, error: 'Ngày yêu cầu không nằm trong thời gian Năm học hiện tại.' };
      }
    }

    // 3. Kiểm tra Giờ chốt đổi món nếu không bypass và không phải Admin
    // Quy tắc: Giờ khóa sổ của ngày ăn là giờ trong cài đặt của chính ngày ăn đó
    const localToday = getVietnamTodayUTC();
    const isPastDate = requestDate < localToday;
    const isToday = requestDate.getTime() === localToday.getTime();
    const isAdmin = session.user.role === 'ADMIN';

    if (!bypassCutoff && !isAdmin) {
      if (isPastDate) {
        return {
          success: false,
          error: 'Không thể đổi món cho ngày đã qua nếu không xác nhận ngoại lệ.',
        };
      }
      if (isToday && isPastCutoffTime(cutoffTime)) {
        return {
          success: false,
          error: `Đã quá giờ khóa sổ trong ngày (${cutoffTime}). Cần xác nhận đổi món ngoại lệ để tiếp tục.`,
        };
      }
    }

    // 4. Kiểm tra TKB của lớp
    const dayOfWeek = requestDate.getUTCDay();
    const dayFieldMap: Record<number, string> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    const dayField = dayFieldMap[dayOfWeek];
    const calendarWeekNumber = getWeekNumber(requestDate);
    const schoolWeekInfo = getSchoolWeekInfo(requestDate);
    const schoolWeekNumber = schoolWeekInfo.schoolWeekNumber;
    const possibleWeeks = Array.from(new Set([calendarWeekNumber, schoolWeekNumber]));
    const possibleYears = Array.from(new Set([requestDate.getUTCFullYear(), schoolWeekInfo.calendarYear]));

    const schedule = await prisma.classWeeklySchedule.findFirst({
      where: {
        classId,
        year: { in: possibleYears },
        weekNumber: { in: possibleWeeks },
        [dayField]: { not: 'NONE' },
      },
    });

    if (!schedule) {
      // Kiểm tra xem các học sinh được chọn có Lịch ăn đặc biệt ngày này không
      const specialMealsCount = await prisma.studentSpecialMeal.count({
        where: {
          studentId: { in: studentIds },
          date: requestDate,
          shift: { not: 'NONE' },
        },
      });

      if (specialMealsCount === 0) {
        return { success: false, error: `Lớp và các học sinh được chọn không có lịch ăn bán trú vào ngày ${date}.` };
      }
    }

    // 5. Kiểm tra ràng buộc: Loại bỏ học sinh đã có đơn cắt suất còn hiệu lực
    const activeCancellations = await prisma.mealCancellation.findMany({
      where: {
        studentId: { in: studentIds },
        cancelDate: requestDate,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      include: {
        student: {
          select: {
            studentCode: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    if (activeCancellations.length > 0) {
      const studentNames = activeCancellations
        .map((c) => c.student.user?.fullName || c.student.studentCode)
        .slice(0, 5)
        .join(', ');
      const moreText = activeCancellations.length > 5 ? ` và ${activeCancellations.length - 5} học sinh khác` : '';
      return {
        success: false,
        error: `Có ${activeCancellations.length} học sinh đang có đơn cắt suất vào ngày này (${studentNames}${moreText}), không thể đổi món. Vui lòng bỏ chọn những học sinh này.`,
      };
    }

    // 6. Thực thi Transaction Upsert MealOverride
    await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.mealOverride.upsert({
          where: {
            studentId_date: {
              studentId,
              date: requestDate,
            },
          },
          update: {
            mealType: mealType as any,
          },
          create: {
            studentId,
            date: requestDate,
            mealType: mealType as any,
          },
        })
      )
    );

    // 7. Lấy tên lớp để ghi log
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true },
    });
    const className = cls?.name || classId;

    const mealTypeLabels: Record<string, string> = {
      MAN: 'Cơm mặn',
      CHAY: 'Cơm chay',
      CHAO: 'Cháo dinh dưỡng',
    };

    // 8. Ghi Audit Log
    await logAudit({
      userId: session.user.id,
      userName: (session.user as any)?.name || (session.user as any)?.username || 'Quản trị viên',
      userRole: session.user.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.MEALS,
      description: `Đổi món hàng loạt sang ${mealTypeLabels[mealType] || mealType} cho ${studentIds.length} học sinh lớp ${className} ngày ${date}`,
      metadata: {
        classId,
        className,
        count: studentIds.length,
        date,
        mealType,
        bypassCutoff,
      },
    });

    // 9. Phát sóng Realtime & Revalidate
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');
    broadcastChange('students', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');

    return {
      success: true,
      message: `Đã đổi món sang ${mealTypeLabels[mealType] || mealType} cho ${studentIds.length} học sinh thành công.`,
    };
  } catch (error) {
    console.error('Lỗi khi đổi món hàng loạt:', error);
    return { success: false, error: 'Lỗi trong quá trình xử lý đổi món hàng loạt' };
  }
}

/**
 * Server Action: Hủy yêu cầu đổi món của 1 học sinh (khôi phục về món mặc định)
 */
export async function deleteMealOverride(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (session.user.role === 'ACCOUNTANT') {
      return { success: false, error: 'Tài khoản Kế toán chỉ có quyền xem, không được hủy đổi món' };
    }

    const existing = await prisma.mealOverride.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: 'Không tìm thấy yêu cầu đổi món cần hủy.' };
    }

    await prisma.mealOverride.delete({
      where: { id },
    });

    // Đồng bộ lại bảng chốt suất DailyMealSummary cho ngày bị ảnh hưởng
    try {
      await syncDailyMealSummaryForDate(existing.date);
    } catch (syncErr) {
      console.error('Lỗi khi syncDailyMealSummaryForDate sau khi deleteMealOverride:', syncErr);
    }

    const studentName = existing.student?.user?.fullName || existing.studentId;
    const className = existing.student?.class?.name || '';
    const dateStr = existing.date.toISOString().split('T')[0];
    const deleteReason = reason?.trim() || 'Giáo viên/Admin hủy đổi món (khôi phục món mặc định)';

    await logAudit({
      userId: session.user.id,
      userName: (session.user as any)?.name || (session.user as any)?.username || 'Quản trị viên',
      userRole: session.user.role,
      action: AUDIT_ACTIONS.DELETE,
      module: AUDIT_MODULES.MEALS,
      description: `Hủy đổi món cho học sinh ${studentName} (${className}) ngày ${dateStr}: ${deleteReason}`,
      targetId: id,
      metadata: {
        studentId: existing.studentId,
        date: dateStr,
        mealType: existing.mealType,
        reason: deleteReason,
      },
    });

    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');
    broadcastChange('students', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');

    return {
      success: true,
      message: `Đã hủy đổi món cho học sinh ${studentName} (khôi phục về món mặc định thành công).`,
    };
  } catch (error) {
    console.error('Lỗi khi hủy đổi món:', error);
    return { success: false, error: 'Không thể hủy yêu cầu đổi món' };
  }
}

// ==================== IMPORT EXCEL CẮT SUẤT ĂN ====================

export interface ValidateRowResult {
  rowIndex: number;
  hoTen: string;
  lop: string;
  ngaySinh?: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'AMBIGUOUS';
  message: string;
  matchedStudentId?: string;
  matchedBoardingCode?: string;
  /** Danh sách HS trùng tên khi cần chọn thủ công */
  candidates?: Array<{
    studentId: string;
    boardingCode: string;
    fullName: string;
    birthDate?: string;
    parentPhone?: string;
  }>;
}

export interface ValidateImportResult {
  rows: ValidateRowResult[];
  totalOk: number;
  totalWarning: number;
  totalError: number;
  totalAmbiguous: number;
}

/**
 * Normalize tên để so sánh: lowercase + bỏ dấu + chuẩn hóa khoảng trắng
 */
function normalizeName(name: string): string {
  return removeVietnameseTones(name.trim().toLowerCase()).replace(/\s+/g, ' ');
}

/**
 * Normalize tên lớp: bỏ prefix "Lớp", trim, chuẩn hóa
 */
function normalizeClassName(name: string): string {
  return name.trim()
    .replace(/^l[oớ]p\s*/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Kiểm tra hợp lệ danh sách cắt suất import từ Excel.
 * Matching theo HoTen + Lop + NgaySinh (nếu có).
 */
export async function validateMealCancelImport(
  rows: MealCancelImportRow[]
): Promise<ValidateImportResult> {
  // 1. Lấy tất cả HS bán trú ACTIVE kèm thông tin User, Class
  const allStudents = await prisma.student.findMany({
    where: {
      boardingStatus: 'ACTIVE',
    },
    include: {
      user: { select: { fullName: true } },
      class: { select: { id: true, name: true } },
    },
  });

  // Lấy cả HS không ACTIVE để cảnh báo
  const allStudentsIncludingInactive = await prisma.student.findMany({
    include: {
      user: { select: { fullName: true } },
      class: { select: { id: true, name: true } },
    },
  });

  // 2. Lấy tất cả lớp
  const allClasses = await prisma.class.findMany({ select: { id: true, name: true } });
  const classNameMap = new Map<string, string>(); // normalizedName -> classId
  for (const cls of allClasses) {
    classNameMap.set(normalizeClassName(cls.name), cls.id);
    classNameMap.set(normalizeClassName(cls.id), cls.id);
  }

  // 3. Lấy MealCancellation hôm nay
  const todayUTC = getVietnamTodayUTC();
  const existingCancellations = await prisma.mealCancellation.findMany({
    where: { cancelDate: todayUTC },
    select: { studentId: true, status: true },
  });
  const cancellationMap = new Map(existingCancellations.map((c) => [c.studentId, c.status]));

  // 4. Lấy TKB hôm nay
  const dayOfWeek = todayUTC.getUTCDay();
  const dayFieldMap: Record<number, string> = {
    1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday',
  };
  const dayField = dayFieldMap[dayOfWeek];

  // 5. Validate từng dòng
  const results: ValidateRowResult[] = [];
  const seenKeys = new Set<string>(); // Detect trùng trong file

  for (const row of rows) {
    const result: ValidateRowResult = {
      rowIndex: row.stt,
      hoTen: row.hoTen,
      lop: row.lop,
      ngaySinh: row.ngaySinh,
      status: 'OK',
      message: '',
    };

    // 5.1 Tìm lớp
    const normalizedLop = normalizeClassName(row.lop);
    const classId = classNameMap.get(normalizedLop);

    if (!classId) {
      // Thử tìm gần đúng
      let bestMatch = '';
      let bestDist = Infinity;
      for (const [normName, cId] of classNameMap) {
        const dist = levenshteinDistance(normalizedLop, normName);
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = cId;
        }
      }
      if (bestDist <= 2) {
        result.status = 'ERROR';
        const matchedClass = allClasses.find(c => c.id === bestMatch);
        result.message = `Lớp "${row.lop}" không tồn tại. Bạn có ý là "${matchedClass?.name || bestMatch}"?`;
      } else {
        result.status = 'ERROR';
        result.message = `Lớp "${row.lop}" không tồn tại trong hệ thống`;
      }
      results.push(result);
      continue;
    }

    // 5.2 Tìm HS trong lớp theo tên (exact match sau normalize)
    const normalizedHoTen = normalizeName(row.hoTen);

    // Tìm trong tất cả HS (cả ACTIVE và không ACTIVE) để có thể cảnh báo chính xác
    const matchesAll = allStudentsIncludingInactive.filter(
      (s) => s.classId === classId && normalizeName(s.user?.fullName || '') === normalizedHoTen
    );

    const matchesActive = matchesAll.filter((s) => s.boardingStatus === 'ACTIVE');

    if (matchesAll.length === 0) {
      // Fuzzy match trong lớp đó
      const studentsInClass = allStudentsIncludingInactive.filter((s) => s.classId === classId);
      let bestFuzzy: typeof studentsInClass[0] | null = null;
      let bestDist = Infinity;
      for (const s of studentsInClass) {
        const dist = levenshteinDistance(normalizedHoTen, normalizeName(s.user?.fullName || ''));
        if (dist < bestDist) {
          bestDist = dist;
          bestFuzzy = s;
        }
      }

      if (bestFuzzy && bestDist <= 3) {
        result.status = 'AMBIGUOUS';
        result.message = `Không tìm chính xác. Bạn có ý là "${bestFuzzy.user?.fullName}" (${bestFuzzy.boardingCode || 'N/A'})?`;
        result.candidates = [{
          studentId: bestFuzzy.id,
          boardingCode: bestFuzzy.boardingCode || '',
          fullName: bestFuzzy.user?.fullName || '',
          birthDate: bestFuzzy.birthDate ? bestFuzzy.birthDate.toISOString().split('T')[0] : undefined,
          parentPhone: bestFuzzy.parentPhone || undefined,
        }];
      } else {
        result.status = 'ERROR';
        result.message = `Không tìm thấy HS "${row.hoTen}" trong lớp ${row.lop}`;
      }
      results.push(result);
      continue;
    }

    // HS tìm thấy nhưng không ACTIVE
    if (matchesActive.length === 0) {
      result.status = 'WARNING';
      result.message = `HS "${row.hoTen}" không đăng ký bán trú → Bỏ qua`;
      results.push(result);
      continue;
    }

    // 5.3 Xử lý trùng tên
    let matchedStudent = matchesActive[0];

    if (matchesActive.length > 1) {
      // Thử dùng NgaySinh để phân biệt
      if (row.ngaySinh) {
        const inputBirthDate = row.ngaySinh; // DD/MM/YYYY string
        const matchByBirth = matchesActive.filter((s) => {
          if (!s.birthDate) return false;
          const dbDate = s.birthDate.toISOString().split('T')[0]; // YYYY-MM-DD
          // Convert input DD/MM/YYYY to YYYY-MM-DD for comparison
          const parts = inputBirthDate.split('/');
          if (parts.length === 3) {
            const comparable = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            return dbDate === comparable;
          }
          return false;
        });

        if (matchByBirth.length === 1) {
          matchedStudent = matchByBirth[0];
          // Resolved by birth date!
        } else {
          // NgaySinh didn't help — still ambiguous
          result.status = 'AMBIGUOUS';
          result.message = `Tìm thấy ${matchesActive.length} HS cùng tên "${row.hoTen}" lớp ${row.lop}, ngày sinh không khớp → Cần chọn thủ công`;
          result.candidates = matchesActive.map((s) => ({
            studentId: s.id,
            boardingCode: s.boardingCode || '',
            fullName: s.user?.fullName || '',
            birthDate: s.birthDate ? s.birthDate.toISOString().split('T')[0] : undefined,
            parentPhone: s.parentPhone || undefined,
          }));
          results.push(result);
          continue;
        }
      } else {
        // Không có NgaySinh → cần chọn thủ công
        result.status = 'AMBIGUOUS';
        result.message = `Tìm thấy ${matchesActive.length} HS cùng tên "${row.hoTen}" lớp ${row.lop} → Cần chọn thủ công`;
        result.candidates = matchesActive.map((s) => ({
          studentId: s.id,
          boardingCode: s.boardingCode || '',
          fullName: s.user?.fullName || '',
          birthDate: s.birthDate ? s.birthDate.toISOString().split('T')[0] : undefined,
          parentPhone: s.parentPhone || undefined,
        }));
        results.push(result);
        continue;
      }
    }

    // 5.4 Kiểm tra trùng lặp trong file
    const dedupeKey = `${matchedStudent.id}`;
    if (seenKeys.has(dedupeKey)) {
      result.status = 'WARNING';
      result.message = `Trùng lặp trong file — HS "${row.hoTen}" đã xuất hiện ở dòng trước → Bỏ qua`;
      results.push(result);
      continue;
    }
    seenKeys.add(dedupeKey);

    // 5.5 Kiểm tra đã có đơn cắt suất hôm nay
    const existingStatus = cancellationMap.get(matchedStudent.id);
    if (existingStatus === 'APPROVED' || existingStatus === 'PENDING') {
      result.status = 'WARNING';
      result.message = `HS "${row.hoTen}" (${matchedStudent.boardingCode || 'N/A'}) đã cắt suất hôm nay (${existingStatus === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}) → Bỏ qua`;
      results.push(result);
      continue;
    }

    // 5.6 Match thành công
    result.status = 'OK';
    result.matchedStudentId = matchedStudent.id;
    result.matchedBoardingCode = matchedStudent.boardingCode || 'N/A';
    result.message = `→ ${matchedStudent.boardingCode || matchedStudent.id}`;
    results.push(result);
  }

  return {
    rows: results,
    totalOk: results.filter((r) => r.status === 'OK').length,
    totalWarning: results.filter((r) => r.status === 'WARNING').length,
    totalError: results.filter((r) => r.status === 'ERROR').length,
    totalAmbiguous: results.filter((r) => r.status === 'AMBIGUOUS').length,
  };
}

/**
 * Import cắt suất hàng loạt từ danh sách studentIds đã được validate.
 * Tạo MealCancellation (APPROVED) + sync DailyMealSummary + broadcast dining courts.
 */
export async function importMealCancellations(
  studentIds: string[],
  reason: string
) {
  try {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, error: 'Không có học sinh nào để import' };
    }

    const session = await auth();
    if (!session?.user || session.user.role === 'ACCOUNTANT') {
      return { success: false, error: 'Không có quyền thực hiện chức năng này' };
    }

    // 1. Kiểm tra giờ chốt
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
    });
    const cutoffTime = settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value
                    || settings.find((s) => s.key === 'CUTOFF_TIME')?.value
                    || '07:00';

    if (isPastCutoffTime(cutoffTime)) {
      return { success: false, error: `Đã quá giờ chốt suất (${cutoffTime}). Không thể import cắt suất cho hôm nay.` };
    }

    // 2. Ngày hôm nay
    const todayUTC = getVietnamTodayUTC();
    const approverId = session.user.id;
    const noteText = `Import Excel cắt suất: ${reason.trim()}`;

    // 3. Upsert MealCancellation hàng loạt
    let importedCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.mealCancellation.upsert({
          where: {
            studentId_cancelDate: {
              studentId,
              cancelDate: todayUTC,
            },
          },
          update: {
            reason: reason.trim(),
            status: 'APPROVED',
            approvalType: 'MANUAL',
            approvedBy: approverId,
            approvedAt: new Date(),
            note: noteText,
          },
          create: {
            studentId,
            cancelDate: todayUTC,
            reason: reason.trim(),
            status: 'APPROVED',
            approvalType: 'MANUAL',
            approvedBy: approverId,
            approvedAt: new Date(),
            note: noteText,
          },
        })
      )
    );
    importedCount = studentIds.length;

    // 4. Sync DailyMealSummary
    try {
      await syncDailyMealSummaryForDate(todayUTC);
    } catch (syncErr) {
      console.error('Lỗi khi syncDailyMealSummaryForDate sau import Excel:', syncErr);
    }

    // 5. Audit Log
    await logAudit({
      userId: approverId,
      userName: (session.user as any)?.name || (session.user as any)?.username || 'Quản trị viên',
      userRole: session.user.role,
      action: AUDIT_ACTIONS.IMPORT,
      module: AUDIT_MODULES.MEALS,
      description: `Import Excel cắt suất hàng loạt: ${importedCount} học sinh, lý do: ${reason.trim()}`,
      metadata: {
        count: importedCount,
        reason: reason.trim(),
        date: todayUTC.toISOString().split('T')[0],
      },
    });

    // 6. Broadcast & Revalidate
    broadcastChange('meal_cancellations', 'INSERT');
    broadcastChange('daily_meals', 'UPDATE');
    broadcastChange('daily_dining_courts', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');

    return {
      success: true,
      message: `Đã import thành công cắt suất cho ${importedCount} học sinh.`,
      importedCount,
      skippedCount,
    };
  } catch (error) {
    console.error('Lỗi khi import cắt suất hàng loạt từ Excel:', error);
    return { success: false, error: 'Lỗi trong quá trình import cắt suất' };
  }
}
