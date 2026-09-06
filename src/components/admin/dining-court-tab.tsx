'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { format, addDays } from 'date-fns';
import { DiningAllocationResult, DiningCourt } from '@/lib/dining-court-service';
import Swal from 'sweetalert2';

interface DiningCourtTabProps {
  cutoffTime: string;
}

export function DiningCourtTab({ cutoffTime }: DiningCourtTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState<DiningAllocationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeShift, setActiveShift] = useState<'ALL' | 'TIET_4' | 'TIET_5'>('ALL');
  const [expandedCourtIds, setExpandedCourtIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  const toggleExpand = (key: string) => {
    setExpandedCourtIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

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
    if (!data) return [];
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

  return (
    <div className="space-y-6">
      {/* 1. Thanh điều khiển ngày & Bộ lọc */}
      <Card className="border-slate-200 shadow-2xs bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            {/* Các nút xuất PDF hàng loạt */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportPdf('TIET_4')}
                disabled={loading || isExporting || !data || data.shifts.TIET_4.courts.length === 0}
                className="text-xs border-orange-200 bg-orange-50/50 hover:bg-orange-100 text-orange-800 shadow-2xs cursor-pointer gap-1.5 font-medium"
              >
                <FileText className="h-3.5 w-3.5 text-orange-600" />
                <span>Xuất PDF Tiết 4 ({data?.shifts.TIET_4.totalCourts || 0} sân)</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportPdf('TIET_5')}
                disabled={loading || isExporting || !data || data.shifts.TIET_5.courts.length === 0}
                className="text-xs border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-800 shadow-2xs cursor-pointer gap-1.5 font-medium"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                <span>Xuất PDF Tiết 5 ({data?.shifts.TIET_5.totalCourts || 0} sân)</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleExportPdf('ALL')}
                disabled={loading || isExporting || !data || data.totalCourts === 0}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5 font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xuất Trọn Bộ PDF ({data?.totalCourts || 0} sân)</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Băng cảnh báo trạng thái số liệu theo MEAL_LOCK_TIME_2 */}
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
            <div className="bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs tracking-wide">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Số liệu chưa chốt</span>
              <span className="text-xs font-normal opacity-90">
                (Số liệu phân sân tạm tính - Đang cập nhật đến giờ chốt tự động lúc {data.lockTime2 || cutoffTime})
              </span>
            </div>
          )}
        </>
      )}

      {/* 3. Thẻ thống kê tổng hợp */}
      {data && data.totalClasses > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng số sân</p>
                <p className="text-lg sm:text-xl font-bold text-slate-900">{data.totalCourts} sân</p>
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
                  {data.shifts.TIET_4.totalCourts}/16 sân{' '}
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
                  {data.shifts.TIET_5.totalCourts}/16 sân{' '}
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
                <p className="text-xs text-slate-500 font-medium">Tổng suất ăn</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">{data.totalMeals} suất</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Bộ lọc Tiết ăn & Tiêu chuẩn chia sân */}
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

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Tiêu chuẩn: Ưu tiên ghép 2 lớp (40 - 55 suất/sân). Sân lẻ nếu còn 1 lớp. Tối đa 16 sân / tiết ăn.</span>
        </div>
      </div>

      {/* 5. Danh sách các Sân */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-medium">Đang tính toán phân bổ chia sân theo số suất...</p>
        </div>
      ) : courtsToDisplay.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courtsToDisplay.map((court, idx) => {
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
                    <span className="text-xs font-semibold text-slate-700">
                      {isTiet4 ? 'Tiết 4 (Ca 1)' : 'Tiết 5 (Ca 2)'}
                    </span>
                    {court.isSingleClass ? (
                      <Badge variant="outline" className="text-[11px] bg-white text-slate-600 border-slate-300">
                        1 Lớp lẻ
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] bg-white text-blue-700 border-blue-200">
                        Ghép 2 lớp
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {court.isInIdealRange ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-[11px]">
                        Chuẩn (40-55)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 text-[11px]">
                        {court.totalMeals < 40 ? 'Dưới 40' : 'Trên 55'}
                      </Badge>
                    )}
                    <span className="text-sm font-extrabold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {court.totalMeals} suất
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
                            <TableHead className="p-1">Mã bán trú</TableHead>
                            <TableHead className="p-1">Họ tên</TableHead>
                            <TableHead className="w-12 text-center p-1">Lớp</TableHead>
                            <TableHead className="w-14 text-center p-1">Suất</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {court.students.map((st, sIdx) => (
                            <TableRow key={st.id} className="hover:bg-slate-50/80">
                              <TableCell className="text-center font-medium text-slate-500 p-1">
                                {sIdx + 1}
                              </TableCell>
                              <TableCell className="p-1 text-blue-700 font-semibold font-mono text-[11px]">
                                {st.boardingCode || "—"}
                              </TableCell>
                              <TableCell className="p-1 font-semibold text-slate-900">
                                {st.fullName}
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
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
