'use client';

import React, { useState, useMemo, useTransition } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  CheckSquare,
  Square,
  Users,
  Bot,
  UserCheck,
  RefreshCw,
  Loader2,
  HelpCircle,
  Info,
  CalendarX,
  UtensilsCrossed,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApprovalActions } from '@/components/admin/approval-actions';
import {
  bulkApproveCancellations,
  autoApproveExpiredCancellations,
  revertApprovalCancellation,
} from '@/app/admin/meal-cancel/actions';
import { BulkMealCancelDialog } from '@/components/admin/bulk-meal-cancel-dialog';
import { BulkMealOverrideDialog } from '@/components/admin/bulk-meal-override-dialog';
import Swal from 'sweetalert2';

export interface CancellationItem {
  id: string;
  studentId: string;
  cancelDate: string | Date;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string | Date;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  approvalType: 'MANUAL' | 'AUTO';
  note?: string | null;
  student?: {
    studentCode: string;
    classId: string;
    user?: {
      fullName: string;
      username: string;
    } | null;
    class?: {
      name: string;
    } | null;
  } | null;
  approver?: {
    fullName: string;
    role?: string;
  } | null;
}

interface MealCancelManagerProps {
  initialPending: CancellationItem[];
  initialHistory: CancellationItem[];
  cutoffTime: string;
  classes?: { id: string; name: string }[];
  isAccountant?: boolean;
}

export function MealCancelManager({
  initialPending,
  initialHistory,
  cutoffTime,
  classes = [],
  isAccountant = false,
}: MealCancelManagerProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  // Dialog states for Bulk Actions
  const [openBulkCancel, setOpenBulkCancel] = useState<boolean>(false);
  const [openBulkOverride, setOpenBulkOverride] = useState<boolean>(false);

  // Filters for Pending Tab
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [pendingClassFilter, setPendingClassFilter] = useState<string>('ALL');
  const [pendingDateFrom, setPendingDateFrom] = useState<string>('');
  const [pendingDateTo, setPendingDateTo] = useState<string>('');

  // Filters for History Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [historyDateFrom, setHistoryDateFrom] = useState<string>('');
  const [historyDateTo, setHistoryDateTo] = useState<string>('');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [localHistoryOverrides, setLocalHistoryOverrides] = useState<Record<string, Partial<CancellationItem>>>({});

  // Format helpers
  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(date);
    }
  };

  const getIsoDateString = (date: Date | string) => {
    try {
      const d = new Date(date);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const getTodayIsoString = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return String(date);
    }
  };

  // Reset helpers
  const resetPendingFilters = () => {
    setPendingSearchQuery('');
    setPendingClassFilter('ALL');
    setPendingDateFrom('');
    setPendingDateTo('');
  };

  const isPendingFiltered = Boolean(
    pendingSearchQuery.trim() ||
      pendingClassFilter !== 'ALL' ||
      pendingDateFrom ||
      pendingDateTo
  );

  const resetHistoryFilters = () => {
    setSearchQuery('');
    setFilterClass('ALL');
    setFilterStatus('ALL');
    setFilterType('ALL');
    setHistoryDateFrom('');
    setHistoryDateTo('');
  };

  const isHistoryFiltered = Boolean(
    searchQuery.trim() ||
      filterClass !== 'ALL' ||
      filterStatus !== 'ALL' ||
      filterType !== 'ALL' ||
      historyDateFrom ||
      historyDateTo
  );

  // Available classes for filter
  const availablePendingClasses = useMemo(() => {
    const set = new Set<string>();
    initialPending.forEach((item) => {
      const c = item.student?.class?.name || item.student?.classId;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [initialPending]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    initialHistory.forEach((item) => {
      const c = item.student?.class?.name || item.student?.classId;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [initialHistory]);

  // Filtered Pending
  const filteredPending = useMemo(() => {
    return initialPending.filter((item) => {
      if (pendingSearchQuery.trim()) {
        const q = pendingSearchQuery.toLowerCase();
        const name = item.student?.user?.fullName?.toLowerCase() || '';
        const code = item.student?.studentCode?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q)) return false;
      }

      if (pendingClassFilter !== 'ALL') {
        const c = item.student?.class?.name || item.student?.classId;
        if (c !== pendingClassFilter) return false;
      }

      const itemDateStr = getIsoDateString(item.cancelDate);
      if (pendingDateFrom && itemDateStr < pendingDateFrom) return false;
      if (pendingDateTo && itemDateStr > pendingDateTo) return false;

      return true;
    });
  }, [initialPending, pendingSearchQuery, pendingClassFilter, pendingDateFrom, pendingDateTo]);

  // Selection logic for Pending (based on filtered results)
  const filteredPendingIds = useMemo(() => filteredPending.map((p) => p.id), [filteredPending]);
  const isAllSelected = filteredPendingIds.length > 0 && filteredPendingIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedIds);
      filteredPendingIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredPendingIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk Approve Selected
  const handleBulkApprove = () => {
    const idsToApprove = Array.from(selectedIds);
    if (idsToApprove.length === 0) return;

    Swal.fire({
      title: `Duyệt ${idsToApprove.length} yêu cầu đã chọn?`,
      text: 'Các yêu cầu này sẽ được đánh dấu là Giáo viên duyệt thủ công.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý duyệt',
      cancelButtonText: 'Hủy bỏ',
    }).then((result) => {
      if (result.isConfirmed) {
        startBulkTransition(async () => {
          const res = await bulkApproveCancellations(idsToApprove);
          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'Thành công',
              text: res.message,
              timer: 1500,
              showConfirmButton: false,
            });
            setSelectedIds(new Set());
          } else {
            Swal.fire('Lỗi', res.error || 'Có lỗi xảy ra', 'error');
          }
        });
      }
    });
  };

  // Bulk Approve ALL (or all matching current filter)
  const handleApproveAll = () => {
    const targetIds = filteredPendingIds;
    if (targetIds.length === 0) return;

    const titleText = isPendingFiltered
      ? `Duyệt tất cả ${targetIds.length} yêu cầu đang lọc?`
      : `Duyệt tất cả ${targetIds.length} yêu cầu chờ xử lý?`;
    const bodyText = isPendingFiltered
      ? 'Toàn bộ các đơn đang hiển thị theo bộ lọc sẽ được chuyển sang trạng thái Đã duyệt bởi bạn.'
      : 'Toàn bộ đơn chờ duyệt sẽ được chuyển sang trạng thái Đã duyệt bởi bạn.';

    Swal.fire({
      title: titleText,
      text: bodyText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Duyệt toàn bộ',
      cancelButtonText: 'Hủy bỏ',
    }).then((result) => {
      if (result.isConfirmed) {
        startBulkTransition(async () => {
          const res = await bulkApproveCancellations(targetIds);
          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'Thành công',
              text: res.message,
              timer: 1500,
              showConfirmButton: false,
            });
            setSelectedIds(new Set());
          } else {
            Swal.fire('Lỗi', res.error || 'Có lỗi xảy ra', 'error');
          }
        });
      }
    });
  };

  // Trigger Auto-Approve Check Manually
  const handleCheckAutoApprove = () => {
    startBulkTransition(async () => {
      const res = await autoApproveExpiredCancellations();
      if (res.success) {
        if (res.autoApprovedCount && res.autoApprovedCount > 0) {
          Swal.fire({
            icon: 'success',
            title: 'Tự động duyệt hoàn tất',
            text: res.message,
          });
        } else {
          Swal.fire({
            icon: 'info',
            title: 'Thông báo',
            text: res.message || `Hiện tại chưa có đơn nào cần tự động duyệt (Giờ chốt: ${cutoffTime}).`,
          });
        }
      } else {
        Swal.fire('Lỗi', res.error || 'Lỗi kiểm tra', 'error');
      }
    });
  };

  // Handle Revert Approval (Restore Meal)
  const handleRevertApproval = async (item: CancellationItem) => {
    const studentName = item.student?.user?.fullName || item.student?.studentCode || 'học sinh';
    const className = item.student?.class?.name || item.student?.classId || '';
    const dateStr = formatDate(item.cancelDate);

    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Hủy duyệt & Khôi phục suất ăn?',
      html: `
        <div class="text-left text-xs space-y-2 mt-2">
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <p><span class="text-slate-500">Học sinh:</span> <strong class="text-slate-900">${studentName}</strong> ${className ? `<span class="text-slate-600 font-medium">(Lớp ${className})</span>` : ''}</p>
            <p><span class="text-slate-500">Ngày cắt suất:</span> <strong class="text-blue-700">${dateStr}</strong></p>
          </div>
          <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
            ⚠️ <strong>Hệ thống sẽ:</strong> Chuyển trạng thái đơn sang <strong>"Từ chối"</strong>. Suất ăn của học sinh sẽ được khôi phục cho nhà bếp và <strong>tính tiền ăn bình thường</strong> trên hóa đơn cuối tháng.
          </div>
        </div>
      `,
      input: 'text',
      inputLabel: 'Lý do khôi phục suất ăn (lưu vết đối soát):',
      inputValue: 'Học sinh vẫn đến ăn thực tế tại trường / xin ăn lại',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xác nhận khôi phục',
      cancelButtonText: 'Hủy bỏ',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do khôi phục!';
        }
      },
    });

    if (isConfirmed && reason) {
      setRevertingId(item.id);
      try {
        const res = await revertApprovalCancellation(item.id, reason);
        if (res.success) {
          setLocalHistoryOverrides((prev) => ({
            ...prev,
            [item.id]: {
              status: 'REJECTED',
              note: reason.trim(),
              approvedAt: new Date(),
            },
          }));
          Swal.fire({
            icon: 'success',
            title: 'Đã khôi phục suất ăn',
            text: res.message || 'Đã hủy duyệt cắt suất thành công. Suất ăn đã được khôi phục.',
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Không thể khôi phục',
            text: res.error || 'Có lỗi xảy ra',
          });
        }
      } catch (err) {
        Swal.fire('Lỗi', 'Lỗi kết nối hoặc xử lý yêu cầu', 'error');
      } finally {
        setRevertingId(null);
      }
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    const list = initialHistory.map((item) => {
      if (localHistoryOverrides[item.id]) {
        return { ...item, ...localHistoryOverrides[item.id] };
      }
      return item;
    });

    return list.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = item.student?.user?.fullName?.toLowerCase() || '';
        const code = item.student?.studentCode?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q)) return false;
      }

      // Class
      if (filterClass !== 'ALL') {
        const c = item.student?.class?.name || item.student?.classId;
        if (c !== filterClass) return false;
      }

      // Status
      if (filterStatus !== 'ALL') {
        if (item.status !== filterStatus) return false;
      }

      // Type (MANUAL vs AUTO)
      if (filterType !== 'ALL') {
        if (item.approvalType !== filterType) return false;
      }

      // Cancel Date Range
      const itemDateStr = getIsoDateString(item.cancelDate);
      if (historyDateFrom && itemDateStr < historyDateFrom) return false;
      if (historyDateTo && itemDateStr > historyDateTo) return false;

      return true;
    });
  }, [initialHistory, localHistoryOverrides, searchQuery, filterClass, filterStatus, filterType, historyDateFrom, historyDateTo]);

  return (
    <div className="space-y-6">
      {isAccountant && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-amber-800">Chế độ xem lịch sử & yêu cầu cắt suất (Kế toán)</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Tài khoản Kế toán có quyền theo dõi danh sách chờ duyệt và đối soát toàn bộ lịch sử cắt suất ăn, nhưng không thể duyệt, từ chối hoặc thao tác cắt suất/đổi món.
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Notice: Dynamic Cutoff Time */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200/80 shadow-xs gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-slate-900">
              Giờ chốt sổ cắt suất buổi sáng:{' '}
              <span className="text-blue-700 bg-white px-2 py-0.5 rounded border font-mono font-bold text-sm">
                {cutoffTime}
              </span>{' '}
              (Theo Cài đặt hệ thống)
            </div>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Học sinh gửi đơn hợp lệ trước {cutoffTime} nếu Giáo viên chưa kịp thao tác sẽ được hệ thống{' '}
              <span className="font-semibold text-emerald-700">Tự động duyệt</span> đúng giờ chốt để đảm bảo quyền lợi.
            </p>
          </div>
        </div>

        {!isAccountant && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckAutoApprove}
              disabled={isBulkPending}
              className="text-xs shrink-0 bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-2xs cursor-pointer"
            >
              {isBulkPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
              )}
              Kiểm tra Tự động duyệt
            </Button>

            <Button
              size="sm"
              onClick={() => setOpenBulkCancel(true)}
              className="text-xs shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer gap-1.5 font-medium"
            >
              <CalendarX className="h-3.5 w-3.5" />
              <span>Cắt suất hàng loạt</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setOpenBulkOverride(true)}
              className="text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer gap-1.5 font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Đổi món hàng loạt</span>
            </Button>
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-2xs h-auto">
            <TabsTrigger
              value="pending"
              className="px-4 py-2 font-medium text-xs sm:text-sm gap-2 cursor-pointer transition-all duration-150 hover:bg-slate-200/80 hover:text-slate-900 text-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm group"
            >
              <Clock className="h-4 w-4 text-amber-500 group-data-[state=active]:text-white" />
              <span>Chờ xử lý</span>
              {initialPending.length > 0 && (
                <Badge className="bg-amber-500 group-data-[state=active]:bg-white group-data-[state=active]:text-blue-700 text-white text-[11px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center rounded-full font-bold ml-1 transition-colors">
                  {initialPending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="px-4 py-2 font-medium text-xs sm:text-sm gap-2 cursor-pointer transition-all duration-150 hover:bg-slate-200/80 hover:text-slate-900 text-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm group"
            >
              <Users className="h-4 w-4 text-emerald-600 group-data-[state=active]:text-white" />
              <span>Lịch sử &amp; Đối soát</span>
              <Badge variant="outline" className="text-slate-600 bg-white group-data-[state=active]:bg-blue-700 group-data-[state=active]:text-white group-data-[state=active]:border-blue-400 text-[11px] px-1.5 py-0 h-5 ml-1 transition-colors">
                {initialHistory.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Quick Stats */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              Chờ duyệt: <strong className="text-slate-800">{initialPending.length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Đã duyệt: <strong className="text-slate-800">{initialHistory.filter((h) => (localHistoryOverrides[h.id]?.status || h.status) === 'APPROVED').length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
              Từ chối: <strong className="text-slate-800">{initialHistory.filter((h) => (localHistoryOverrides[h.id]?.status || h.status) === 'REJECTED').length}</strong>
            </span>
          </div>
        </div>

        {/* TAB 1: PENDING */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          {/* Filters Bar for Pending */}
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                {/* Search */}
                <div className="relative lg:col-span-4">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Tìm tên hoặc mã HS cắt suất..."
                    value={pendingSearchQuery}
                    onChange={(e) => setPendingSearchQuery(e.target.value)}
                    className="pl-9 text-xs bg-white h-9"
                  />
                </div>

                {/* Filter Class */}
                <div className="lg:col-span-3">
                  <Select value={pendingClassFilter} onValueChange={setPendingClassFilter}>
                    <SelectTrigger className="text-xs bg-white h-9">
                      <SelectValue placeholder="Chọn lớp học" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả lớp học</SelectItem>
                      {availablePendingClasses.map((c) => (
                        <SelectItem key={c} value={c}>
                          Lớp {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Filters Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 shrink-0">Ngày cắt suất từ:</span>
                    <Input
                      type="date"
                      value={pendingDateFrom}
                      onChange={(e) => setPendingDateFrom(e.target.value)}
                      className="text-xs bg-white h-8 w-36 px-2"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-600 shrink-0">đến:</span>
                    <Input
                      type="date"
                      value={pendingDateTo}
                      onChange={(e) => setPendingDateTo(e.target.value)}
                      className="text-xs bg-white h-8 w-36 px-2"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = getTodayIsoString();
                      setPendingDateFrom(today);
                      setPendingDateTo(today);
                    }}
                    className="text-xs h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                  >
                    Hôm nay
                  </Button>
                </div>

                {isPendingFiltered && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetPendingFilters}
                    className="text-xs h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 self-end sm:self-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Đặt lại bộ lọc
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardHeader className="border-b bg-slate-50/50 pb-3.5 pt-3.5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900">
                      Danh sách yêu cầu đang chờ giáo viên xử lý
                    </CardTitle>
                    {isPendingFiltered && (
                      <Badge variant="outline" className="text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                        Đang lọc: {filteredPending.length} / {initialPending.length} đơn
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Tích chọn nhiều đơn để duyệt hàng loạt hoặc bấm Từ chối nếu học sinh đi học bình thường
                  </CardDescription>
                </div>

                {/* Bulk Action Buttons */}
                {initialPending.length > 0 && !isAccountant && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleBulkApprove}
                      disabled={isBulkPending || selectedIds.size === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-8 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isBulkPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckSquare className="h-3.5 w-3.5" />
                      )}
                      <span>Duyệt đã chọn ({selectedIds.size})</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleApproveAll}
                      disabled={isBulkPending || filteredPending.length === 0}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-1.5 text-xs h-8 shadow-xs cursor-pointer"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>
                        {isPendingFiltered
                          ? `Duyệt tất cả đang lọc (${filteredPending.length})`
                          : `Duyệt tất cả (${initialPending.length})`}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {initialPending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Không có yêu cầu cắt suất nào đang chờ duyệt
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Tất cả các đơn xin cắt suất ăn bán trú đã được xử lý hoặc chưa có học sinh nào gửi đơn mới.
                  </p>
                </div>
              ) : filteredPending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2.5">
                    <Filter className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Không tìm thấy đơn nào khớp với bộ lọc
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Thử thay đổi từ khóa tìm kiếm học sinh, chọn lớp khác hoặc đổi khoảng thời gian ngày cắt suất.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetPendingFilters}
                    className="mt-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Xóa bộ lọc tìm kiếm
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        {!isAccountant ? (
                          <TableHead className="w-10 text-center">
                            <button
                              type="button"
                              onClick={toggleSelectAll}
                              className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                              title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            >
                              {isAllSelected ? (
                                <CheckSquare className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                          </TableHead>
                        ) : (
                          <TableHead className="w-4"></TableHead>
                        )}
                        <TableHead className="w-12 text-center text-xs font-semibold">STT</TableHead>
                        <TableHead className="w-28 text-xs font-semibold">Mã HS</TableHead>
                        <TableHead className="text-xs font-semibold">Họ tên học sinh</TableHead>
                        <TableHead className="w-24 text-xs font-semibold">Lớp</TableHead>
                        <TableHead className="w-32 text-xs font-semibold">Ngày cắt suất</TableHead>
                        <TableHead className="text-xs font-semibold">Lý do nghỉ ăn</TableHead>
                        <TableHead className="w-36 text-xs font-semibold">Giờ nộp đơn</TableHead>
                        <TableHead className="w-44 text-center text-xs font-semibold">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPending.map((item, index) => {
                        const studentName = item.student?.user?.fullName || 'Chưa cập nhật';
                        const studentCode = item.student?.studentCode || '-';
                        const className = item.student?.class?.name || item.student?.classId || '-';
                        const isChecked = selectedIds.has(item.id);

                        return (
                          <TableRow
                            key={item.id}
                            className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-emerald-50/30' : ''}`}
                          >
                            {!isAccountant ? (
                              <TableCell className="text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSelect(item.id)}
                                  className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300" />
                                  )}
                                </button>
                              </TableCell>
                            ) : (
                              <TableCell></TableCell>
                            )}
                            <TableCell className="text-center text-xs font-medium text-slate-500">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                {studentCode}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 text-sm">
                              {studentName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-semibold bg-white text-slate-700">
                                {className}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                                <span>{formatDate(item.cancelDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs text-xs text-slate-700">
                              <span className="line-clamp-2" title={item.reason}>
                                {item.reason}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>{formatDateTime(item.createdAt)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {isAccountant ? (
                                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs font-medium">
                                  Chờ duyệt
                                </Badge>
                              ) : (
                                <ApprovalActions id={item.id} studentName={studentName} />
                              )}
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
        </TabsContent>

        {/* TAB 2: HISTORY & AUDIT */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Filters Bar */}
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Tìm tên hoặc mã HS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs bg-white h-9"
                  />
                </div>

                {/* Filter Class */}
                <div>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="text-xs bg-white h-9">
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả lớp học</SelectItem>
                      {availableClasses.map((c) => (
                        <SelectItem key={c} value={c}>
                          Lớp {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status */}
                <div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="text-xs bg-white h-9">
                      <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                      <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                      <SelectItem value="REJECTED">Từ chối</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Approval Type */}
                <div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="text-xs bg-white h-9">
                      <SelectValue placeholder="Hình thức duyệt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả hình thức</SelectItem>
                      <SelectItem value="MANUAL">🟢 Giáo viên duyệt thủ công</SelectItem>
                      <SelectItem value="AUTO">🔵 Hệ thống tự động duyệt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Filters Row for History */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 shrink-0">Ngày cắt suất từ:</span>
                    <Input
                      type="date"
                      value={historyDateFrom}
                      onChange={(e) => setHistoryDateFrom(e.target.value)}
                      className="text-xs bg-white h-8 w-36 px-2"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-600 shrink-0">đến:</span>
                    <Input
                      type="date"
                      value={historyDateTo}
                      onChange={(e) => setHistoryDateTo(e.target.value)}
                      className="text-xs bg-white h-8 w-36 px-2"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = getTodayIsoString();
                      setHistoryDateFrom(today);
                      setHistoryDateTo(today);
                    }}
                    className="text-xs h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                  >
                    Hôm nay
                  </Button>
                </div>

                {isHistoryFiltered && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetHistoryFilters}
                    className="text-xs h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 self-end sm:self-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Đặt lại bộ lọc
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History Data Table */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="border-b bg-slate-50/50 pb-3 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Nhật ký xử lý đơn cắt suất &amp; Đối soát
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Hiển thị thông tin người duyệt, thời gian thao tác và hình thức duyệt để phân định trách nhiệm
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {isHistoryFiltered && (
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      (Tổng số: {initialHistory.length} đơn)
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs font-semibold bg-white">
                    Kết quả: {filteredHistory.length} đơn
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2.5">
                    <Filter className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Không tìm thấy đơn nào khớp với bộ lọc tìm kiếm
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Thử thay đổi từ khóa tìm kiếm học sinh, chọn lớp khác hoặc đổi khoảng thời gian ngày cắt suất.
                  </p>
                  {isHistoryFiltered && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetHistoryFilters}
                      className="mt-3 text-xs gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Xóa bộ lọc tìm kiếm
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center text-xs font-semibold">STT</TableHead>
                        <TableHead className="w-24 text-xs font-semibold">Mã HS</TableHead>
                        <TableHead className="text-xs font-semibold">Họ tên học sinh</TableHead>
                        <TableHead className="w-20 text-xs font-semibold">Lớp</TableHead>
                        <TableHead className="w-28 text-xs font-semibold">Ngày cắt suất</TableHead>
                        <TableHead className="w-36 text-xs font-semibold">Giờ nộp đơn</TableHead>
                        <TableHead className="w-28 text-center text-xs font-semibold">Trạng thái</TableHead>
                        <TableHead className="w-48 text-xs font-semibold">Hình thức &amp; Người xử lý</TableHead>
                        <TableHead className="w-36 text-xs font-semibold">Thời gian xử lý</TableHead>
                        <TableHead className="text-xs font-semibold">Ghi chú đối soát</TableHead>
                        {!isAccountant && (
                          <TableHead className="w-32 text-center text-xs font-semibold">Thao tác</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item, index) => {
                        const studentName = item.student?.user?.fullName || 'Chưa cập nhật';
                        const studentCode = item.student?.studentCode || '-';
                        const className = item.student?.class?.name || item.student?.classId || '-';
                        const approverName = item.approver?.fullName || 'Giáo viên/Admin';

                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50/60 text-xs transition-colors">
                            <TableCell className="text-center font-medium text-slate-400">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border">
                                {studentCode}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">
                              {studentName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px] bg-white">
                                {className}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-slate-800">
                              {formatDate(item.cancelDate)}
                            </TableCell>
                            <TableCell className="text-slate-500 whitespace-nowrap">
                              {formatDateTime(item.createdAt)}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.status === 'APPROVED' ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-semibold text-[11px]">
                                  Đã duyệt
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 border font-semibold text-[11px]">
                                  Từ chối
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.approvalType === 'AUTO' ? (
                                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                                  <Bot className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                  <span>Tự động (Hệ thống)</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-800">
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-medium truncate" title={approverName}>
                                    {approverName}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-500 whitespace-nowrap">
                              {formatDateTime(item.approvedAt)}
                            </TableCell>
                            <TableCell className="text-slate-600 max-w-xs">
                              <span className="line-clamp-2" title={item.note || item.reason}>
                                {item.note || item.reason}
                              </span>
                            </TableCell>
                            {!isAccountant && (
                              <TableCell className="text-center whitespace-nowrap">
                                {item.status === 'APPROVED' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRevertApproval(item)}
                                    disabled={revertingId === item.id}
                                    className="h-7 px-2.5 text-xs text-amber-700 bg-amber-50/70 hover:bg-amber-100 hover:text-amber-800 border-amber-300 gap-1.5 font-medium cursor-pointer transition-colors shadow-2xs"
                                    title="Học sinh vẫn đến ăn hoặc xin ăn lại -> Hủy duyệt cắt suất và khôi phục suất ăn"
                                  >
                                    {revertingId === item.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                    )}
                                    <span>Khôi phục suất</span>
                                  </Button>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs Cắt suất & Đổi món hàng loạt */}
      <BulkMealCancelDialog
        open={openBulkCancel}
        onOpenChange={setOpenBulkCancel}
        classes={classes}
        cutoffTime={cutoffTime}
      />

      <BulkMealOverrideDialog
        open={openBulkOverride}
        onOpenChange={setOpenBulkOverride}
        classes={classes}
        cutoffTime={cutoffTime}
      />
    </div>
  );
}
