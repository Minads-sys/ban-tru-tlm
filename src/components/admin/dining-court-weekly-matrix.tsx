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
  FileDown,
  Lock,
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
import { WeeklyDiningMatrixResult, WeeklyMatrixRow, WeeklyMatrixCell, WeeklyMatrixAllocation } from '@/lib/dining-court-service';
import { getSchoolWeekFromNumber } from '@/lib/utils';

interface DiningCourtWeeklyMatrixProps {
  schoolName?: string;
}

export function DiningCourtWeeklyMatrix({ schoolName = 'TRƯỜNG TIỂU HỌC BÁN TRÚ' }: DiningCourtWeeklyMatrixProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canEdit = userRole === 'ADMIN' || userRole === 'BOARDING_MANAGER';

  const [matrixData, setMatrixData] = useState<WeeklyDiningMatrixResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isAutoAllocating, setIsAutoAllocating] = useState<boolean>(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [sourceWeekNum, setSourceWeekNum] = useState<number>(1);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [isDeletingWeek, setIsDeletingWeek] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Edit cell modal
  const [editCellData, setEditCellData] = useState<{
    dateStr: string;
    classId: string;
    className: string;
    dayLabel: string;
    isSpecial?: boolean;
    currentCourtName: string | null;
  } | null>(null);
  const [selectedNewCourt, setSelectedNewCourt] = useState<string>('');
  const [selectedT4Court, setSelectedT4Court] = useState<string>('NONE');
  const [selectedT5Court, setSelectedT5Court] = useState<string>('NONE');
  const [isUpdatingCell, setIsUpdatingCell] = useState<boolean>(false);

  const printTableRef = useRef<HTMLDivElement>(null);

  // Tải dữ liệu ma trận tuần theo tuần năm học hoặc theo ngày
  const fetchMatrix = useCallback(async (params?: { date?: string; week?: number; year?: number }) => {
    setLoading(true);
    try {
      let url = '/api/dining-areas/weekly';
      if (params?.week && params?.year) {
        url += `?week=${params.week}&year=${params.year}`;
      } else if (params?.date) {
        url += `?date=${params.date}`;
      }
      const res = await fetch(url);
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
    fetchMatrix();
  }, [fetchMatrix]);

  // Điều hướng tuần
  const handlePrevWeek = () => {
    if (!matrixData) return;
    const curWeek = matrixData.weekInfo.schoolWeekNumber;
    const startYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
    const targetWeek = Math.max(1, curWeek - 1);
    fetchMatrix({ week: targetWeek, year: startYear });
  };

  const handleNextWeek = () => {
    if (!matrixData) return;
    const curWeek = matrixData.weekInfo.schoolWeekNumber;
    const startYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
    const targetWeek = Math.min(35, curWeek + 1);
    fetchMatrix({ week: targetWeek, year: startYear });
  };

  const handleCurrentWeek = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    fetchMatrix({ date: todayStr });
  };

  const handleSelectWeekNumber = (weekNumStr: string) => {
    if (!matrixData) return;
    const weekNum = parseInt(weekNumStr, 10);
    const startYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
    fetchMatrix({ week: weekNum, year: startYear });
  };

  // Tự động phân bổ cả tuần
  const handleAutoAllocateWeek = async () => {
    if (!canEdit || !matrixData || matrixData.hasAnyAllocation) return;

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
      if (editCellData.isSpecial) {
        // Cập nhật ca Tiết 4
        await fetch('/api/dining-areas/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_CELL',
            date: editCellData.dateStr,
            classId: editCellData.classId,
            newCourtName: selectedT4Court === 'NONE' ? null : selectedT4Court,
            shift: 'TIET_4',
          }),
        });

        // Cập nhật ca Tiết 5
        const res = await fetch('/api/dining-areas/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_CELL',
            date: editCellData.dateStr,
            classId: editCellData.classId,
            newCourtName: selectedT5Court === 'NONE' ? null : selectedT5Court,
            shift: 'TIET_5',
          }),
        });

        const resJson = await res.json();
        if (!res.ok) {
          throw new Error(resJson.error || 'Lỗi khi cập nhật sân cho lớp đặc biệt');
        }

        setMatrixData(resJson.data);
        setEditCellData(null);
      } else {
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
      }
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

  // Tải file PDF chuẩn vector sắc nét
  const handleDownloadPdf = async () => {
    if (!matrixData) return;

    setIsExportingPdf(true);
    try {
      const weekNum = matrixData.weekInfo.schoolWeekNumber;
      const startYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
      const url = `/api/dining-areas/export-pdf?type=weekly&week=${weekNum}&year=${startYear}`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Lỗi khi tải file PDF');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanSchoolYear = matrixData.weekInfo.schoolYear.replace(/\s+/g, '');
      a.download = `Thong_Ke_San_An_Tuan_${weekNum}_NamHoc_${cleanSchoolYear}.pdf`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        } catch {}
      }, 60000);

      Swal.fire({
        icon: 'success',
        title: 'Đã tải file PDF thành công!',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Download PDF error:', err);
      Swal.fire('Lỗi', err instanceof Error ? err.message : 'Không thể tải file PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // In biểu mẫu A4 độc lập bằng Iframe (loại bỏ hoàn toàn lỗi trang trắng)
  const handlePrint = () => {
    const printContent = printTableRef.current;
    if (!printContent || !matrixData) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const cloned = printContent.cloneNode(true) as HTMLElement;
    // Bỏ tất cả các phần tử có class no-print
    cloned.querySelectorAll('.no-print').forEach((el) => el.remove());

    // Đảm bảo chữ ký chân trang hiện rõ ràng
    const sigBlock = cloned.querySelector('#print-signatures-block') || cloned.querySelector('.hidden');
    if (sigBlock) {
      (sigBlock as HTMLElement).style.display = 'block';
      (sigBlock as HTMLElement).classList.remove('hidden');
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Thống Kê Sân Ăn Bán Trú - Tuần ${matrixData.weekInfo.schoolWeekNumber}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 10mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
              font-size: 11px;
            }
            .no-print {
              display: none !important;
            }
            h2 {
              margin: 0 0 4px 0;
              font-size: 16px;
              text-align: center;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.02em;
            }
            p {
              margin: 2px 0 10px 0;
              text-align: center;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              text-align: center;
              font-size: 11px;
              margin-top: 8px;
            }
            th, td {
              border: 1px solid #000000 !important;
              padding: 4px 6px;
              text-align: center;
            }
            .text-left {
              text-align: left !important;
            }
            .special-section-header {
              background-color: #fef3c7 !important;
              color: #78350f !important;
              font-weight: 800 !important;
              text-align: left !important;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: bold;
              color: #000;
            }
            .shift-tiet4 {
              color: #92400e !important;
              font-weight: 600;
              font-size: 10px;
            }
            .shift-tiet5 {
              color: #3730a3 !important;
              font-weight: 600;
              font-size: 10px;
            }
            .footnote {
              margin-top: 12px;
              font-size: 10.5px;
              font-style: italic;
              color: #334155;
              text-align: left;
            }
            tr {
              page-break-inside: avoid;
            }
            thead {
              display: table-header-group;
            }
            .grid-cols-3 {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .grid-cols-3 > div {
              flex: 1;
              text-align: center;
            }
            .grid-cols-3 p {
              margin: 0;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          ${cloned.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 2000);
    }, 400);
  };

  // Xử lý khi click vào ô: Mở modal sửa hoặc gán sân nếu có quyền quản trị
  const handleCellClick = (cell: WeeklyMatrixCell | null, row: WeeklyMatrixRow, dateStr: string, dayLabel: string) => {
    if (!canEdit) return;

    const t4Alloc = cell?.allocations?.find((a: WeeklyMatrixAllocation) => a.shift === 'TIET_4') || (cell?.shift === 'TIET_4' ? cell : null);
    const t5Alloc = cell?.allocations?.find((a: WeeklyMatrixAllocation) => a.shift === 'TIET_5') || (cell?.shift === 'TIET_5' ? cell : null);

    setEditCellData({
      dateStr,
      classId: row.classId,
      className: row.className,
      dayLabel,
      isSpecial: Boolean(row.isSpecial),
      currentCourtName: cell?.courtName || null,
    });
    setSelectedNewCourt(cell?.courtName || matrixData?.distinctCourts[0] || 'SÂN 1');
    setSelectedT4Court(t4Alloc?.courtName || 'NONE');
    setSelectedT5Court(t5Alloc?.courtName || 'NONE');
  };

  const weekInfo = matrixData?.weekInfo;
  const schoolWeekNumber = weekInfo?.schoolWeekNumber || 1;
  const schoolYear = weekInfo?.schoolYear || '2026 - 2027';

  const startYear = React.useMemo(() => {
    return parseInt(schoolYear.split('-')[0].trim(), 10) || 2026;
  }, [schoolYear]);

  // Danh sách các tuần năm học (1 -> 35) kèm ngày bắt đầu - kết thúc (Thứ 2 đến Thứ 6)
  const schoolWeeksList = React.useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return Array.from({ length: 35 }, (_, i) => {
      const w = i + 1;
      const info = getSchoolWeekFromNumber(w, startYear);
      const s = info.startDate;
      const e = info.endDate;
      const rangeStr = `${pad(s.getDate())}/${pad(s.getMonth() + 1)}/${s.getFullYear()} - ${pad(e.getDate())}/${pad(e.getMonth() + 1)}/${e.getFullYear()}`;
      return {
        week: w,
        rangeStr,
        label: `Tuần ${w} (${rangeStr})`,
      };
    });
  }, [startYear]);

  const currentWeekObj = React.useMemo(() => {
    return schoolWeeksList.find((item) => item.week === schoolWeekNumber);
  }, [schoolWeeksList, schoolWeekNumber]);

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
                <SelectTrigger className="h-8 w-auto border-none bg-transparent text-xs font-bold text-blue-700 focus:ring-0 shadow-none px-2.5 cursor-pointer">
                  <SelectValue placeholder={currentWeekObj?.label || `Tuần ${schoolWeekNumber}`} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {schoolWeeksList.map((item) => (
                    <SelectItem key={item.week} value={String(item.week)} className="text-xs font-medium cursor-pointer">
                      {item.label}
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
              onClick={() => {
                if (matrixData) {
                  const startYear = parseInt(matrixData.weekInfo.schoolYear.split('-')[0].trim(), 10);
                  fetchMatrix({ week: matrixData.weekInfo.schoolWeekNumber, year: startYear });
                } else {
                  fetchMatrix();
                }
              }}
              disabled={loading}
              className="h-8 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>

          {/* Công cụ tác vụ */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Các nút hành động quản trị (Chỉ ADMIN & BOARDING_MANAGER) */}
            {canEdit && (
              <>
                <div
                  title={
                    matrixData?.hasAnyAllocation
                      ? 'Tuần này đã được phân bổ sân ăn. Nút chia tự động bị khóa để tránh bấm nhầm làm mất dữ liệu. Bấm nút Thùng rác bên cạnh để xóa phân sân nếu bạn muốn chia lại từ đầu.'
                      : 'Chạy thuật toán tự động chia sân ăn cho cả tuần'
                  }
                >
                  <Button
                    size="sm"
                    onClick={handleAutoAllocateWeek}
                    disabled={loading || isAutoAllocating || Boolean(matrixData?.hasAnyAllocation)}
                    className={`h-8 text-xs font-bold shadow-xs gap-1.5 ${
                      matrixData?.hasAnyAllocation
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed hover:bg-slate-100 hover:text-slate-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    }`}
                  >
                    {matrixData?.hasAnyAllocation ? (
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isAutoAllocating
                        ? 'Đang chia...'
                        : matrixData?.hasAnyAllocation
                        ? 'Chia sân tự động (Đã khóa)'
                        : 'Chia sân tự động tuần'}
                    </span>
                  </Button>
                </div>

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
                    title="Xóa phân sân cả tuần này (Để chia lại từ đầu)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}

            {/* Nút Xuất ảnh gửi Zalo, Tải PDF & In ấn (Dành cho TẤT CẢ mọi người) */}
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
                onClick={handleDownloadPdf}
                disabled={loading || isExportingPdf || !matrixData}
                className="h-8 text-xs border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold shadow-2xs gap-1.5 cursor-pointer"
                title="Tải file PDF bảng thống kê chuẩn vector sắc nét để in ấn và lưu trữ"
              >
                <FileDown className="h-3.5 w-3.5 text-rose-600" />
                <span>{isExportingPdf ? 'Đang tạo PDF...' : '📄 Tải file PDF'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                disabled={loading || !matrixData}
                className="h-8 text-xs border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold shadow-2xs gap-1.5 cursor-pointer"
                title="In trực tiếp ra máy in hoặc lưu PDF qua trình duyệt"
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
              {canEdit
                ? 'Mẹo: Bấm vào bất kỳ ô SÂN nào để đổi hoặc gán sân thủ công cho lớp học.'
                : 'Thông tin phân bổ sân ăn bán trú theo tuần của các lớp học.'}
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

              {/* Header hàng 2: P.ĂN dưới mỗi thứ */}
              <tr className="bg-slate-50 font-bold text-slate-800 text-[11px] sm:text-xs">
                {matrixData?.days.map((day) => (
                  <th key={`pan_${day.dateStr}`} className="border border-slate-950 px-2 py-1">
                    <span>P.ĂN</span>
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
                matrixData.rows.map((row, index) => {
                  const isFirstSpecialRow =
                    row.isSpecial && (index === 0 || !matrixData.rows[index - 1].isSpecial);

                  return (
                    <React.Fragment key={row.classId}>
                      {isFirstSpecialRow && (
                        <tr key="special-divider-row" className="bg-amber-100 special-section-header">
                          <td
                            colSpan={6}
                            className="border border-slate-950 px-3 py-1.5 text-left text-xs sm:text-sm font-extrabold uppercase tracking-wide text-amber-900 bg-amber-100"
                          >
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-amber-700 no-print" />
                              <span>CÁC LỚP LỊCH ĂN ĐẶC BIỆT</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row.isSpecial ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Cột Lớp */}
                        <td
                          className={`border border-slate-950 font-bold px-2.5 py-1.5 ${
                            row.isSpecial
                              ? 'bg-amber-50 text-amber-950'
                              : 'bg-slate-50/50 text-slate-900'
                          }`}
                        >
                          {row.isSpecial ? (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] bg-amber-200 text-amber-900 border border-amber-300 font-extrabold uppercase tracking-wider">
                                ĐẶC BIỆT
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-900">
                                {row.className.replace(/^\[Đặc biệt\]\s*/, '')}
                              </span>
                            </div>
                          ) : (
                            row.className
                          )}
                        </td>

                        {/* 5 Cột Thứ 2 -> Thứ 6 */}
                        {matrixData.days.map((day) => {
                          const cell = row.courts[day.dateStr];
                          const hasMultiAllocs = cell?.allocations && cell.allocations.length > 1;
                          const courtName = cell?.courtName || '';
                          const isTiet4 = cell?.shift === 'TIET_4';
                          const shiftLabel = isTiet4 ? '(Tiết 4)' : '(Tiết 5)';
                          const shiftDesc = isTiet4 ? 'Ăn lúc 10g30' : 'Ăn lúc 11g20';

                          return (
                            <td
                              key={day.dateStr}
                              onClick={() => handleCellClick(cell || null, row, day.dateStr, day.dayLabel)}
                              className={`border border-slate-950 px-2 py-1.5 transition-all ${
                                canEdit ? 'cursor-pointer hover:bg-blue-50/70' : ''
                              } ${courtName ? 'text-slate-900 bg-white' : 'text-slate-300 bg-slate-50/30'}`}
                              title={
                                courtName
                                  ? `${row.className} - ${courtName}${canEdit ? '\nClick để sửa/đổi sân cho lớp này' : ''}`
                                  : canEdit
                                  ? `Chưa có sân. Click để gán sân cho ${row.className}`
                                  : 'Không ăn'
                              }
                            >
                              {hasMultiAllocs ? (
                                <div className="flex flex-col items-center justify-center divide-y divide-slate-200 w-full py-0.5">
                                  {cell!.allocations!.map((alloc, aIdx) => {
                                    const isT4 = alloc.shift === 'TIET_4';
                                    return (
                                      <div
                                        key={aIdx}
                                        className={`w-full flex flex-col items-center justify-center ${
                                          aIdx > 0 ? 'pt-1 mt-0.5' : 'pb-1'
                                        }`}
                                      >
                                        <span className="font-bold tracking-tight uppercase text-xs sm:text-sm">
                                          {alloc.courtName}
                                        </span>
                                        <span
                                          className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 ${
                                            isT4 ? 'text-amber-700 shift-tiet4' : 'text-indigo-700 shift-tiet5'
                                          }`}
                                        >
                                          {isT4 ? '(Tiết 4)' : '(Tiết 5)'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : courtName ? (
                                <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                  <span className="font-bold tracking-tight uppercase text-xs sm:text-sm">
                                    {cell?.allocations?.[0]?.courtName || courtName}
                                  </span>
                                  <span
                                    className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 ${
                                      isTiet4 ? 'text-amber-700 shift-tiet4' : 'text-indigo-700 shift-tiet5'
                                    }`}
                                  >
                                    {shiftLabel}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 select-none">&nbsp;</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="border border-slate-950 py-8 text-center text-slate-500">
                    {matrixData && !matrixData.hasAnyAllocation
                      ? 'Tuần này chưa có phân bổ sân ăn nào. Vui lòng bấm "Chia tự động cả tuần" hoặc "Sao chép từ tuần trước" để thiết lập.'
                      : 'Không có lớp nào có lịch ăn bán trú trong tuần này.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ghi chú thời gian ăn Tiết 4 / Tiết 5 (Hiển thị đồng bộ trên màn hình, ảnh xuất PNG và bản in A4) */}
        <div className="footnote mt-3 pt-2 border-t border-slate-200 text-xs text-slate-700 font-medium italic flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-900 not-italic">* Ghi chú thời gian ăn: </span>
            <span className="text-amber-700 font-bold not-italic">Tiết 4</span> (Ăn lúc 10g30) &nbsp;|&nbsp;{' '}
            <span className="text-indigo-700 font-bold not-italic">Tiết 5</span> (Ăn lúc 11g20)
          </div>
          <div className="text-[11px] text-slate-500 not-italic">
            Học sinh di chuyển xuống nhà ăn đúng giờ quy định theo từng tiết học
          </div>
        </div>

        {/* Chữ ký xác nhận chân trang khi In (Chỉ xuất hiện khi in ấn) */}
        <div id="print-signatures-block" className="hidden print:block mt-8 pt-4">
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
                    .filter((item) => item.week !== schoolWeekNumber)
                    .map((item) => (
                      <SelectItem key={item.week} value={String(item.week)}>
                        {item.label}
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
            {editCellData?.isSpecial ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-800">
                    Sân Ca Tiết 4 (Ăn lúc 10g30):
                  </label>
                  <Select value={selectedT4Court} onValueChange={setSelectedT4Court}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn sân ca Tiết 4" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="NONE" className="text-rose-600 font-medium">
                        (Không xếp sân / Bỏ sân Tiết 4)
                      </SelectItem>
                      {Array.from({ length: 16 }, (_, i) => `SÂN ${i + 1}`).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-indigo-800">
                    Sân Ca Tiết 5 (Ăn lúc 11g20):
                  </label>
                  <Select value={selectedT5Court} onValueChange={setSelectedT5Court}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn sân ca Tiết 5" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="NONE" className="text-rose-600 font-medium">
                        (Không xếp sân / Bỏ sân Tiết 5)
                      </SelectItem>
                      {Array.from({ length: 16 }, (_, i) => `SÂN ${i + 1}`).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
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
            )}
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
