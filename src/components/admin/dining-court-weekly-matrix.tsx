'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  Wand2,
  Copy,
  Trash2,
  RefreshCw,
  Edit3,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toPng } from 'html-to-image';
import Swal from 'sweetalert2';
import { useSession } from 'next-auth/react';
import { WeeklyDiningMatrixResult, WeeklyMatrixRow } from '@/lib/dining-court-service';

interface DiningCourtWeeklyMatrixProps {
  schoolName?: string;
}

export function DiningCourtWeeklyMatrix({ schoolName = 'TRƯỜNG TIỂU HỌC BÁN TRÚ' }: DiningCourtWeeklyMatrixProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canEdit = userRole === 'ADMIN' || userRole === 'BOARDING_MANAGER';

  const [currentDateStr, setCurrentDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [matrixData, setMatrixData] = useState<WeeklyDiningMatrixResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [highlightedCourt, setHighlightedCourt] = useState<string | null>(null);

  // Modals
  const [isAutoAllocating, setIsAutoAllocating] = useState<boolean>(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [sourceWeekNum, setSourceWeekNum] = useState<number>(1);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [isDeletingWeek, setIsDeletingWeek] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);

  // Edit cell modal
  const [editCellData, setEditCellData] = useState<{
    dateStr: string;
    classId: string;
    className: string;
    dayLabel: string;
    currentCourtName: string | null;
  } | null>(null);
  const [selectedNewCourt, setSelectedNewCourt] = useState<string>('');
  const [isUpdatingCell, setIsUpdatingCell] = useState<boolean>(false);

  const printTableRef = useRef<HTMLDivElement>(null);

  // Tải dữ liệu ma trận tuần
  const fetchMatrix = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dining-areas/weekly?date=${dateStr}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Lỗi khi tải dữ liệu ma trận tuần');
      }
      setMatrixData(json);
    } catch (err) {
      console.error('Fetch weekly matrix error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể tải dữ liệu tuần', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix(currentDateStr);
  }, [currentDateStr, fetchMatrix]);

  // Điều hướng tuần
  const handlePrevWeek = () => {
    if (!matrixData) return;
    const cur = new Date(matrixData.weekInfo.startDateStr + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    const nextDate = cur.toISOString().split('T')[0];
    setCurrentDateStr(nextDate);
  };

  const handleNextWeek = () => {
    if (!matrixData) return;
    const cur = new Date(matrixData.weekInfo.startDateStr + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    const nextDate = cur.toISOString().split('T')[0];
    setCurrentDateStr(nextDate);
  };

  const handleCurrentWeek = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setCurrentDateStr(todayStr);
  };

  const handleSelectWeekNumber = (weekNumStr: string) => {
    if (!matrixData) return;
    const weekNum = parseInt(weekNumStr, 10);
    const schoolStartYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
    // Tính ngày Thứ 2 của tuần này
    const sept1 = new Date(schoolStartYear, 8, 1);
    const sept1Day = sept1.getDay();
    const diffToFirstMon = sept1Day === 1 ? 0 : (8 - (sept1Day === 0 ? 7 : sept1Day)) % 7;
    const firstMondaySept = new Date(schoolStartYear, 8, 1 + diffToFirstMon);
    firstMondaySept.setDate(firstMondaySept.getDate() + (weekNum - 1) * 7);
    const dateStr = firstMondaySept.toISOString().split('T')[0];
    setCurrentDateStr(dateStr);
  };

  // Tự động phân bổ cả tuần
  const handleAutoAllocateWeek = async () => {
    if (!canEdit || !matrixData) return;

    const confirm = await Swal.fire({
      title: 'Chia sân tự động cả tuần?',
      text: `Hệ thống sẽ chạy thuật toán tối ưu phân bổ sân ăn cho tất cả các ngày từ Thứ 2 đến Thứ 6 (${matrixData.weekInfo.formattedRange}). Các ngày đã tạo trước đó sẽ được tính toán lại.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý chia tự động',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!confirm.isConfirmed) return;

    setIsAutoAllocating(true);
    try {
      const res = await fetch('/api/dining-areas/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTO_WEEK',
          date: matrixData.weekInfo.startDateStr,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi chia sân tự động cả tuần');
      }

      Swal.fire({
        icon: 'success',
        title: 'Đã phân bổ chia sân tự động cho tuần thành công!',
        timer: 1500,
        showConfirmButton: false,
      });

      setMatrixData(resJson.data);
    } catch (err) {
      console.error('Auto allocate week error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể chia sân tự động', 'error');
    } finally {
      setIsAutoAllocating(false);
    }
  };

  // Sao chép từ tuần trước
  const handleCopyWeek = async () => {
    if (!canEdit || !matrixData) return;

    const schoolStartYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
    const sept1 = new Date(schoolStartYear, 8, 1);
    const sept1Day = sept1.getDay();
    const diffToFirstMon = sept1Day === 1 ? 0 : (8 - (sept1Day === 0 ? 7 : sept1Day)) % 7;
    const firstMondaySept = new Date(schoolStartYear, 8, 1 + diffToFirstMon);
    firstMondaySept.setDate(firstMondaySept.getDate() + (sourceWeekNum - 1) * 7);
    const sourceDateStr = firstMondaySept.toISOString().split('T')[0];

    setIsCopying(true);
    try {
      const res = await fetch('/api/dining-areas/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COPY_WEEK',
          sourceDate: sourceDateStr,
          targetDate: matrixData.weekInfo.startDateStr,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi sao chép tuần');
      }

      Swal.fire({
        icon: 'success',
        title: `Đã sao chép phân sân từ Tuần ${sourceWeekNum} sang Tuần ${matrixData.weekInfo.schoolWeekNumber}!`,
        timer: 1800,
        showConfirmButton: false,
      });

      setMatrixData(resJson.data);
      setIsCopyModalOpen(false);
    } catch (err) {
      console.error('Copy week error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể sao chép phân sân', 'error');
    } finally {
      setIsCopying(false);
    }
  };

  // Xóa phân bổ cả tuần
  const handleDeleteWeek = async () => {
    if (!canEdit || !matrixData) return;

    const confirm = await Swal.fire({
      title: 'Xác nhận xóa phân sân cả tuần?',
      text: `Dữ liệu phân bổ chia sân của Tuần ${matrixData.weekInfo.schoolWeekNumber} (${matrixData.weekInfo.formattedRange}) sẽ bị xóa hoàn toàn.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý xóa tuần',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!confirm.isConfirmed) return;

    setIsDeletingWeek(true);
    try {
      const res = await fetch('/api/dining-areas/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_WEEK',
          date: matrixData.weekInfo.startDateStr,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi xóa phân sân tuần');
      }

      Swal.fire({
        icon: 'success',
        title: 'Đã xóa phân bổ sân của tuần thành công!',
        timer: 1500,
        showConfirmButton: false,
      });

      setMatrixData(resJson.data);
    } catch (err) {
      console.error('Delete week error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể xóa tuần', 'error');
    } finally {
      setIsDeletingWeek(false);
    }
  };

  // Chỉnh sửa sân từng ô
  const handleSaveCell = async () => {
    if (!editCellData) return;

    setIsUpdatingCell(true);
    try {
      const res = await fetch('/api/dining-areas/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CELL',
          date: editCellData.dateStr,
          classId: editCellData.classId,
          newCourtName: selectedNewCourt === 'NONE' ? null : selectedNewCourt,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi cập nhật sân cho lớp');
      }

      setMatrixData(resJson.data);
      setEditCellData(null);
    } catch (err) {
      console.error('Update cell error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể cập nhật sân', 'error');
    } finally {
      setIsUpdatingCell(false);
    }
  };

  // Xuất file ảnh PNG gửi Zalo
  const handleExportPng = async () => {
    if (!printTableRef.current || !matrixData) return;

    setIsExportingImage(true);
    try {
      // Ẩn tạm các nút thao tác tương tác nếu có trước khi chụp
      const dataUrl = await toPng(printTableRef.current, {
        quality: 0.98,
        pixelRatio: 2, // Độ phân giải cao cho Zalo
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `Thong_Ke_San_An_Tuan_${matrixData.weekInfo.schoolWeekNumber}_NamHoc_${matrixData.weekInfo.schoolYear.replace(/\s+/g, '')}.png`;
      link.href = dataUrl;
      link.click();

      Swal.fire({
        icon: 'success',
        title: 'Đã xuất ảnh thành công!',
        text: 'File ảnh độ nét cao đã được tải xuống để bạn gửi vào Zalo cho học sinh/phụ huynh.',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Export image error:', err);
      Swal.fire('Lỗi', 'Không thể xuất file ảnh. Vui lòng thử lại.', 'error');
    } finally {
      setIsExportingImage(false);
    }
  };

  // In biểu mẫu A4
  const handlePrint = () => {
    window.print();
  };

  // Toggle highlight sân khi click ô
  const handleCellClick = (courtName: string | null, row: WeeklyMatrixRow, dateStr: string, dayLabel: string) => {
    if (!courtName) {
      if (canEdit) {
        // Cho phép gán sân vào ô trống
        setEditCellData({
          dateStr,
          classId: row.classId,
          className: row.className,
          dayLabel,
          currentCourtName: null,
        });
        setSelectedNewCourt(matrixData?.distinctCourts[0] || 'SÂN 1');
      }
      return;
    }

    // Nếu click vào ô đã có sân:
    // 1. Nếu đang nhấn Shift hoặc mở chế độ sửa -> mở modal sửa
    // 2. Bình thường: toggle highlight sân đó (bôi vàng y như ảnh mẫu!)
    if (highlightedCourt === courtName) {
      setHighlightedCourt(null); // Bỏ highlight
    } else {
      setHighlightedCourt(courtName); // Bôi vàng sân được chọn
    }
  };

  const weekInfo = matrixData?.weekInfo;
  const schoolWeekNumber = weekInfo?.schoolWeekNumber || 1;
  const schoolYear = weekInfo?.schoolYear || '2026 - 2027';

  // Danh sách các tuần năm học (1 -> 35)
  const schoolWeeksList = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      {/* 1. THANH ĐIỀU KHIỂN & CÔNG CỤ (Ẩn khi In) */}
      <div className="no-print bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Bộ điều hướng tuần */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevWeek}
                disabled={loading}
                className="h-8 px-2 text-slate-700 hover:text-slate-900 cursor-pointer"
                title="Tuần trước"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                <span className="text-xs font-semibold">Tuần trước</span>
              </Button>

              <div className="h-4 w-[1px] bg-slate-300" />

              <Select
                value={String(schoolWeekNumber)}
                onValueChange={handleSelectWeekNumber}
                disabled={loading}
              >
                <SelectTrigger className="h-8 border-none bg-transparent text-xs font-bold text-blue-700 focus:ring-0 shadow-none px-2.5">
                  <SelectValue placeholder={`Tuần ${schoolWeekNumber}`} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {schoolWeeksList.map((w) => (
                    <SelectItem key={w} value={String(w)} className="text-xs font-medium cursor-pointer">
                      Tuần {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="h-4 w-[1px] bg-slate-300" />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextWeek}
                disabled={loading}
                className="h-8 px-2 text-slate-700 hover:text-slate-900 cursor-pointer"
                title="Tuần sau"
              >
                <span className="text-xs font-semibold">Tuần sau</span>
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCurrentWeek}
              disabled={loading}
              className="h-8 text-xs font-semibold border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Hôm nay
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fetchMatrix(currentDateStr)}
              disabled={loading}
              className="h-8 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>

          {/* Công cụ tác vụ */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc tô màu sân (Highlight) */}
            <div className="flex items-center gap-1.5 bg-yellow-50/80 border border-yellow-200/80 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-amber-900 font-semibold flex items-center gap-1">
                🎨 Tô màu sân:
              </span>
              <select
                value={highlightedCourt || ''}
                onChange={(e) => setHighlightedCourt(e.target.value ? e.target.value : null)}
                className="h-7 text-xs font-bold text-slate-800 bg-white border border-yellow-300 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-500 cursor-pointer"
              >
                <option value="">(Tất cả / Bỏ tô)</option>
                {matrixData?.distinctCourts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {highlightedCourt && (
                <button
                  type="button"
                  onClick={() => setHighlightedCourt(null)}
                  className="text-amber-800 hover:text-rose-600 font-bold ml-1 text-xs cursor-pointer"
                  title="Bỏ tô màu"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Các nút hành động quản trị (Chỉ ADMIN & BOARDING_MANAGER) */}
            {canEdit && (
              <>
                <Button
                  size="sm"
                  onClick={handleAutoAllocateWeek}
                  disabled={loading || isAutoAllocating}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs gap-1.5 cursor-pointer"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>{isAutoAllocating ? 'Đang chia...' : 'Chia sân tự động tuần'}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSourceWeekNum(Math.max(1, schoolWeekNumber - 1));
                    setIsCopyModalOpen(true);
                  }}
                  disabled={loading || isCopying}
                  className="h-8 text-xs border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-800 font-medium shadow-2xs gap-1 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Sao chép tuần</span>
                </Button>

                {matrixData?.hasAnyAllocation && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteWeek}
                    disabled={loading || isDeletingWeek}
                    className="h-8 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer px-2"
                    title="Xóa phân sân cả tuần này"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}

            {/* Nút Xuất ảnh gửi Zalo & In ấn (Dành cho TẤT CẢ mọi người) */}
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
              <Button
                size="sm"
                onClick={handleExportPng}
                disabled={loading || isExportingImage || !matrixData}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs gap-1.5 cursor-pointer"
                title="Xuất file ảnh PNG gửi Zalo cho học sinh và phụ huynh"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{isExportingImage ? 'Đang xuất ảnh...' : '📸 Xuất ảnh gửi Zalo'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                disabled={loading || !matrixData}
                className="h-8 text-xs border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold shadow-2xs gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span>In biểu mẫu A4</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Hướng dẫn thao tác nhanh */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span>
              Mẹo: <b>Click vào bất kỳ ô SÂN nào</b> để tự động bôi màu vàng nổi bật tất cả các lớp cùng ăn sân đó (chuẩn theo mẫu bảng).
              {canEdit && ' Click đúp hoặc bấm vào ô để đổi sân thủ công cho lớp.'}
            </span>
          </div>
          {weekInfo && (
            <div className="font-medium text-slate-600">
              Dương lịch: <span className="text-blue-700 font-bold">Tuần {weekInfo.calendarWeekNumber}</span> (Năm {weekInfo.calendarYear})
            </div>
          )}
        </div>
      </div>

      {/* 2. KHUNG BẢNG MA TRẬN CHÍNH (Được chụp khi Xuất ảnh hoặc In) */}
      <div
        ref={printTableRef}
        id="weekly-matrix-table-card"
        className="bg-white p-4 sm:p-6 rounded-xl border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0"
      >
        {/* TIÊU ĐỀ CHUẨN FORM NHƯ ẢNH MẪU */}
        <div className="text-center mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold uppercase text-slate-900 tracking-tight">
            THỐNG KÊ SÂN ĂN BÁN TRÚ NĂM HỌC {schoolYear}
          </h2>
          <p className="text-xs sm:text-sm font-bold uppercase text-slate-800 mt-0.5">
            TUẦN {schoolWeekNumber} ({weekInfo?.formattedRange || ''})
          </p>
          {/* Chú thích trên màn hình (ẨN KHI IN / XUẤT THEO ĐÚNG YÊU CẦU CỦA NGƯỜI DÙNG) */}
          <p className="no-print text-[11px] text-slate-500 italic mt-0.5">
            [Thông tin nội bộ: Thuộc tuần số {weekInfo?.calendarWeekNumber} năm dương lịch {weekInfo?.calendarYear} - Sẽ không in dòng này ra giấy/ảnh]
          </p>
        </div>

        {/* BẢNG MA TRẬN KẺ Ô RÕ NÉT */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-950 text-xs sm:text-sm text-center">
            {/* Header hàng 1: Lớp, Thứ 2 -> Thứ 6 */}
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <th
                  rowSpan={2}
                  className="border border-slate-950 px-3 py-2 text-center min-w-[75px] sm:min-w-[90px] font-bold"
                >
                  Lớp
                </th>
                {matrixData?.days.map((day) => (
                  <th
                    key={day.dateStr}
                    className="border border-slate-950 px-3 py-1.5 font-bold min-w-[90px] sm:min-w-[110px]"
                  >
                    <div>{day.dayLabel}</div>
                    <div className="text-[10px] text-slate-500 font-normal no-print">({day.shortDate})</div>
                  </th>
                ))}
              </tr>

              {/* Header hàng 2: P.ĂN dưới mỗi thứ có bộ lọc */}
              <tr className="bg-slate-50 font-bold text-slate-800 text-[11px] sm:text-xs">
                {matrixData?.days.map((day) => (
                  <th key={`pan_${day.dateStr}`} className="border border-slate-950 px-2 py-1">
                    <div className="inline-flex items-center justify-center gap-1">
                      <span>P.ĂN</span>
                      {/* Icon dropdown filter như hình mẫu */}
                      <button
                        type="button"
                        onClick={() => {
                          const availableOnThisDay = Array.from(
                            new Set(
                              matrixData.rows
                                .map((r) => r.courts[day.dateStr]?.courtName)
                                .filter(Boolean) as string[]
                            )
                          ).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

                          if (availableOnThisDay.length === 0) return;

                          // Đổi highlight sang sân tiếp theo trong ngày
                          const curIdx = highlightedCourt ? availableOnThisDay.indexOf(highlightedCourt) : -1;
                          const nextCourt = availableOnThisDay[(curIdx + 1) % availableOnThisDay.length];
                          setHighlightedCourt(nextCourt);
                        }}
                        className="no-print p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 cursor-pointer"
                        title="Click để chọn xem sân trong thứ này"
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Thân bảng: Danh sách lớp */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="border border-slate-950 py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải dữ liệu bảng ma trận tuần...
                  </td>
                </tr>
              ) : matrixData && matrixData.rows.length > 0 ? (
                matrixData.rows.map((row) => (
                  <tr key={row.classId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Cột Lớp */}
                    <td className="border border-slate-950 font-bold text-slate-900 px-2.5 py-1.5 bg-slate-50/50">
                      {row.className}
                    </td>

                    {/* 5 Cột Thứ 2 -> Thứ 6 */}
                    {matrixData.days.map((day) => {
                      const cell = row.courts[day.dateStr];
                      const courtName = cell?.courtName || '';
                      const isHighlighted = Boolean(
                        courtName && highlightedCourt && courtName.toUpperCase() === highlightedCourt.toUpperCase()
                      );

                      return (
                        <td
                          key={day.dateStr}
                          onClick={() => handleCellClick(courtName || null, row, day.dateStr, day.dayLabel)}
                          className={`border border-slate-950 px-2 py-1.5 cursor-pointer transition-all ${
                            isHighlighted
                              ? 'bg-yellow-300 font-extrabold text-slate-950 shadow-inner' // Bôi vàng chuẩn như hình mẫu!
                              : courtName
                              ? 'text-slate-800 hover:bg-slate-100 font-medium'
                              : 'text-slate-300 hover:bg-slate-100/60'
                          }`}
                          title={
                            courtName
                              ? `Lớp ${row.className} - ${courtName} (${day.dayLabel})\nClick để tô màu toàn bộ sân này`
                              : canEdit
                              ? `Chưa có sân. Click để gán sân cho lớp ${row.className}`
                              : 'Không ăn'
                          }
                        >
                          {courtName ? (
                            <span className="inline-block tracking-tight uppercase">
                              {courtName}
                            </span>
                          ) : (
                            <span className="text-slate-300 select-none">&nbsp;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="border border-slate-950 py-8 text-center text-slate-500">
                    Chưa có danh sách lớp học nào. Vui lòng kiểm tra lại dữ liệu lớp học.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Chữ ký xác nhận chân trang khi In (Chỉ xuất hiện khi in ấn) */}
        <div className="hidden print:block mt-8 pt-4">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <p className="font-bold uppercase text-black">Người lập biểu</p>
              <p className="text-[10px] italic text-slate-600 mt-0.5">(Ký và ghi rõ họ tên)</p>
              <div className="h-16" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
            <div>
              <p className="font-bold uppercase text-black">Bộ phận Bán trú</p>
              <p className="text-[10px] italic text-slate-600 mt-0.5">(Ký xác nhận phân sân)</p>
              <div className="h-16" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
            <div>
              <p className="font-bold uppercase text-black">Ban Giám Hiệu</p>
              <p className="text-[10px] italic text-slate-600 mt-0.5">(Ký và đóng dấu)</p>
              <div className="h-16" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: SAO CHÉP TỪ TUẦN TRƯỚC */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Copy className="h-5 w-5 text-indigo-600" />
              <span>Sao chép phân sân sang Tuần {schoolWeekNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chọn tuần gốc có cấu hình phân sân ổn định để sao chép nguyên vẹn sang tuần hiện tại ({weekInfo?.formattedRange}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Sao chép từ tuần:
              </label>
              <Select
                value={String(sourceWeekNum)}
                onValueChange={(val) => setSourceWeekNum(parseInt(val, 10))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn tuần gốc" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {schoolWeeksList
                    .filter((w) => w !== schoolWeekNumber)
                    .map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        Tuần {w}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <AlertCircle className="h-4 w-4 inline mr-1 text-amber-600" />
              Lưu ý: Thao tác này sẽ ghi đè cấu hình phân sân hiện tại của Tuần {schoolWeekNumber}.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCopyModalOpen(false)}
              disabled={isCopying}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleCopyWeek}
              disabled={isCopying}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
            >
              {isCopying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              <span>Xác nhận sao chép</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CHỈNH SỬA SÂN CHO 1 LỚP VÀO 1 NGÀY */}
      <Dialog open={Boolean(editCellData)} onOpenChange={(open) => !open && setEditCellData(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-blue-600" />
              <span>Đổi sân cho lớp {editCellData?.className}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ngày: {editCellData?.dayLabel} ({editCellData?.dateStr})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Chọn sân mới:</label>
              <Select value={selectedNewCourt} onValueChange={setSelectedNewCourt}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn sân" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="NONE" className="text-rose-600 font-medium">
                    (Không xếp sân / Bỏ sân)
                  </SelectItem>
                  {Array.from({ length: 16 }, (_, i) => `SÂN ${i + 1}`).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditCellData(null)}
              disabled={isUpdatingCell}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCell}
              disabled={isUpdatingCell}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {isUpdatingCell ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
