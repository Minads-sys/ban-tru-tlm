'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ChefHat,
  Lock,
  Printer,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Utensils,
  ShieldCheck,
  Building2,
  Check,
  Flame,
  Soup,
  Leaf,
  Info,
  UtensilsCrossed,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DiningCourtTab } from '@/components/admin/dining-court-tab';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
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
import { useRealtime } from '@/hooks/use-realtime';

interface TotalSummary {
  totalRegistered: number;
  totalCanceled: number;
  finalMan: number;
  finalChay: number;
  finalChao: number;
  finalTotal: number;
  expectedMan: number;
  expectedChay: number;
  expectedChao: number;
  expectedTotal: number;
}

interface ClassSummary {
  classId: string;
  className: string;
  totalRegistered: number;
  totalCanceled: number;
  finalMan: number;
  finalChay: number;
  finalChao: number;
  finalTotal: number;
  expectedMan: number;
  expectedChay: number;
  expectedChao: number;
  expectedTotal: number;
  isLocked: boolean;
  expectedLockedAt: string | null;
}

interface DailyMealsResponse {
  date?: string;
  weekNumber?: number;
  dayField?: string;
  lockTime2?: string;
  totalSummary?: TotalSummary;
  classSummaries?: ClassSummary[];
  isFullyLocked?: boolean;
  isAfterLockTime?: boolean;
  isExpectedLocked?: boolean;
  message?: string;
  error?: string;
}

function getTomorrowDateString(): string {
  const tomorrow = addDays(new Date(), 1);
  return format(tomorrow, 'yyyy-MM-dd');
}

function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return format(dateObj, 'EEEE, dd/MM/yyyy', { locale: vi });
  } catch {
    return dateStr;
  }
}

function formatDateDDMMYYYY(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  } catch {
    return dateStr;
  }
}

function formatFullDateVietnamese(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = format(dateObj, 'EEEE', { locale: vi });
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    return `${capitalizedDay}, ngày ${dayStr}/${monthStr}/${y}`;
  } catch {
    return dateStr;
  }
}

export default function DailyMealsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDateString());
  const [activeMainTab, setActiveMainTab] = useState<'summary' | 'dining-areas'>('summary');
  const [data, setData] = useState<DailyMealsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [lockType, setLockType] = useState<"EXPECTED" | "FINAL">("FINAL");
  const [schoolName, setSchoolName] = useState<string>('TRƯỜNG TIỂU HỌC THĂNG LONG MỚI');
  const [alertMessage, setAlertMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Read URL query parameter for tab selection (e.g. ?tab=dining-areas)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'dining-areas' || tabParam === 'summary') {
        setActiveMainTab(tabParam);
      }
    }
  }, []);

  // Fetch school settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const settings = await res.json();
          if (settings.SCHOOL_NAME) {
            setSchoolName(settings.SCHOOL_NAME);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải cài đặt trường học:', err);
      }
    }
    loadSettings();
  }, []);

  // Fetch daily meals data
  const fetchData = useCallback(
    async (dateToFetch: string, showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
        setAlertMessage(null);
      }
      try {
        const res = await fetch(`/api/daily-meals?date=${dateToFetch}`);
        const result: DailyMealsResponse = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Lỗi khi tải dữ liệu tổng hợp suất ăn');
        }

        setData(result);
        if (result.message && (!result.classSummaries || result.classSummaries.length === 0)) {
          setAlertMessage({
            type: 'info',
            text: result.message,
          });
        }
      } catch (error) {
        console.error('Fetch daily meals error:', error);
        if (showLoading) {
          setAlertMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Có lỗi xảy ra khi tải dữ liệu',
          });
          setData(null);
        }
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    []
  );

  // Load data on initial render and when selectedDate changes
  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // Lắng nghe thay đổi Realtime từ máy chủ VPS ngầm (không làm chớp màn hình)
  useRealtime({
    table: 'daily_meals',
    onChanged: () => fetchData(selectedDate, false),
  });

  // Định kỳ tự động đồng bộ khi xem ngày hôm nay để cập nhật trạng thái chốt tức thì khi đến giờ
  useEffect(() => {
    if (selectedDate !== getTodayDateString()) return;
    const interval = setInterval(() => {
      fetchData(selectedDate, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchData]);

  // Helper check if report is past lock time 2 (chốt chính thức)
  const isPastLockTime2 = useCallback(() => {
    if (data?.isAfterLockTime !== undefined) return data.isAfterLockTime;
    if (!data || !data.date || !data.lockTime2) return false;
    const now = new Date();
    const vnTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnNow = new Date(vnTimeStr);
    
    // Convert report date
    const [y, m, d] = data.date.split("-").map(Number);
    const rDate = new Date(y, m - 1, d);
    
    const today = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
    
    if (rDate.getTime() < today.getTime()) return true; // Quá khứ
    if (rDate.getTime() > today.getTime()) return false; // Tương lai
    
    // Hôm nay, so sánh giờ phút
    const [hours, minutes] = data.lockTime2.split(":").map(Number);
    if (vnNow.getHours() > hours) return true;
    if (vnNow.getHours() === hours && vnNow.getMinutes() >= minutes) return true;
    
    return false;
  }, [data]);

  // Handle lock meals
  const handleLockMeals = async () => {
    setIsLocking(true);
    setAlertMessage(null);
    try {
      const res = await fetch('/api/daily-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, type: lockType }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Lỗi khi chốt suất ăn');
      }

      setIsConfirmOpen(false);
      setAlertMessage({
        type: 'success',
        text: result.message || `Đã chốt thành công suất ăn cho ngày ${formatDateDDMMYYYY(selectedDate)}!`,
      });
      // Refresh data
      await fetchData(selectedDate);
    } catch (error) {
      console.error('Lock meals error:', error);
      setAlertMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Có lỗi xảy ra khi chốt suất ăn',
      });
    } finally {
      setIsLocking(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalSummary = data?.totalSummary || {
    totalRegistered: 0,
    totalCanceled: 0,
    finalMan: 0,
    finalChay: 0,
    finalChao: 0,
    finalTotal: 0,
    expectedMan: 0,
    expectedChay: 0,
    expectedChao: 0,
    expectedTotal: 0,
  };

  const classSummaries = data?.classSummaries || [];
  const isFullyLocked = data?.isFullyLocked || false;
  const isExpectedLocked = data?.isExpectedLocked || false;
  const formattedDateString = formatDisplayDate(selectedDate);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Reset page when date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  const totalPages = Math.ceil(classSummaries.length / ITEMS_PER_PAGE);
  const paginatedClassSummaries = classSummaries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* ========================================================
          PRINT STYLING SHEET (A4 PORTRAIT SPECIFIC)
         ======================================================== */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 12mm 12mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all screen components */
          .no-print,
          .no-print * {
            display: none !important;
          }
          /* Show print document */
          .print-only {
            display: block !important;
          }
          .a4-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          .a4-print-table thead {
            display: table-header-group !important;
          }
          .a4-print-table tfoot {
            display: table-footer-group !important;
          }
          .a4-print-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .a4-print-table th,
          .a4-print-table td {
            border: 1px solid #000000 !important;
            padding: 4px 6px !important;
          }
          .a4-signatures {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================
          DEDICATED A4 PORTRAIT PRINT VOUCHER (MẪU PB-01/BT)
         ======================================================== */}
      {activeMainTab === 'summary' && (
        <div className="print-only font-sans text-black">
        {/* Header 2 cột: Đơn vị & Mẫu biểu */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide text-black">
              {schoolName}
            </h3>
            <p className="text-xs text-slate-800 font-medium mt-0.5">Bộ phận Quản lý Bán trú</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-black uppercase">Mẫu: PB-01/BT</p>
            <p className="text-[11px] italic text-slate-600 mt-0.5">
              Ngày in: {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>

        {/* Tiêu đề & Thông tin ngày */}
        <div className="text-center my-3">
          <h1 className="text-xl font-black uppercase tracking-wider text-black">
            PHIẾU BÁO SUẤT ĂN BÁN TRÚ NHÀ BẾP
          </h1>
          <p className="text-sm font-bold text-black mt-1">
            Ngày phục vụ: <span className="uppercase underline decoration-1">{formatFullDateVietnamese(selectedDate)}</span>
          </p>
          <p className="text-xs italic text-slate-600 mt-0.5">
            (Căn cứ theo dữ liệu chốt suất ăn bán trú ngày {formatDateDDMMYYYY(selectedDate)})
          </p>

          {/* Ô trạng thái chốt sổ */}
          <div className="mt-2 inline-block">
            {(isFullyLocked || isPastLockTime2()) ? (
              <div className="border-[1.5px] border-black bg-slate-100 px-3 py-1 rounded text-xs font-bold tracking-wide uppercase">
                ✓ ĐÃ CHỐT SỐ BÁO BẾP (Khóa sổ theo quy định: {data?.lockTime2 || "07:00"})
              </div>
            ) : (
              <div className="border-[1.5px] border-black bg-slate-100 px-3 py-1 rounded text-xs font-bold tracking-wide uppercase">
                ⚠ SỐ LIỆU CHƯA CHỐT - TẠM TÍNH (Tự động khóa lúc: {data?.lockTime2 || "07:00"})
              </div>
            )}
          </div>
        </div>

        {/* Các ô thống kê rõ ràng (Summary Statistics Box) */}
        <div className="my-3 border-[1.5px] border-black">
          <div className="grid grid-cols-6 divide-x-[1.5px] divide-black text-center bg-slate-50">
            <div className="p-2">
              <div className="text-[11px] font-bold text-slate-800 uppercase">Tổng đăng ký</div>
              <div className="text-xl font-black text-black mt-0.5">{totalSummary.totalRegistered}</div>
              <div className="text-[10px] text-slate-500 font-medium">suất</div>
            </div>
            <div className="p-2">
              <div className="text-[11px] font-bold text-slate-800 uppercase">Số cắt suất</div>
              <div className="text-xl font-black text-red-600 mt-0.5">
                {totalSummary.totalCanceled > 0 ? `-${totalSummary.totalCanceled}` : "0"}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">suất nghỉ</div>
            </div>
            <div className="p-2">
              <div className="text-[11px] font-bold text-slate-800 uppercase">Suất Mặn</div>
              <div className="text-xl font-black text-black mt-0.5">{totalSummary.finalMan}</div>
              <div className="text-[10px] text-slate-500 font-medium">suất</div>
            </div>
            <div className="p-2">
              <div className="text-[11px] font-bold text-slate-800 uppercase">Suất Chay</div>
              <div className="text-xl font-black text-black mt-0.5">{totalSummary.finalChay}</div>
              <div className="text-[10px] text-slate-500 font-medium">suất</div>
            </div>
            <div className="p-2">
              <div className="text-[11px] font-bold text-slate-800 uppercase">Suất Cháo</div>
              <div className="text-xl font-black text-black mt-0.5">{totalSummary.finalChao}</div>
              <div className="text-[10px] text-slate-500 font-medium">suất</div>
            </div>
            <div className="p-2 bg-slate-200">
              <div className="text-[11px] font-black text-black uppercase">Tổng thực tế</div>
              <div className="text-2xl font-black text-black mt-0.5">{totalSummary.finalTotal}</div>
              <div className="text-[10px] font-extrabold text-black">Giao nhà bếp</div>
            </div>
          </div>
        </div>

        {/* Bảng danh sách chi tiết toàn bộ các lớp (ĐẦY ĐỦ, KHÔNG phân trang, KHÔNG thanh cuộn) */}
        <div className="my-3">
          <div className="text-xs font-bold text-black mb-1.5 flex justify-between items-center">
            <span className="uppercase tracking-wide">Chi tiết số lượng suất ăn từng lớp:</span>
            <span className="font-semibold text-slate-700">Tổng số: {classSummaries.length} lớp</span>
          </div>

          <table className="a4-print-table text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-center w-9 font-bold">STT</th>
                <th className="text-left w-20 font-bold px-2">Lớp</th>
                <th className="text-center w-24 font-bold">Tổng đăng ký</th>
                <th className="text-center w-16 font-bold text-red-600">Số cắt</th>
                <th className="text-center w-16 font-bold">Mặn</th>
                <th className="text-center w-16 font-bold">Chay</th>
                <th className="text-center w-16 font-bold">Cháo</th>
                <th className="text-center w-24 font-black bg-slate-100">Tổng thực tế</th>
                <th className="text-center font-bold">Ký nhận / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {classSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-slate-500 italic">
                    Không có dữ liệu suất ăn cho ngày {formatDateDDMMYYYY(selectedDate)}
                  </td>
                </tr>
              ) : (
                classSummaries.map((item, index) => (
                  <tr key={item.classId}>
                    <td className="text-center font-medium">{index + 1}</td>
                    <td className="text-left font-bold px-2">{item.className}</td>
                    <td className="text-center">{item.totalRegistered}</td>
                    <td className={`text-center font-semibold ${item.totalCanceled > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {item.totalCanceled > 0 ? `-${item.totalCanceled}` : "0"}
                    </td>
                    <td className="text-center">{item.finalMan}</td>
                    <td className="text-center">{item.finalChay}</td>
                    <td className="text-center">{item.finalChao}</td>
                    <td className="text-center font-black text-sm bg-slate-50">
                      {item.finalTotal}
                    </td>
                    <td className="text-left px-2"></td>
                  </tr>
                ))
              )}
            </tbody>
            {classSummaries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black">
                  <td colSpan={2} className="text-center uppercase font-black py-1.5">
                    TỔNG CỘNG ({classSummaries.length} LỚP)
                  </td>
                  <td className="text-center py-1.5">{totalSummary.totalRegistered}</td>
                  <td className="text-center py-1.5 text-red-600">
                    {totalSummary.totalCanceled > 0 ? `-${totalSummary.totalCanceled}` : "0"}
                  </td>
                  <td className="text-center py-1.5">{totalSummary.finalMan}</td>
                  <td className="text-center py-1.5">{totalSummary.finalChay}</td>
                  <td className="text-center py-1.5">{totalSummary.finalChao}</td>
                  <td className="text-center py-1.5 text-sm font-black bg-slate-200">
                    {totalSummary.finalTotal}
                  </td>
                  <td className="text-center text-[10px] text-slate-500 font-normal italic">
                    (Số liệu chốt bếp)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Chữ ký 3 bên */}
        <div className="a4-signatures mt-6 pt-2">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <p className="font-bold uppercase text-black">Người lập biểu</p>
              <p className="text-[11px] italic text-slate-600 mt-0.5">(Ký và ghi rõ họ tên)</p>
              <div className="h-20" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
            <div>
              <p className="font-bold uppercase text-black">Bếp trưởng / Tiếp phẩm</p>
              <p className="text-[11px] italic text-slate-600 mt-0.5">(Ký xác nhận nhận số lượng)</p>
              <div className="h-20" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
            <div>
              <p className="font-bold uppercase text-black">Ban Giám hiệu duyệt</p>
              <p className="text-[11px] italic text-slate-600 mt-0.5">(Ký và đóng dấu)</p>
              <div className="h-20" />
              <p className="font-semibold text-slate-800">........................................</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================
          SCREEN UI: PAGE HEADER & ACTION CONTROLS (no-print)
         ======================================================== */}
      <div className="no-print space-y-4">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Chốt suất ăn hàng ngày
              </h1>
              <p className="text-sm text-muted-foreground">
                Tổng hợp số lượng học sinh ăn thực tế theo lớp và khóa số liệu gửi bộ phận bếp
              </p>
            </div>
          </div>

          {/* Quick Print & Action Buttons */}
          {activeMainTab === 'summary' && (
            <div className="flex items-center gap-2.5">
              {classSummaries.length > 0 && !isFullyLocked && (
                <Button
                  variant="outline"
                  className="border-blue-500 text-blue-700 hover:bg-blue-50"
                  onClick={() => { setLockType("EXPECTED"); setIsConfirmOpen(true); }}
                  disabled={isLocking || isLoading}
                >
                  {isExpectedLocked ? "Cập nhật lại Số Dự Kiến" : "Chốt số Dự Kiến (Lần 1)"}
                </Button>
              )}
              {classSummaries.length > 0 && !isFullyLocked && isPastLockTime2() && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setLockType("FINAL"); setIsConfirmOpen(true); }}
                  disabled={isLocking || isLoading}
                >
                  Chốt Chính Thức (Lần 2)
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading || classSummaries.length === 0}
                className="gap-2 border-slate-300 hover:bg-slate-100 shadow-xs cursor-pointer"
              >
                <Printer className="h-4 w-4 text-slate-600" />
                <span>In phiếu bếp</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(selectedDate)}
                disabled={isLoading}
                className="gap-2 border-slate-300 hover:bg-slate-100 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </Button>
            </div>
          )}
        </div>

        {/* Main Tabs Navigation */}
        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'summary' | 'dining-areas')} className="w-full">
          <TabsList className="no-print grid w-full max-w-md grid-cols-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-2xs h-auto">
            <TabsTrigger
              value="summary"
              className="gap-2 py-2 font-semibold cursor-pointer transition-all duration-150 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
            >
              <ChefHat className="h-4 w-4 text-slate-600 group-data-[state=active]:text-white" />
              Chốt suất ăn
            </TabsTrigger>
            <TabsTrigger
              value="dining-areas"
              className="gap-2 py-2 font-semibold cursor-pointer transition-all duration-150 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
            >
              <UtensilsCrossed className="h-4 w-4 text-slate-600 group-data-[state=active]:text-white" />
              Chia sân ăn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6 mt-4">
            {/* Date Selector Filter Bar */}
            <Card className="no-print border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>Chọn ngày chốt:</span>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={selectedDate === getTodayDateString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDate(getTodayDateString())}
                    className="h-8 text-xs font-medium cursor-pointer"
                  >
                    Hôm nay
                  </Button>
                  <Button
                    type="button"
                    variant={selectedDate === getTomorrowDateString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDate(getTomorrowDateString())}
                    className="h-8 text-xs font-medium cursor-pointer"
                  >
                    Ngày mai
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => fetchData(selectedDate)}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs text-sm cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Tải tổng hợp</span>
                </Button>

                {classSummaries.length === 0 ? (
                  <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                    <span>Không có dữ liệu</span>
                  </Badge>
                ) : (isFullyLocked || isPastLockTime2()) ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>ĐÃ CHỐT SỐ BÁO BẾP</span>
                  </Badge>
                ) : isExpectedLocked ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>Đã chốt suất dự kiến</span>
                  </Badge>
                ) : (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <Clock className="h-4 w-4 text-rose-600" />
                    <span>Số liệu chưa chốt</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Current Target Date Banner */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span>Ngày đang xem:</span>
                <span className="font-bold text-blue-700 capitalize">{formattedDateString}</span>
                {data?.weekNumber && (
                  <span className="text-slate-400"> (Tuần {data.weekNumber})</span>
                )}
              </div>
              <div className="text-slate-500">
                {classSummaries.length > 0
                  ? `Tìm thấy ${classSummaries.length} lớp có lịch ăn`
                  : 'Không có dữ liệu'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert Notification */}
        {alertMessage && (
          <div
            className={`no-print flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-all ${
              alertMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : alertMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : alertMessage.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-blue-600" />
            )}
            <span>{alertMessage.text}</span>
          </div>
        )}

      {/* ========================================================
          TOTAL SUMMARY CARDS (Screen view)
         ======================================================== */}
      <div className="no-print space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-slate-500" />
            Tổng hợp toàn trường ({formatDateDDMMYYYY(selectedDate)})
            
            {/* Status Badge */}
            {isFullyLocked ? (
              <Badge className="ml-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300">
                Đã chốt sổ ngày ăn
              </Badge>
            ) : isExpectedLocked ? (
              <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300">
                Đã chốt suất dự kiến đi chợ
              </Badge>
            ) : null}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Tổng đăng ký */}
          <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1">
              <CardDescription className="text-xs font-medium text-slate-500">
                Tổng đăng ký
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold text-slate-900">
                {totalSummary.totalRegistered}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Theo TKB tuần</span>
            </CardContent>
          </Card>

          {/* 2. Suất cắt */}
          <Card className="border-rose-100 bg-rose-50/30 shadow-xs hover:border-rose-200 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1">
              <CardDescription className="text-xs font-medium text-rose-700">
                Suất cắt
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold text-rose-600">
                {totalSummary.totalCanceled}
              </div>
              <span className="text-[11px] text-rose-500 font-medium">Đã duyệt cắt</span>
            </CardContent>
          </Card>

          {/* 3. Suất Mặn */}
          <Card className="border-amber-100 bg-amber-50/20 shadow-xs hover:border-amber-200 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-amber-800">
                Suất Mặn
              </CardDescription>
              <Flame className="h-3.5 w-3.5 text-amber-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold text-amber-900">
                {totalSummary.finalMan}
              </div>
              <span className="text-[11px] text-amber-700/80 font-medium">Thực đơn thường</span>
            </CardContent>
          </Card>

          {/* 4. Suất Chay */}
          <Card className="border-emerald-100 bg-emerald-50/20 shadow-xs hover:border-emerald-200 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-emerald-800">
                Suất Chay
              </CardDescription>
              <Leaf className="h-3.5 w-3.5 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold text-emerald-800">
                {totalSummary.finalChay}
              </div>
              <span className="text-[11px] text-emerald-700/80 font-medium">Ăn chay định kỳ</span>
            </CardContent>
          </Card>

          {/* 5. Suất Cháo */}
          <Card className="border-sky-100 bg-sky-50/20 shadow-xs hover:border-sky-200 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-xs font-medium text-sky-800">
                Suất Cháo
              </CardDescription>
              <Soup className="h-3.5 w-3.5 text-sky-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold text-sky-800">
                {totalSummary.finalChao}
              </div>
              <span className="text-[11px] text-sky-700/80 font-medium">Học sinh ốm/cháo</span>
            </CardContent>
          </Card>

          {/* 6. Tổng suất thực tế */}
          <Card className="border-blue-200 bg-blue-50/50 shadow-xs hover:border-blue-300 transition-colors">
            <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-1">
              <CardDescription className="text-xs font-bold text-blue-900">
                Tổng thực tế
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-extrabold text-blue-700">
                {totalSummary.finalTotal}
              </div>
              <span className="text-[11px] text-blue-600 font-semibold">Giao nhà bếp</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================
          TABLE OF CLASS DETAILS (Screen View with Pagination)
         ======================================================== */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Chi tiết suất ăn theo từng lớp
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Số liệu phân bổ từng loại suất ăn (Mặn, Chay, Cháo) và trạng thái chốt sổ từng lớp
              </CardDescription>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Tổng số lớp:{' '}
              <span className="font-semibold text-slate-800">{classSummaries.length}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Đang tải và tổng hợp dữ liệu suất ăn...</p>
            </div>
          ) : classSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Không có dữ liệu suất ăn cho ngày {formatDateDDMMYYYY(selectedDate)}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Vui lòng kiểm tra lại thời khóa biểu tuần của các lớp hoặc chọn một ngày học khác.
              </p>
            </div>
          ) : (
            <>
              {/* CẢNH BÁO TRẠNG THÁI CHỐT SỔ */}
              {(isFullyLocked || isPastLockTime2()) ? (
                <div className="bg-emerald-600 text-white font-bold py-2.5 px-4 text-center text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs uppercase tracking-wide">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <span>ĐÃ CHỐT SỐ BÁO BẾP</span>
                </div>
              ) : (
                <div className="bg-red-600 text-white font-bold py-2.5 px-4 text-center text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs tracking-wide">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Số liệu chưa chốt</span>
                  <span className="text-xs font-normal opacity-90">
                    (Giờ chốt tự động trong cài đặt: {data?.lockTime2 || "07:00"})
                  </span>
                </div>
              )}
              <Table wrapperClassName="max-h-[65vh]">
                <TableHeader className="sticky top-0 z-10 bg-slate-50 text-xs shadow-sm shadow-slate-200">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold text-slate-700">STT</TableHead>
                    <TableHead className="font-bold text-slate-700">Lớp</TableHead>
                    <TableHead className="text-center font-bold text-slate-700">
                      Tổng đăng ký
                    </TableHead>
                    <TableHead className="text-center font-bold text-rose-700">
                      Số cắt
                    </TableHead>
                    <TableHead className="text-center font-bold text-amber-800">
                      Mặn
                    </TableHead>
                    <TableHead className="text-center font-bold text-emerald-800">
                      Chay
                    </TableHead>
                    <TableHead className="text-center font-bold text-sky-800">
                      Cháo
                    </TableHead>
                    <TableHead className="text-center font-extrabold text-blue-900 bg-blue-50/40">
                      Tổng thực tế
                    </TableHead>
                    <TableHead className="no-print text-center font-bold text-slate-700 w-32">
                      Trạng thái
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedClassSummaries.map((item, index) => (
                    <TableRow
                      key={item.classId}
                      className="hover:bg-slate-50/70 transition-colors text-sm"
                    >
                      <TableCell className="text-center font-medium text-slate-500">
                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 text-left">
                        <div className="flex items-center gap-2">
                          <span>{item.className || item.classId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-700">
                        {item.totalRegistered}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-rose-600">
                        {item.totalCanceled > 0 ? `-${item.totalCanceled}` : '0'}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-800">
                        {item.finalMan}
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-700">
                        {item.finalChay}
                      </TableCell>
                      <TableCell className="text-center font-medium text-sky-700">
                        {item.finalChao}
                      </TableCell>
                      <TableCell className="text-center font-bold text-blue-700 bg-blue-50/30 text-base">
                        {item.finalTotal}
                      </TableCell>
                      <TableCell className="no-print text-center">
                        {item.isLocked ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-xs font-medium gap-1">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Đã chốt</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs font-medium gap-1">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span>Chưa chốt</span>
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

                {/* Footer Totals Row */}
                <TableFooter className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                  <TableRow>
                    <TableCell colSpan={2} className="text-center sm:text-left font-bold text-sm">
                      TỔNG CỘNG ({classSummaries.length} LỚP)
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-900 text-sm">
                      {totalSummary.totalRegistered}
                    </TableCell>
                    <TableCell className="text-center font-bold text-rose-600 text-sm">
                      {totalSummary.totalCanceled > 0 ? `-${totalSummary.totalCanceled}` : '0'}
                    </TableCell>
                    <TableCell className="text-center font-bold text-amber-900 text-sm">
                      {totalSummary.finalMan}
                    </TableCell>
                    <TableCell className="text-center font-bold text-emerald-800 text-sm">
                      {totalSummary.finalChay}
                    </TableCell>
                    <TableCell className="text-center font-bold text-sky-800 text-sm">
                      {totalSummary.finalChao}
                    </TableCell>
                    <TableCell className="text-center font-extrabold text-blue-900 bg-blue-100/70 text-base">
                      {totalSummary.finalTotal}
                    </TableCell>
                    <TableCell className="no-print text-center">
                      {isFullyLocked ? (
                        <span className="text-xs text-emerald-700 font-semibold">100% Đã khóa</span>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold">Chưa khóa hết</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6 mt-2 no-print">
                <div className="flex flex-1 justify-between sm:hidden">
                  <Button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                  >
                    Trước
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                  >
                    Sau
                  </Button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Hiển thị <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, classSummaries.length)}</span> trong số <span className="font-medium">{classSummaries.length}</span> kết quả
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-l-md px-2 py-2 cursor-pointer"
                      >
                        <span className="sr-only">Trang trước</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                      </Button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 focus:outline-offset-0">
                        Trang {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-r-md px-2 py-2 cursor-pointer"
                      >
                        <span className="sr-only">Trang sau</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          BIG ACTION LOCK BUTTON (no-print)
         ======================================================== */}
      {classSummaries.length > 0 && (
        <div className="no-print pt-2">
          {(isFullyLocked || isPastLockTime2()) ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Đã chốt số báo bếp ngày {formatDateDDMMYYYY(selectedDate)}
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Dữ liệu đã tự động khóa theo giờ chốt ({data?.lockTime2 || "07:00"}). Nếu cần chốt bổ sung hoặc điều chỉnh, admin chỉ cần chỉnh sửa giờ chốt trong Cài đặt hệ thống.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-amber-50 p-4 rounded-xl border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Số liệu chưa chốt - Tự động chốt sổ lúc {data?.lockTime2 || "07:00"}
                  </h4>
                  <p className="text-xs text-amber-700">
                    Hệ thống sẽ tự động chốt sổ và khóa dữ liệu báo bếp sau giờ quy định mà không cần bấm nút chốt suất. Thao tác báo cắt và đổi món vẫn đang được tiếp nhận.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
          </TabsContent>

          <TabsContent value="dining-areas" className="no-print space-y-4 mt-4">
            <DiningCourtTab cutoffTime={data?.lockTime2 || "07:00"} schoolName={schoolName} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ========================================================
          CONFIRMATION LOCK DIALOG
         ======================================================== */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {lockType === "EXPECTED" ? "Xác nhận chốt dự kiến" : "Xác nhận chốt chính thức"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {lockType === "EXPECTED" 
                    ? "Lưu lại con số dự kiến gửi bộ phận bếp đi chợ"
                    : "Khóa sổ số lượng thực tế chia thức ăn và tính tiền"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-slate-700">
            <p>
              Bạn đang chuẩn bị chốt số lượng suất ăn cho{' '}
              <span className="font-bold text-slate-900">{classSummaries.length} lớp học</span> vào
              ngày: <span className="font-bold text-blue-700">{formattedDateString}</span>.
            </p>

            <div className="rounded-lg bg-slate-50 border p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng đăng ký:</span>
                <span className="font-semibold text-slate-800">{totalSummary.totalRegistered} suất</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số suất cắt:</span>
                <span className="font-semibold text-rose-600">-{totalSummary.totalCanceled} suất</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="font-bold text-slate-800">Tổng suất thực tế:</span>
                <span className="font-bold text-blue-700 text-sm">{totalSummary.finalTotal} suất</span>
              </div>
              <div className="text-[11px] text-slate-500 italic pt-1">
                (Mặn: {totalSummary.finalMan} | Chay: {totalSummary.finalChay} | Cháo: {totalSummary.finalChao})
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Lưu ý: Sau khi chốt, các yêu cầu cắt suất mới phát sinh sẽ không được tự động trừ vào phiếu bếp này trừ khi chốt lại.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isLocking}
              className="cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleLockMeals}
              disabled={isLocking}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 cursor-pointer"
            >
              {isLocking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang khóa sổ...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Xác nhận chốt ngay</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
