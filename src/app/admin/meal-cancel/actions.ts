'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { broadcastChange } from '@/lib/realtime-hub';
import { getVietnamTodayUTC, isPastCutoffTime } from '@/lib/utils';
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-log';

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
      select: { id: true },
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

    broadcastChange('meal_cancellations', 'UPDATE');
    broadcastChange('daily_meals', 'UPDATE');

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

      const startOfYear = new Date(Date.UTC(requestDate.getUTCFullYear(), 0, 1));
      const weekNumber = Math.ceil(
        ((requestDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
      );

      if (dayField) {
        const schedule = await prisma.classWeeklySchedule.findFirst({
          where: {
            classId,
            year: requestDate.getUTCFullYear(),
            weekNumber,
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

    // 3. Kiểm tra Giờ chốt & Quá khứ: Tuyệt đối không cho phép cắt suất cho ngày hôm nay khi đã qua giờ chốt hoặc ngày quá khứ
    const localToday = getVietnamTodayUTC();
    const isPastDate = requestDate < localToday;
    const isToday = requestDate.getTime() === localToday.getTime();

    if (isPastDate) {
      return { success: false, error: 'Không thể cắt suất cho ngày trong quá khứ.' };
    }
    if (isToday && isPastCutoffTime(cutoffTime)) {
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
    const startOfYear = new Date(Date.UTC(requestDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      ((requestDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
    );

    const schedule = await prisma.classWeeklySchedule.findFirst({
      where: {
        classId,
        year: requestDate.getUTCFullYear(),
        weekNumber,
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

    // 3. Kiểm tra Giờ chốt đổi món nếu không bypass
    // Quy tắc: Giờ khóa sổ của ngày ăn là giờ trong cài đặt của chính ngày ăn đó
    const localToday = getVietnamTodayUTC();
    const isPastDate = requestDate < localToday;
    const isToday = requestDate.getTime() === localToday.getTime();

    if (!bypassCutoff) {
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
    const startOfYear = new Date(Date.UTC(requestDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      ((requestDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
    );

    const schedule = await prisma.classWeeklySchedule.findFirst({
      where: {
        classId,
        year: requestDate.getUTCFullYear(),
        weekNumber,
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
