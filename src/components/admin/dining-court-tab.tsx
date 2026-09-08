'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Users,
  Utensils,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Sparkles,
  Lock,
  Wand2,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format, addDays } from 'date-fns';
import { DiningAllocationResult } from '@/lib/dining-court-service';
import { DiningCourtSummaryPrint } from './dining-court-summary-print';
import { DiningCourtManualDialog } from './dining-court-manual-dialog';
import { DiningCourtWeeklyMatrix } from './dining-court-weekly-matrix';
import { splitVietnameseName } from '@/lib/utils';
import Swal from 'sweetalert2';
import { useSession } from 'next-auth/react';

interface DiningCourtTabProps {
  cutoffTime: string;
  schoolName?: string;
}

export function DiningCourtTab({ cutoffTime, schoolName }: DiningCourtTabProps) {
  const { data: session } = useSession();
  const isCashier = session?.user?.role === "CASHIER";
  const [courtViewMode, setCourtViewMode] = useState<'weekly_matrix' | 'daily_detail'>('weekly_matrix');
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState<DiningAllocationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeShift, setActiveShift] = useState<'ALL' | 'TIET_4' | 'TIET_5'>('ALL');
  const [expandedCourtIds, setExpandedCourtIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [isCreatingAuto, setIsCreatingAuto] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  const fetchData = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dining-areas?date=${dateStr}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Lỗi khi tải dữ liệu phân bổ chia sân');
      }
      setData(json);
    } catch (error) {
      console.error('Fetch dining courts error:', error);
      Swal.fire('Lỗi', error instanceof Error ? error.message : 'Không thể tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // Chốt suất ăn chính thức
  const handleLockMealsFromCourtTab = async () => {
    const result = await Swal.fire({
      title: 'Xác nhận chốt suất ăn?',
      text: `Bạn có chắc chắn muốn chốt chính thức suất ăn cho ngày ${formatDateDDMMYYYY(selectedDate)}? Sau khi chốt, số liệu sẽ được khóa báo bếp và phân sân chính thức.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý chốt ngay',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!result.isConfirmed) return;

    setIsLocking(true);
    try {
      const res = await fetch('/api/daily-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, type: 'FINAL' }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi chốt suất ăn');
      }
      Swal.fire({
        icon: 'success',
        title: 'Đã chốt số báo bếp thành công!',
        timer: 1500,
        showConfirmButton: false,
      });
      await fetchData(selectedDate);
    } catch (err) {
      console.error('Error locking meals:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể chốt suất ăn', 'error');
    } finally {
      setIsLocking(false);
    }
  };

  // Tạo phân bổ sân tự động
  const handleCreateAuto = async (isRecreate: boolean = false) => {
    if (isCashier) return;

    const confirm = await Swal.fire({
      title: isRecreate ? 'Chia lại sân tự động?' : 'Tạo chia sân tự động?',
      text: isRecreate
        ? `Thao tác này sẽ xóa cấu hình phân sân hiện tại và tự động ghép lớp theo thuật toán tối ưu (sức chứa 60 suất/sân). Bạn có muốn tiếp tục?`
        : `Hệ thống sẽ tự động ghép các lớp vào sân theo tiêu chuẩn tối ưu (sức chứa tối đa 60 suất/sân). Bạn có muốn thực hiện ngay?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b',
      confirmButtonText: isRecreate ? 'Đồng ý chia lại' : 'Tạo tự động ngay',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!confirm.isConfirmed) return;

    setIsCreatingAuto(true);
    try {
      const res = await fetch('/api/dining-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          action: 'AUTO',
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi chia sân tự động');
      }

      Swal.fire({
        icon: 'success',
        title: 'Đã phân bổ chia sân tự động thành công!',
        timer: 1500,
        showConfirmButton: false,
      });

      await fetchData(selectedDate);
    } catch (err) {
      console.error('Create auto courts error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể tạo chia sân tự động', 'error');
    } finally {
      setIsCreatingAuto(false);
    }
  };

  // Xóa phân bổ sân
  const handleDeleteAllocation = async () => {
    if (isCashier) return;

    const confirm = await Swal.fire({
      title: 'Xác nhận xóa phân bổ sân?',
      text: `Dữ liệu phân bổ chia sân của ngày ${formatDateDDMMYYYY(selectedDate)} sẽ bị xóa hoàn toàn và trở về trạng thái chưa tạo.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!confirm.isConfirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/dining-areas?date=${selectedDate}`, {
        method: 'DELETE',
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi xóa phân bổ sân');
      }

      Swal.fire({
        icon: 'success',
        title: 'Đã xóa phân bổ sân thành công!',
        timer: 1500,
        showConfirmButton: false,
      });

      await fetchData(selectedDate);
    } catch (err) {
      console.error('Delete allocation error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể xóa phân bổ sân', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedCourtIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Xuất file PDF điểm danh
  const handleExportPdf = async (shift: 'ALL' | 'TIET_4' | 'TIET_5') => {
    setIsExporting(true);
    try {
      const url = `/api/dining-areas/export-pdf?date=${selectedDate}&shift=${shift}`;
      const shiftName = shift === 'TIET_4' ? 'Tiết 4' : shift === 'TIET_5' ? 'Tiết 5' : 'Tất cả';

      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Lỗi khi tạo file PDF');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanDate = selectedDate.replace(/-/g, '');
      a.download = `Diem_Danh_San_An_${shift}_${cleanDate}.pdf`;
      document.body.appendChild(a);
      a.click();

      // Giữ blob trong 60s để browser hoàn thành ghi file
      setTimeout(() => {
        try {
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        } catch {
          // ignore
        }
      }, 60000);

      Swal.fire({
        icon: 'success',
        title: 'Xuất PDF thành công',
        text: `Đã tải về danh sách điểm danh các sân (${shiftName})!`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Export PDF error:', error);
      Swal.fire('Lỗi xuất PDF', error instanceof Error ? error.message : 'Có lỗi xảy ra', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const courtsToDisplay = React.useMemo(() => {
    if (!data || !data.isConfigured) return [];
    if (activeShift === 'TIET_4') return data.shifts.TIET_4.courts;
    if (activeShift === 'TIET_5') return data.shifts.TIET_5.courts;
    return [...data.shifts.TIET_4.courts, ...data.shifts.TIET_5.courts];
  }, [data, activeShift]);

  const formatDateDDMMYYYY = (str: string) => {
    try {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return str;
    }
  };

  // Kiểm tra có lớp chưa xếp sân không
  const hasUnassigned = React.useMemo(() => {
    if (!data?.unassignedClasses) return false;
    return data.unassignedClasses.TIET_4.length > 0 || data.unassignedClasses.TIET_5.length > 0;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* 0. Thanh chuyển đổi chế độ xem giữa Ma trận Tuần và Chi tiết Ngày */}
      <div className="no-print flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-lg shadow-2xs">
        <button
          type="button"
          onClick={() => setCourtViewMode('weekly_matrix')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            courtViewMode === 'weekly_matrix'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Thống kê theo Tuần (Ma trận)</span>
        </button>

        <button
          type="button"
          onClick={() => setCourtViewMode('daily_detail')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            courtViewMode === 'daily_detail'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Chi tiết theo Ngày (Xe cơm & Điểm danh)</span>
        </button>
      </div>

      {courtViewMode === 'weekly_matrix' ? (
        <DiningCourtWeeklyMatrix schoolName={schoolName} />
      ) : (
        <div className="space-y-6">
          {/* 1. Thanh điều khiển ngày & Nút hành động */}
          <Card className="border-slate-200 shadow-2xs bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Chọn ngày */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>Ngày ăn:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="h-8 text-xs font-medium cursor-pointer"
                >
                  Hôm nay
                </Button>
                <Button
                  type="button"
                  variant={selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className="h-8 text-xs font-medium cursor-pointer"
                >
                  Ngày mai
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchData(selectedDate)}
                disabled={loading}
                className="h-8 text-xs text-slate-600 hover:text-slate-900"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>

            {/* Các nút hành động chính (Tạo/Sửa/In/Xuất) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Nếu đã tạo phân bổ: Nút Sửa thủ công & Chia lại tự động */}
              {data?.isConfigured && !isCashier && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsManualModalOpen(true)}
                    disabled={loading || isCreatingAuto || isDeleting}
                    className="text-xs border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 shadow-2xs cursor-pointer gap-1.5 font-bold"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Sửa thủ công</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateAuto(true)}
                    disabled={loading || isCreatingAuto || isDeleting}
                    className="text-xs border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-800 shadow-2xs cursor-pointer gap-1.5 font-medium"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>{isCreatingAuto ? 'Đang chia lại...' : 'Chia lại tự động'}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteAllocation}
                    disabled={loading || isCreatingAuto || isDeleting}
                    className="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer gap-1 h-8"
                    title="Xóa phân bổ của ngày này"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}

              {/* Các nút in & xuất PDF (chỉ bật khi đã có sân) */}
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                <Button
                  size="sm"
                  onClick={() => setIsPrintSummaryOpen(true)}
                  disabled={loading || !data || !data.isConfigured || data.totalCourts === 0}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer gap-1.5 font-bold h-8"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In DS sân ({data?.totalCourts || 0})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportPdf('TIET_4')}
                  disabled={loading || isExporting || !data || !data.isConfigured || data.shifts.TIET_4.courts.length === 0}
                  className="text-xs border-orange-200 bg-orange-50/50 hover:bg-orange-100 text-orange-800 shadow-2xs cursor-pointer gap-1 font-medium h-8"
                >
                  <FileText className="h-3.5 w-3.5 text-orange-600" />
                  <span>Tiết 4 ({data?.shifts.TIET_4.totalCourts || 0})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportPdf('TIET_5')}
                  disabled={loading || isExporting || !data || !data.isConfigured || data.shifts.TIET_5.courts.length === 0}
                  className="text-xs border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-800 shadow-2xs cursor-pointer gap-1 font-medium h-8"
                >
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Tiết 5 ({data?.shifts.TIET_5.totalCourts || 0})</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleExportPdf('ALL')}
                  disabled={loading || isExporting || !data || !data.isConfigured || data.totalCourts === 0}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5 font-semibold h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Xuất PDF Trọn Bộ</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Băng cảnh báo trạng thái số liệu chốt bếp */}
      {data && (
        <>
          {data.isAfterLockTime ? (
            <div className="bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs uppercase tracking-wide">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>ĐÃ CHỐT SỐ BÁO BẾP</span>
              <span className="text-xs font-normal normal-case opacity-90">
                (Dữ liệu phân sân chính thức báo bộ phận quản lý và giáo viên điểm danh nhận cơm)
              </span>
            </div>
          ) : (
            <div className="bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm sm:text-base flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs tracking-wide">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>Số liệu chưa chốt</span>
                <span className="text-xs font-normal opacity-90">
                  (Số liệu phân sân tạm tính - Đang cập nhật đến giờ chốt tự động lúc {data.lockTime2 || cutoffTime})
                </span>
              </div>
              {!isCashier && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLockMealsFromCourtTab}
                  disabled={isLocking}
                  className="bg-white text-red-700 hover:bg-red-50 text-xs font-bold shadow-xs cursor-pointer gap-1.5 shrink-0"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{isLocking ? 'Đang chốt...' : 'Chốt suất ngay'}</span>
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* 3. Cảnh báo nếu có lớp chưa được xếp vào sân */}
      {hasUnassigned && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900">
                Phát hiện lớp học có suất ăn nhưng chưa được xếp vào sân!
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Tiết 4: {data?.unassignedClasses?.TIET_4.length || 0} lớp | Tiết 5: {data?.unassignedClasses?.TIET_5.length || 0} lớp.
              </p>
            </div>
          </div>
          {!isCashier && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsManualModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1" />
              Sửa thủ công để xếp bổ sung
            </Button>
          )}
        </div>
      )}

      {/* 4. Thẻ thống kê tổng hợp (chỉ khi có lớp ăn) */}
      {data && data.totalClasses > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng số sân &amp; Xe cơm</p>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {data.isConfigured ? `${data.totalCourts} sân` : 'Chưa tạo'}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    {data.isConfigured ? `(${data.totalCarts} xe)` : ''}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg shrink-0">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Sân Tiết 4 (Tối đa 16)</p>
                <p className="text-lg sm:text-xl font-bold text-orange-700">
                  {data.isConfigured ? `${data.shifts.TIET_4.totalCourts}/16 sân` : 'Chưa tạo'}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({data.shifts.TIET_4.totalMeals} suất)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Sân Tiết 5 (Tối đa 16)</p>
                <p className="text-lg sm:text-xl font-bold text-indigo-700">
                  {data.isConfigured ? `${data.shifts.TIET_5.totalCourts}/16 sân` : 'Chưa tạo'}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({data.shifts.TIET_5.totalMeals} suất)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng suất ăn đăng ký</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">{data.totalMeals} suất</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. NỘI DUNG CHÍNH: CHƯA TẠO PHÂN BỔ SÂN HOẶC ĐÃ CÓ DANH SÁCH SÂN */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-medium">Đang tải dữ liệu phân bổ chia sân...</p>
        </div>
      ) : !data || data.totalClasses === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16 text-center">
            <Utensils className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">
              Không có lớp nào ăn bán trú ngày {formatDateDDMMYYYY(selectedDate)}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Vui lòng kiểm tra lại thời khóa biểu tuần của các lớp hoặc chọn ngày học có phục vụ bán trú.
            </p>
          </CardContent>
        </Card>
      ) : !data.isConfigured ? (
        /* MÀN HÌNH KHI NGÀY NÀY CHƯA TẠO PHÂN BỔ SÂN */
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50/40 via-white to-white shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex p-3 bg-blue-100 text-blue-700 rounded-full mb-1">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Chưa Phân Bổ Sân Ăn Cho Ngày {formatDateDDMMYYYY(selectedDate)}
              </h2>
              <p className="text-sm text-slate-600">
                Hệ thống ghi nhận <strong>{data.totalClasses} lớp học</strong> với tổng cộng{' '}
                <strong className="text-blue-700">{data.totalMeals} suất ăn</strong> trong ngày này. Vui lòng chọn
                phương thức tạo phân bổ sân:
              </p>
            </div>

            {/* 2 Lựa chọn chính: TỰ ĐỘNG và THỦ CÔNG */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto pt-2">
              {/* Thẻ 1: TỰ ĐỘNG */}
              <div className="bg-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 relative group">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-blue-600 text-white text-[11px] font-bold">Khuyến nghị</Badge>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl inline-block">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">⚡ Tạo Tự Động</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống sẽ chạy thuật toán tự động ghép các lớp vào sân theo tiêu chuẩn tối ưu (sức chứa tối đa{' '}
                    <strong>60 suất/sân</strong>, ưu tiên các lớp cùng khối học gần nhau).
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                    <li>Ưu tiên ghép 2 lớp đạt 40 - 60 suất/sân.</li>
                    <li>Tối đa 16 sân trong một tiết ăn.</li>
                    <li>Tự động phân bổ xe cơm (1 xe phục vụ 2 sân).</li>
                  </ul>
                </div>

                <Button
                  type="button"
                  size="lg"
                  onClick={() => handleCreateAuto(false)}
                  disabled={isCreatingAuto || isCashier}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer gap-2 shadow-xs"
                >
                  <Wand2 className={`h-4 w-4 ${isCreatingAuto ? 'animate-spin' : ''}`} />
                  <span>{isCreatingAuto ? 'Đang tạo tự động...' : 'Tạo chia sân tự động'}</span>
                </Button>
              </div>

              {/* Thẻ 2: THỦ CÔNG */}
              <div className="bg-white border-2 border-indigo-200 hover:border-indigo-500 rounded-2xl p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 group">
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl inline-block">
                    <Edit3 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">✍️ Tạo Thủ Công</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Quản trị viên tự tay tạo các sân, xếp từng lớp vào sân và phân xe cơm theo nhu cầu thực tế của nhà
                    trường.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                    <li>Chủ động lựa chọn lớp nào ăn cùng sân nào.</li>
                    <li>Có thanh đo sức chứa trực quan theo thời gian thực.</li>
                    <li>Cảnh báo màu đỏ nếu xếp vượt quá 60 suất/sân.</li>
                  </ul>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setIsManualModalOpen(true)}
                  disabled={isCashier}
                  className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold cursor-pointer gap-2 shadow-xs"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Bắt đầu xếp thủ công</span>
                </Button>
              </div>
            </div>

            {/* Bảng tóm tắt các lớp theo ca để tiện theo dõi */}
            <div className="max-w-3xl mx-auto pt-4 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Danh sách lớp có lịch ăn trong ngày ({data.totalClasses} lớp):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tiết 4 */}
                <div className="bg-orange-50/60 rounded-xl p-3.5 border border-orange-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-orange-950">
                    <span>Tiết 4 (Ca 1): {data.availableClasses?.TIET_4.length || 0} lớp</span>
                    <span>{data.shifts.TIET_4.totalMeals} suất</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.availableClasses?.TIET_4.map((c) => (
                      <span
                        key={c.classId}
                        className="bg-white border border-orange-200 text-orange-900 px-2 py-0.5 rounded text-[11px] font-medium"
                      >
                        {c.className} ({c.totalMeals})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tiết 5 */}
                <div className="bg-indigo-50/60 rounded-xl p-3.5 border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span>Tiết 5 (Ca 2): {data.availableClasses?.TIET_5.length || 0} lớp</span>
                    <span>{data.shifts.TIET_5.totalMeals} suất</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.availableClasses?.TIET_5.map((c) => (
                      <span
                        key={c.classId}
                        className="bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded text-[11px] font-medium"
                      >
                        {c.className} ({c.totalMeals})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* MÀN HÌNH KHI ĐÃ CÓ PHÂN BỔ SÂN CHÍNH THỨC */
        <>
          {/* Bộ lọc Tiết ăn & Tiêu chuẩn chia sân */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <Button
                type="button"
                variant={activeShift === 'ALL' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveShift('ALL')}
                className="h-8 text-xs font-medium"
              >
                Tất cả các tiết ({data?.totalCourts || 0})
              </Button>
              <Button
                type="button"
                variant={activeShift === 'TIET_4' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveShift('TIET_4')}
                className="h-8 text-xs font-medium text-orange-900"
              >
                Tiết 4 ({data?.shifts.TIET_4.totalCourts || 0}/16 sân)
              </Button>
              <Button
                type="button"
                variant={activeShift === 'TIET_5' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveShift('TIET_5')}
                className="h-8 text-xs font-medium text-indigo-900"
              >
                Tiết 5 ({data?.shifts.TIET_5.totalCourts || 0}/16 sân)
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-xs ${
                data.allocationMode === 'MANUAL'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {data.allocationMode === 'MANUAL' ? '✍️ Phân bổ thủ công' : '⚡ Phân bổ tự động'}
              </Badge>

              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Tiêu chuẩn: Ưu tiên ghép 2 lớp (40 - 60 suất/sân). Sức chứa tối đa 60 suất/sân.</span>
              </div>
            </div>
          </div>

          {/* Danh sách các Sân */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courtsToDisplay.map((court) => {
              const courtKey = `${court.shift}-${court.courtNumber}`;
              const isExpanded = expandedCourtIds.has(courtKey);
              const isTiet4 = court.shift === 'TIET_4';

              return (
                <Card
                  key={courtKey}
                  className="border-slate-200 shadow-2xs hover:shadow-sm transition-all overflow-hidden bg-white"
                >
                  <div
                    className={`px-4 py-3 border-b flex items-center justify-between ${
                      isTiet4 ? 'bg-orange-50/50 border-orange-100' : 'bg-indigo-50/50 border-indigo-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isTiet4 ? 'bg-orange-600 text-white' : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {court.courtName}
                      </span>
                      {court.cartName && (
                        <Badge variant="outline" className="text-[11px] font-bold text-rose-700 bg-rose-50 border-rose-200">
                          {court.cartName}
                        </Badge>
                      )}
                      <span className="text-xs font-semibold text-slate-700">
                        {isTiet4 ? 'Tiết 4 (Ca 1)' : 'Tiết 5 (Ca 2)'}
                      </span>
                      {court.isSingleClass ? (
                        <Badge variant="outline" className="text-[11px] bg-white text-slate-600 border-slate-300">
                          1 Lớp lẻ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] bg-white text-blue-700 border-blue-200">
                          Ghép {court.classes.length} lớp
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {court.isOverCapacity || court.totalMeals > 60 ? (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100 text-[11px]">
                          Vượt 60
                        </Badge>
                      ) : court.isInIdealRange ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-[11px]">
                          Chuẩn (40-60)
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 text-[11px]">
                          Dưới 40
                        </Badge>
                      )}
                      <span className="text-sm font-extrabold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {court.totalMeals}/60 suất
                      </span>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    {/* Danh sách các lớp */}
                    <div>
                      <span className="text-xs text-slate-500 font-medium block mb-1.5">Lớp tại sân:</span>
                      <div className="flex flex-wrap gap-2">
                        {court.classes.map((cls) => (
                          <div
                            key={cls.classId}
                            className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs"
                          >
                            <span className="font-bold text-slate-800">{cls.className}</span>
                            <span className="text-blue-700 font-semibold">{cls.totalMeals} suất</span>
                            <span className="text-[11px] text-slate-400">
                              (Mặn: {cls.manCount} | Chay: {cls.chayCount} | Cháo: {cls.chaoCount})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chi tiết loại suất */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Phân loại suất:</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-medium">
                          Mặn: {court.manCount}
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                          Chay: {court.chayCount}
                        </span>
                        <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200 font-medium">
                          Cháo: {court.chaoCount}
                        </span>
                      </div>
                    </div>

                    {/* Nút xem học sinh */}
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(courtKey)}
                        className="w-full text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50/50 justify-between h-8"
                      >
                        <span>
                          {isExpanded
                            ? 'Ẩn danh sách học sinh'
                            : `Xem danh sách điểm danh (${court.students.length} học sinh)`}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Bảng danh sách học sinh mở rộng */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-100 max-h-60 overflow-y-auto">
                        <Table className="text-xs">
                          <TableHeader className="bg-slate-50 sticky top-0">
                            <TableRow>
                              <TableHead className="w-8 text-center p-1">#</TableHead>
                              <TableHead className="p-1 w-20">Mã bán trú</TableHead>
                              <TableHead className="p-1">Họ và đệm</TableHead>
                              <TableHead className="p-1 font-bold text-slate-900 w-24">Tên</TableHead>
                              <TableHead className="w-14 text-center p-1">Lớp</TableHead>
                              <TableHead className="w-14 text-center p-1">Suất</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {court.students.map((st, sIdx) => {
                              const { lastName, firstName } =
                                st.firstName && st.lastName
                                  ? { lastName: st.lastName, firstName: st.firstName }
                                  : splitVietnameseName(st.fullName);

                              return (
                                <TableRow key={st.id} className="hover:bg-slate-50/80">
                                  <TableCell className="text-center font-medium text-slate-500 p-1">
                                    {sIdx + 1}
                                  </TableCell>
                                  <TableCell className="p-1 text-blue-700 font-semibold font-mono text-[11px]">
                                    {st.boardingCode || "—"}
                                  </TableCell>
                                  <TableCell className="p-1 text-slate-700">
                                    {lastName}
                                  </TableCell>
                                  <TableCell className="p-1 font-bold text-slate-900">
                                    {firstName}
                                  </TableCell>
                                  <TableCell className="text-center p-1 font-medium text-slate-700">
                                    {st.className}
                                  </TableCell>
                                  <TableCell className="text-center p-1 font-semibold">
                                    {st.mealType === 'CHAY' ? (
                                      <span className="text-emerald-700">Chay</span>
                                    ) : st.mealType === 'CHAO' ? (
                                      <span className="text-amber-700">Cháo</span>
                                    ) : (
                                      <span className="text-slate-800">Mặn</span>
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
              );
            })}
          </div>
        </>
      )}

      {/* DIALOG XẾP SÂN THỦ CÔNG */}
      {data && (
        <DiningCourtManualDialog
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          data={data}
          selectedDate={selectedDate}
          onSaved={() => fetchData(selectedDate)}
        />
      )}

      {/* DIALOG XEM TRƯỚC VÀ IN BẢNG TẬP KẾT SUẤT ĂN THEO SÂN */}
      <Dialog open={isPrintSummaryOpen} onOpenChange={setIsPrintSummaryOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[95vh] border-none shadow-2xl print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-none print:shadow-none print:bg-transparent">
          {data && (
            <DiningCourtSummaryPrint
              data={data}
              schoolName={schoolName}
              onClose={() => setIsPrintSummaryOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
        </div>
      )}
    </div>
  );
}
