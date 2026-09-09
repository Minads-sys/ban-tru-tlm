'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Layers, Utensils, Users, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { DiningAllocationResult } from '@/lib/dining-court-service';
import Swal from 'sweetalert2';

interface DiningCourtSummaryPrintProps {
  data: DiningAllocationResult;
  schoolName?: string;
  onClose?: () => void;
}

export function DiningCourtSummaryPrint({
  data,
  schoolName = 'TRƯỜNG TIỂU HỌC BÁN TRÚ',
  onClose,
}: DiningCourtSummaryPrintProps) {
  const [activeShiftFilter, setActiveShiftFilter] = useState<'ALL' | 'TIET_4' | 'TIET_5'>('ALL');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handlePrint = () => {
    document.body.classList.add('printing-modal-open');
    const cleanup = () => {
      document.body.classList.remove('printing-modal-open');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const url = `/api/dining-areas/export-pdf?date=${data.date}&shift=${activeShiftFilter}&type=summary`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Lỗi khi tải file PDF');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanDate = data.date.replace(/-/g, '');
      const shiftSuffix = activeShiftFilter === 'TIET_4' ? 'Tiet_4' : activeShiftFilter === 'TIET_5' ? 'Tiet_5' : 'Tat_Ca';
      a.download = `Bang_Tap_Ket_Suat_An_San_${shiftSuffix}_${cleanDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Giữ blob trong 60 giây để trình duyệt hoàn tất quá trình ghi file xuống ổ đĩa, tránh lỗi "Cần có quyền để tải xuống"
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
        title: 'Đã tạo lệnh tải bảng tập kết PDF',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Download summary PDF error:', error);
      Swal.fire('Lỗi', error instanceof Error ? error.message : 'Không thể xuất file PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenPdfNewTab = () => {
    const url = `/api/dining-areas/export-pdf?date=${data.date}&shift=${activeShiftFilter}&type=summary&view=1`;
    window.open(url, '_blank');
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  // Tính toán số liệu tổng
  const tiet4Courts = data.shifts.TIET_4.courts;
  const tiet5Courts = data.shifts.TIET_5.courts;

  const tiet4Man = tiet4Courts.reduce((acc, c) => acc + c.manCount, 0);
  const tiet4Chay = tiet4Courts.reduce((acc, c) => acc + c.chayCount, 0);
  const tiet4Chao = tiet4Courts.reduce((acc, c) => acc + c.chaoCount, 0);

  const tiet5Man = tiet5Courts.reduce((acc, c) => acc + c.manCount, 0);
  const tiet5Chay = tiet5Courts.reduce((acc, c) => acc + c.chayCount, 0);
  const tiet5Chao = tiet5Courts.reduce((acc, c) => acc + c.chaoCount, 0);

  const totalMan = tiet4Man + tiet5Man;
  const totalChay = tiet4Chay + tiet5Chay;
  const totalChao = tiet4Chao + tiet5Chao;

  const showTiet4 = activeShiftFilter === 'ALL' || activeShiftFilter === 'TIET_4';
  const showTiet5 = activeShiftFilter === 'ALL' || activeShiftFilter === 'TIET_5';

  // Tính toán gộp hàng (rowSpan) cho cột Xe cơm: 1 xe chứa 2 sân liền kề
  const getCartSpanInfo = (courts: typeof tiet4Courts, index: number) => {
    const current = courts[index];
    if (index > 0 && courts[index - 1].cartNumber === current.cartNumber) {
      return { render: false, rowSpan: 1 };
    }
    const isSharedWithNext =
      index + 1 < courts.length && courts[index + 1].cartNumber === current.cartNumber;
    return { render: true, rowSpan: isSharedWithNext ? 2 : 1 };
  };

  return (
    <div className="flex flex-col h-full max-h-[92vh] bg-slate-100 text-slate-900 rounded-lg overflow-hidden print:h-auto print:max-h-none print:overflow-visible print:bg-white print:rounded-none print:shadow-none">
      {/* CSS in ấn chuẩn khổ A4 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
              }
              /* Ẩn triệt để toàn bộ phần giao diện nền phía dưới Modal khi in để không bao giờ bị dư trang trắng ở trên */
              body > *:not(:has([role="dialog"])),
              #admin-main-layout {
                display: none !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
              }
              /* Loại bỏ margin/padding của thẻ wrapper chứa Dialog */
              body > div:has([role="dialog"]) {
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                height: auto !important;
                min-height: 0 !important;
              }
              .no-print,
              .no-print *,
              [data-radix-dialog-overlay],
              div[data-state][class*="bg-black"],
              div[class*="bg-black/"] {
                display: none !important;
                opacity: 0 !important;
                background: transparent !important;
              }
              /* Căn chỉnh lại Dialog khi in ấn bắt đầu ngay đỉnh trang 1 */
              [role="dialog"] {
                position: static !important;
                transform: none !important;
                left: auto !important;
                top: auto !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
                overflow: visible !important;
              }
              .printable-court-summary {
                display: block !important;
                position: static !important;
                left: auto !important;
                top: auto !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                color: #000000 !important;
                min-height: 0 !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `,
        }}
      />

      {/* THANH ĐIỀU KHIỂN TRÊN MÀN HÌNH (ẨN KHI IN) */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:pr-12 py-3 bg-white border-b border-slate-200 shrink-0">
        {/* Bộ lọc chọn ca */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Phạm vi in:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setActiveShiftFilter('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeShiftFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Cả ngày (Tiết 4 + 5)
            </button>
            <button
              type="button"
              onClick={() => setActiveShiftFilter('TIET_4')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeShiftFilter === 'TIET_4'
                  ? 'bg-orange-600 text-white shadow-xs font-semibold'
                  : 'text-orange-800 hover:text-orange-950 hover:bg-orange-100/60'
              }`}
            >
              Chỉ Tiết 4 ({tiet4Courts.length} sân)
            </button>
            <button
              type="button"
              onClick={() => setActiveShiftFilter('TIET_5')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeShiftFilter === 'TIET_5'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-indigo-900 hover:text-indigo-950 hover:bg-indigo-100/60'
              }`}
            >
              Chỉ Tiết 5 ({tiet5Courts.length} sân)
            </button>
          </div>
        </div>

        {/* Các nút hành động */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-xs font-semibold cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>In danh sách</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenPdfNewTab}
            className="text-xs border-slate-300 gap-1.5 hover:bg-slate-50 cursor-pointer font-medium text-slate-700"
            title="Mở tài liệu PDF trong tab mới để xem, in hoặc lưu"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
            <span>Mở xem PDF</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="text-xs border-slate-300 gap-1.5 hover:bg-slate-50 cursor-pointer font-medium"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>{isExportingPdf ? 'Đang tạo PDF...' : 'Tải file PDF'}</span>
          </Button>
        </div>
      </div>

      {/* KHUNG XEM TRƯỚC BẢN IN (CHUẨN KHỔ A4) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-200/70 print:p-0 print:m-0 print:overflow-visible print:bg-white print:block">
        <div
          id="print-court-summary"
          className="printable-court-summary w-full max-w-[210mm] min-h-[297mm] bg-white p-8 sm:p-10 shadow-lg text-slate-900 text-[13px] leading-normal print:p-0 print:m-0 print:shadow-none print:border-none print:w-full print:max-w-none print:min-h-0"
        >
          {/* 1. Header Văn bản */}
          <div className="flex justify-between items-start pb-3 border-b-2 border-slate-800">
            <div>
              <div className="font-extrabold text-[12px] uppercase tracking-wide text-slate-900">
                {schoolName}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mt-0.5">
                BỘ PHẬN NHÀ BẾP & QUẢN LÝ BÁN TRÚ
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">
                Ngày ăn: <span className="text-blue-700">{formatDateDisplay(data.date)}</span> ({data.dayOfWeekName})
              </div>
              <div className="text-[11px] font-semibold mt-0.5">
                {data.isAfterLockTime ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ ĐÃ CHỐT SỐ BÁO BẾP
                  </span>
                ) : (
                  <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                    ⚠ SỐ LIỆU TẠM (CHƯA CHỐT)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Tiêu đề chính */}
          <div className="text-center my-4">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900">
              BẢNG TẬP KẾT SUẤT ĂN THEO SÂN BÁN TRÚ
            </h1>
            <p className="text-xs text-slate-600 italic mt-1">
              (Dùng cho nhân viên bếp tập kết khay ăn và giáo viên nhận bàn giao tại từng sân)
            </p>
          </div>

          {/* 3. Khung Thống kê Toàn trường */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 text-xs">
              <div className="font-bold text-slate-900">
                TỔNG CỘNG TOÀN TRƯỜNG:{' '}
                <span className="text-blue-700 font-extrabold text-sm">
                  {data.totalCourts} SÂN ({data.totalCarts || Math.ceil(data.totalCourts / 2)} XE CƠM)
                </span>
                <span className="mx-2 text-slate-400">|</span>
                <span className="text-blue-700 font-extrabold text-sm">{data.totalMeals} SUẤT ĂN</span>
              </div>
              <div className="text-slate-700 font-medium text-[12px]">
                (Mặn: <span className="font-bold text-slate-900">{totalMan}</span> | Chay:{' '}
                <span className="font-bold text-emerald-700">{totalChay}</span> | Cháo:{' '}
                <span className="font-bold text-amber-700">{totalChao}</span>)
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center pt-2 text-[12px]">
              <div className="font-semibold text-orange-800">
                • Tiết 4 (Ăn ca 1): {data.shifts.TIET_4.totalCourts} sân —{' '}
                <span className="font-bold">{data.shifts.TIET_4.totalMeals} suất</span>
              </div>
              <div className="font-semibold text-indigo-800">
                • Tiết 5 (Ăn ca 2): {data.shifts.TIET_5.totalCourts} sân —{' '}
                <span className="font-bold">{data.shifts.TIET_5.totalMeals} suất</span>
              </div>
            </div>
          </div>

          {/* 4. MỤC I - SÂN TIẾT 4 */}
          {showTiet4 && (
            <div className="mb-6">
              {/* Tiêu đề mục I */}
              <div className="bg-orange-600 text-white font-bold px-3 py-1.5 rounded-t-md text-xs sm:text-sm flex flex-wrap justify-between items-center tracking-wide">
                <span>I - SÂN TIẾT 4 (ĂN CA 1 - 10H45)</span>
                <span className="text-[11px] font-medium opacity-95">
                  Tổng: {tiet4Courts.length} sân / {data.shifts.TIET_4.totalMeals} suất (Mặn: {tiet4Man} | Chay:{' '}
                  {tiet4Chay} | Cháo: {tiet4Chao})
                </span>
              </div>

              {tiet4Courts.length === 0 ? (
                <div className="p-3 bg-orange-50/50 border border-orange-200 border-t-0 rounded-b-md text-xs italic text-slate-500">
                  Không có lớp nào ăn bán trú Tiết 4.
                </div>
              ) : (
                /* Bảng kẻ ô chi tiết bàn giao */
                <div className="overflow-x-auto border border-slate-300 border-t-0 rounded-b-md">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-orange-100 text-slate-800 font-bold border-b border-slate-300">
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-14">Xe</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Sân</th>
                        <th className="py-2 px-2 border-r border-slate-300">Các lớp tại sân</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-20">Tổng suất</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Mặn</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Chay</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Cháo</th>
                        <th className="py-2 px-2 text-center w-28">Ký nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {tiet4Courts.map((court, idx) => {
                        const classDetail = court.classes
                          .map((c) => `${c.className} (${c.totalMeals} suất)`)
                          .join(' + ');
                        const cartInfo = getCartSpanInfo(tiet4Courts, idx);

                        return (
                          <tr key={`t4-row-${court.courtNumber}`} className="hover:bg-slate-50">
                            {cartInfo.render && (
                              <td
                                rowSpan={cartInfo.rowSpan}
                                className="py-2 px-1 text-center font-bold text-slate-800 bg-orange-50/40 border-r border-slate-300 align-middle"
                              >
                                {court.cartName || `Xe ${court.cartNumber}`}
                              </td>
                            )}
                            <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200">
                              {court.courtName}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200">
                              <div className="font-bold text-slate-900">
                                {court.classes.map((c) => c.className).join(' + ')}
                              </div>
                              <div className="text-[11px] text-slate-500 italic mt-0.5">{classDetail}</div>
                            </td>
                            <td className="py-2 px-2 text-center font-extrabold text-orange-700 text-sm border-r border-slate-200">
                              {court.totalMeals}
                            </td>
                            <td className="py-2 px-2 text-center font-semibold text-slate-800 border-r border-slate-200">
                              {court.manCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-700 border-r border-slate-200">
                              {court.chayCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200">
                              {court.chaoCount}
                            </td>
                            <td className="py-2 px-2 text-center text-[11px] text-slate-400">
                              [ &nbsp; ] ................
                            </td>
                          </tr>
                        );
                      })}
                      {/* Dòng tổng Tiết 4 */}
                      <tr className="bg-amber-50 font-bold border-t-2 border-slate-300">
                        <td colSpan={3} className="py-2 px-3 text-center border-r border-slate-300">
                          TỔNG CỘNG TIẾT 4 ({tiet4Courts.length} sân)
                        </td>
                        <td className="py-2 px-2 text-center font-black text-orange-800 text-sm border-r border-slate-300">
                          {data.shifts.TIET_4.totalMeals}
                        </td>
                        <td className="py-2 px-2 text-center font-bold border-r border-slate-300">
                          {tiet4Man}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-800 border-r border-slate-300">
                          {tiet4Chay}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-amber-800 border-r border-slate-300">
                          {tiet4Chao}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 font-normal text-[11px]">
                          Đã giao đủ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. MỤC II - SÂN TIẾT 5 */}
          {showTiet5 && (
            <div className="mb-6">
              {/* Tiêu đề mục II */}
              <div className="bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-t-md text-xs sm:text-sm flex flex-wrap justify-between items-center tracking-wide">
                <span>II - SÂN TIẾT 5 (ĂN CA 2 - 11H35)</span>
                <span className="text-[11px] font-medium opacity-95">
                  Tổng: {tiet5Courts.length} sân / {data.shifts.TIET_5.totalMeals} suất (Mặn: {tiet5Man} | Chay:{' '}
                  {tiet5Chay} | Cháo: {tiet5Chao})
                </span>
              </div>

              {tiet5Courts.length === 0 ? (
                <div className="p-3 bg-indigo-50/50 border border-indigo-200 border-t-0 rounded-b-md text-xs italic text-slate-500">
                  Không có lớp nào ăn bán trú Tiết 5.
                </div>
              ) : (
                /* Bảng kẻ ô chi tiết bàn giao */
                <div className="overflow-x-auto border border-slate-300 border-t-0 rounded-b-md">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-100 text-slate-800 font-bold border-b border-slate-300">
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-14">Xe</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Sân</th>
                        <th className="py-2 px-2 border-r border-slate-300">Các lớp tại sân</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-20">Tổng suất</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Mặn</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Chay</th>
                        <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Cháo</th>
                        <th className="py-2 px-2 text-center w-28">Ký nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {tiet5Courts.map((court, idx) => {
                        const classDetail = court.classes
                          .map((c) => `${c.className} (${c.totalMeals} suất)`)
                          .join(' + ');
                        const cartInfo = getCartSpanInfo(tiet5Courts, idx);

                        return (
                          <tr key={`t5-row-${court.courtNumber}`} className="hover:bg-slate-50">
                            {cartInfo.render && (
                              <td
                                rowSpan={cartInfo.rowSpan}
                                className="py-2 px-1 text-center font-bold text-slate-800 bg-indigo-50/40 border-r border-slate-300 align-middle"
                              >
                                {court.cartName || `Xe ${court.cartNumber}`}
                              </td>
                            )}
                            <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200">
                              {court.courtName}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200">
                              <div className="font-bold text-slate-900">
                                {court.classes.map((c) => c.className).join(' + ')}
                              </div>
                              <div className="text-[11px] text-slate-500 italic mt-0.5">{classDetail}</div>
                            </td>
                            <td className="py-2 px-2 text-center font-extrabold text-indigo-700 text-sm border-r border-slate-200">
                              {court.totalMeals}
                            </td>
                            <td className="py-2 px-2 text-center font-semibold text-slate-800 border-r border-slate-200">
                              {court.manCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-700 border-r border-slate-200">
                              {court.chayCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200">
                              {court.chaoCount}
                            </td>
                            <td className="py-2 px-2 text-center text-[11px] text-slate-400">
                              [ &nbsp; ] ................
                            </td>
                          </tr>
                        );
                      })}
                      {/* Dòng tổng Tiết 5 */}
                      <tr className="bg-indigo-50 font-bold border-t-2 border-slate-300">
                        <td colSpan={3} className="py-2 px-3 text-center border-r border-slate-300">
                          TỔNG CỘNG TIẾT 5 ({tiet5Courts.length} sân)
                        </td>
                        <td className="py-2 px-2 text-center font-black text-indigo-800 text-sm border-r border-slate-300">
                          {data.shifts.TIET_5.totalMeals}
                        </td>
                        <td className="py-2 px-2 text-center font-bold border-r border-slate-300">
                          {tiet5Man}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-800 border-r border-slate-300">
                          {tiet5Chay}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-amber-800 border-r border-slate-300">
                          {tiet5Chao}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 font-normal text-[11px]">
                          Đã giao đủ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 6. Ghi chú phân công & Chữ ký bàn giao */}
          <div className="mt-4 pt-3 border-t border-slate-200 print:break-inside-avoid">
            <p className="text-[11px] text-slate-600 italic mb-6 leading-relaxed">
              * <strong>Lưu ý nhiệm vụ:</strong> Nhân viên phụ trách nhà bếp tập kết đúng và đủ số suất ăn (Mặn / Chay / Cháo)
              đến từng vị trí sân trước giờ ăn (Tiết 4 lúc 10g30, Tiết 5 lúc 11g20). Giáo viên trực sân kiểm tra số lượng,
              ký xác nhận và phân chia cho học sinh.
            </p>

            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="font-bold text-slate-900">Người lập bảng</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
                <div className="border-b border-dotted border-slate-400 w-32 mx-auto"></div>
              </div>

              <div>
                <div className="font-bold text-slate-900">Nhân viên bếp giao cơm</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
                <div className="border-b border-dotted border-slate-400 w-32 mx-auto"></div>
              </div>

              <div>
                <div className="font-bold text-slate-900">Quản trị / GV trực nhận</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
                <div className="border-b border-dotted border-slate-400 w-32 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
