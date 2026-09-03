'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { broadcastChange } from '@/lib/realtime-hub';

export async function approveCancellation(id: string) {
  try {
    const session = await auth();
    const approverId = session?.user?.id;

    const updated = await prisma.mealCancellation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
      },
    });

    broadcastChange('meal_cancellations', 'UPDATE', updated);
    broadcastChange('daily_meals', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    return { success: true, message: 'Đã duyệt yêu cầu cắt suất thành công' };
  } catch (error) {
    console.error('Lỗi khi duyệt yêu cầu cắt suất:', error);
    return { success: false, error: 'Không thể duyệt yêu cầu cắt suất' };
  }
}

export async function rejectCancellation(id: string) {
  try {
    const session = await auth();
    const approverId = session?.user?.id;

    const updated = await prisma.mealCancellation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approverId ?? null,
        approvedAt: new Date(),
      },
    });

    broadcastChange('meal_cancellations', 'UPDATE', updated);
    broadcastChange('daily_meals', 'UPDATE');

    revalidatePath('/admin/meal-cancel');
    return { success: true, message: 'Đã từ chối yêu cầu cắt suất' };
  } catch (error) {
    console.error('Lỗi khi từ chối yêu cầu cắt suất:', error);
    return { success: false, error: 'Không thể từ chối yêu cầu cắt suất' };
  }
}
