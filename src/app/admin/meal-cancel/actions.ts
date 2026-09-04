'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { broadcastChange } from '@/lib/realtime-hub';
import { getVietnamTodayUTC, isPastCutoffTime } from '@/lib/utils';

/**
 * Duyệt 1 đơn cắt suất thủ công bởi giáo viên/admin
 */
export async function approveCancellation(id: string, note?: string) {
  try {
    const session = await auth();
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

    revalidatePath('/admin/meal-cancel');
    revalidatePath('/admin/daily-meals');
    return { success: true, message: 'Đã từ chối yêu cầu cắt suất' };
  } catch (error) {
    console.error('Lỗi khi từ chối yêu cầu cắt suất:', error);
    return { success: false, error: 'Không thể từ chối yêu cầu cắt suất' };
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
