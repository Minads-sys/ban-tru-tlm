import React from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import prisma from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ApprovalActions } from '@/components/admin/approval-actions';
import {
  ClipboardList,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { RealtimeRefresher } from '@/components/realtime-refresher';

export const dynamic = 'force-dynamic';

function formatDate(date: Date | string) {
  try {
    return format(new Date(date), 'dd/MM/yyyy', { locale: vi });
  } catch {
    return String(date);
  }
}

function formatDateTime(date: Date | string) {
  try {
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch {
    return String(date);
  }
}

export default async function AdminMealCancelPage() {
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
    },
    orderBy: [
      { cancelDate: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const totalPending = pendingCancellations.length;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      {/* Realtime: tự cập nhật khi có đơn cắt suất mới */}
      <RealtimeRefresher table="meal_cancellations" />
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Duyệt yêu cầu cắt suất
              </h1>
              <p className="text-sm text-muted-foreground">
                Xét duyệt các đơn xin cắt suất ăn bán trú từ phụ huynh và học sinh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={totalPending > 0 ? 'default' : 'secondary'}
              className="px-3 py-1.5 text-sm font-medium gap-1.5 shadow-sm"
            >
              <Clock className="h-4 w-4" />
              <span>Tổng yêu cầu chờ duyệt: {totalPending}</span>
            </Badge>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-card pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Danh sách yêu cầu đang chờ xử lý
                </CardTitle>
                <CardDescription>
                  Vui lòng kiểm tra kỹ lý do và ngày cắt suất trước khi phê duyệt hoặc từ chối
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {totalPending === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
                  <Inbox className="h-8 w-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Hiện không có yêu cầu cắt suất nào cần duyệt
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  Tất cả các yêu cầu cắt suất ăn đã được xử lý hoặc chưa có học sinh nào gửi đơn mới.
                </p>
              </div>
            ) : (
              /* Data Table */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow>
                      <TableHead className="w-12 text-center font-semibold">STT</TableHead>
                      <TableHead className="w-28 font-semibold">Mã HS</TableHead>
                      <TableHead className="font-semibold">Họ tên</TableHead>
                      <TableHead className="w-24 font-semibold">Lớp</TableHead>
                      <TableHead className="w-36 font-semibold">Ngày cắt suất</TableHead>
                      <TableHead className="font-semibold">Lý do</TableHead>
                      <TableHead className="w-40 font-semibold">Thời gian gửi</TableHead>
                      <TableHead className="w-44 text-right sm:text-center font-semibold">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCancellations.map((item, index) => {
                      const studentName = item.student?.user?.fullName || 'Chưa cập nhật';
                      const studentCode = item.studentId;
                      const className = item.student?.class?.name || item.student?.classId || '-';

                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <TableCell className="text-center font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border">
                              {studentCode}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {studentName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium bg-white">
                              {className}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              <span>{formatDate(item.cancelDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm text-slate-700">
                            <span className="line-clamp-2" title={item.reason}>
                              {item.reason}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{formatDateTime(item.createdAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right sm:text-center">
                            <ApprovalActions id={item.id} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
