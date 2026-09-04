import React from 'react';
import prisma from '@/lib/db';
import { ClipboardList } from 'lucide-react';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { MealCancelManager, CancellationItem } from '@/components/admin/meal-cancel-manager';
import { autoApproveExpiredCancellations } from '@/app/admin/meal-cancel/actions';

export const dynamic = 'force-dynamic';

export default async function AdminMealCancelPage() {
  // 1. Tự động kiểm tra duyệt tự động (Lazy Trigger) nếu đã quá giờ chốt sáng
  await autoApproveExpiredCancellations();

  // 2. Lấy giờ chốt sáng từ cài đặt hệ thống
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['MEAL_LOCK_TIME_2', 'CUTOFF_TIME'] } },
  });
  const cutoffTime =
    settings.find((s) => s.key === 'MEAL_LOCK_TIME_2')?.value ||
    settings.find((s) => s.key === 'CUTOFF_TIME')?.value ||
    '08:00';

  // 3. Lấy danh sách các yêu cầu đang chờ duyệt (PENDING)
  const pendingCancellations = await prisma.mealCancellation.findMany({
    where: {
      status: 'PENDING',
    },
    include: {
      student: {
        include: {
          user: true,
          class: true,
        },
      },
      approver: {
        select: {
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: [
      { cancelDate: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // 4. Lấy danh sách lịch sử các yêu cầu đã xử lý (APPROVED / REJECTED)
  const historyCancellations = await prisma.mealCancellation.findMany({
    where: {
      status: { in: ['APPROVED', 'REJECTED'] },
    },
    include: {
      student: {
        include: {
          user: true,
          class: true,
        },
      },
      approver: {
        select: {
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: [
      { cancelDate: 'desc' },
      { approvedAt: 'desc' },
    ],
    take: 500,
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      {/* Realtime: tự cập nhật khi có đơn cắt suất mới hoặc trạng thái thay đổi */}
      <RealtimeRefresher table="meal_cancellations" />
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Quản lý &amp; Duyệt yêu cầu cắt suất
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Xét duyệt các đơn xin cắt suất ăn bán trú, hỗ trợ duyệt hàng loạt và đối soát lịch sử minh bạch
              </p>
            </div>
          </div>
        </div>

        {/* Manager Component (Tabs: Pending & History) */}
        <MealCancelManager
          initialPending={pendingCancellations as unknown as CancellationItem[]}
          initialHistory={historyCancellations as unknown as CancellationItem[]}
          cutoffTime={cutoffTime}
        />
      </div>
    </div>
  );
}

