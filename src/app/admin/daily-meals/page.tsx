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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

interface TotalSummary {
  totalRegistered: number;
  totalCanceled: number;
  finalMan: number;
  finalChay: number;
  finalChao: number;
  finalTotal: number;
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
  isLocked: boolean;
}

interface DailyMealsResponse {
  date?: string;
  weekNumber?: number;
  dayField?: string;
  totalSummary?: TotalSummary;
  classSummaries?: ClassSummary[];
  isFullyLocked?: boolean;
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

export default function DailyMealsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDateString());
  const [data, setData] = useState<DailyMealsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>('TRƯỜNG TIỂU HỌC THĂNG LONG MỚI');
  const [alertMessage, setAlertMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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
    async (dateToFetch: string) => {
      setIsLoading(true);
      setAlertMessage(null);
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
        setAlertMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Có lỗi xảy ra khi tải dữ liệu',
        });
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load data on initial render and when selectedDate changes
  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // Handle lock meals
  const handleLockMeals = async () => {
    setIsLocking(true);
    setAlertMessage(null);
    try {
      const res = await fetch('/api/daily-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Lỗi khi chốt suất ăn');
      }

      setIsConfirmOpen(false);
      setAlertMessage({
        type: 'success',
        text: result.message || `Đã chốt thành công suất ăn cho ngày ${selectedDate}!`,
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
  };

  const classSummaries = data?.classSummaries || [];
  const isFullyLocked = data?.isFullyLocked || false;
  const formattedDateString = formatDisplayDate(selectedDate);

  return (
    <div className="space-y-6">
      {/* ========================================================
          PRINT STYLING SHEET (VISIBLE ONLY ON PRINT)
         ======================================================== */}
      <style jsx global>{`
        @media print {
          /* Hide sidebar, navigation, headers outside print template */
          body {
            background-color: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          aside,
          nav,
          .no-print,
          button,
          input,
          .badge-no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 10px !important;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #1e293b !important;
            padding: 5px 8px !important;
            text-align: center !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
          .print-table td.text-left {
            text-align: left !important;
          }
          .print-table td.text-right {
            text-align: right !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================
          PRINT-ONLY HEADER & VOUCHER TEMPLATE
         ======================================================== */}
      <div className="print-only mb-6">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-800">
              {schoolName}
            </h3>
            <p className="text-xs text-slate-600">Bộ phận Quản lý Bán trú</p>
          </div>
          <div className="text-right">
            <p className="text-xs italic text-slate-600">
              Ngày in: {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </p>
            <p className="text-xs font-semibold text-slate-800">Mẫu: PB-01/BT</p>
          </div>
        </div>

        <div className="text-center my-4">
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            PHIẾU BÁO SUẤT ĂN BÁN TRÚ NHÀ BẾP
          </h1>
          <p className="text-sm font-medium text-slate-700 capitalize mt-1">
            Ngày phục vụ: <span className="font-bold">{formattedDateString}</span>
          </p>
          <p className="text-xs italic text-slate-500">
            (Căn cứ theo dữ liệu chốt suất ăn bán trú ngày {selectedDate})
          </p>
        </div>

        {/* Print Summary Quick Table */}
        <div className="my-4 p-3 border border-slate-900 rounded bg-slate-50">
          <div className="grid grid-cols-6 gap-2 text-center text-xs">
            <div className="border-r border-slate-300 pr-2">
              <span className="block text-slate-500 font-medium">Tổng đăng ký</span>
              <span className="text-sm font-bold text-slate-900">
                {totalSummary.totalRegistered}
              </span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="block text-slate-500 font-medium">Số cắt suất</span>
              <span className="text-sm font-bold text-red-600">
                {totalSummary.totalCanceled}
              </span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="block text-slate-500 font-medium">Suất Mặn</span>
              <span className="text-sm font-bold text-slate-900">
                {totalSummary.finalMan}
              </span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="block text-slate-500 font-medium">Suất Chay</span>
              <span className="text-sm font-bold text-slate-900">
                {totalSummary.finalChay}
              </span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="block text-slate-500 font-medium">Suất Cháo</span>
              <span className="text-sm font-bold text-slate-900">
                {totalSummary.finalChao}
              </span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Tổng thực tế</span>
              <span className="text-base font-extrabold text-blue-900">
                {totalSummary.finalTotal}
              </span>
            </div>
          </div>
        </div>
      </div>

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
          <div className="flex items-center gap-2.5">
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
        </div>

        {/* Date Selector Filter Bar */}
        <Card className="border-slate-200 shadow-xs bg-white">
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

                {isFullyLocked ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Đã chốt sổ ngày này</span>
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 px-3 py-1.5 text-xs font-medium gap-1.5 shadow-xs">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Chưa chốt đầy đủ</span>
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
            className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-all ${
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
      </div>

      {/* ========================================================
          TOTAL SUMMARY CARDS (Screen view)
         ======================================================== */}
      <div className="no-print space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-slate-500" />
            Tổng hợp toàn trường ({selectedDate})
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
          TABLE OF CLASS DETAILS (Dual View: Screen + Print)
         ======================================================== */}
      <Card className="print-card border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="no-print border-b bg-slate-50/60 p-4 sm:p-5">
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
                Không có dữ liệu suất ăn cho ngày {selectedDate}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Vui lòng kiểm tra lại thời khóa biểu tuần của các lớp hoặc chọn một ngày học khác.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="print-table">
                <TableHeader className="bg-slate-50/90 text-xs">
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
                  {classSummaries.map((item, index) => (
                    <TableRow
                      key={item.classId}
                      className="hover:bg-slate-50/70 transition-colors text-sm"
                    >
                      <TableCell className="text-center font-medium text-slate-500">
                        {index + 1}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          PRINT SIGNATURE SECTION (VISIBLE ONLY ON PRINT)
         ======================================================== */}
      <div className="print-only mt-8 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <p className="font-bold uppercase text-slate-800">Người lập biểu</p>
            <p className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
            <div className="h-20" />
            <p className="font-semibold text-slate-700">........................................</p>
          </div>
          <div>
            <p className="font-bold uppercase text-slate-800">Bếp trưởng / Tiếp phẩm</p>
            <p className="text-[11px] italic text-slate-500">(Ký xác nhận nhận số lượng)</p>
            <div className="h-20" />
            <p className="font-semibold text-slate-700">........................................</p>
          </div>
          <div>
            <p className="font-bold uppercase text-slate-800">Ban Giám hiệu duyệt</p>
            <p className="text-[11px] italic text-slate-500">(Ký và đóng dấu)</p>
            <div className="h-20" />
            <p className="font-semibold text-slate-700">........................................</p>
          </div>
        </div>
      </div>

      {/* ========================================================
          BIG ACTION LOCK BUTTON (no-print)
         ======================================================== */}
      <div className="no-print pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-100/60 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Khóa sổ dữ liệu ngày {selectedDate}
            </h4>
            <p className="text-xs text-slate-500">
              Sau khi chốt, dữ liệu sẽ được lưu cố định vào bảng tổng hợp và gửi số lượng sang nhà bếp.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isLoading || isLocking || classSummaries.length === 0}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 shadow-md hover:shadow-lg transition-all text-sm gap-2 cursor-pointer"
        >
          <Lock className="h-4 w-4" />
          <span>CHỐT SUẤT ĂN NGÀY {selectedDate}</span>
        </Button>
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
                  Xác nhận chốt suất ăn
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Khóa sổ số lượng suất ăn gửi nhà bếp
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
