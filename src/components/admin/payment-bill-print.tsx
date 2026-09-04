"use client";

import React, { useState } from "react";
import Barcode from "react-barcode";
import { Button } from "@/components/ui/button";
import { Printer, X, QrCode } from "lucide-react";
import { formatCurrency, numberToVietnameseWords, maskStudentCode } from "@/lib/utils";

export interface PaymentBillData {
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  student: {
    fullName: string;
    studentCode: string; // CCCD
    boardingCode?: string | null;
    className: string;
    mealType?: string;
  };
  bill: {
    id: string;
    month: number;
    year: number;
    finalAmount: number;
    paidAmount?: number;
    remainingDebt: number;
    scheduleMealDays?: number;
    canceledDays?: number;
    unitPrice?: number;
    previousDeduction?: number;
  };
  bankInfo?: {
    bankName?: string;
    accountNo?: string;
    accountName?: string;
  };
  qrCodeDataUrl: string;
  transferContent: string;
}

interface Props {
  data: PaymentBillData;
  onClose?: () => void;
  defaultFormat?: "K80" | "A5";
}

export function PaymentBillPrint({ data, onClose, defaultFormat = "K80" }: Props) {
  const [printFormat, setPrintFormat] = useState<"K80" | "A5">(defaultFormat);

  const handlePrint = () => {
    window.print();
  };

  const schoolName = data.schoolName || "TRƯỜNG BÁN TRÚ TIỂU HỌC & THCS THĂNG LONG";
  const schoolAddress = data.schoolAddress || "Hà Nội";
  const schoolPhone = data.schoolPhone || "(024) 3888.xxxx";

  const bankName = data.bankInfo?.bankName || "BIDV";
  const accountNo = data.bankInfo?.accountNo || "96247BANTRUTLM08";
  const accountName = data.bankInfo?.accountName || "HOANG KIM";

  const code = data.student.boardingCode || data.student.studentCode;
  const barcodeValue = `PT${String(data.bill.month).padStart(2, "0")}${String(data.bill.year).slice(-2)}${code}`;

  const mealTypeName =
    data.student.mealType === "CHAY"
      ? "Chay"
      : data.student.mealType === "CHAO"
      ? "Cháo"
      : "Mặn";

  const isPartial = (data.bill.paidAmount || 0) > 0 && data.bill.remainingDebt > 0;

  return (
    <div className="bg-white text-slate-900">
      {/* CSS In ấn theo khổ giấy */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${printFormat === "K80" ? "80mm auto" : "A5 portrait"};
                margin: ${printFormat === "K80" ? "2mm" : "6mm"};
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }
              .no-print, .no-print * {
                display: none !important;
              }
              .printable-content {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `,
        }}
      />

      {/* THANH ĐIỀU KHIỂN TRÊN MÀN HÌNH (ẨN KHI IN) */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <div className="flex items-center gap-2.5">
          <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <QrCode className="h-4 w-4 text-blue-600" />
            Khổ in phiếu:
          </span>
          <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setPrintFormat("K80")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                printFormat === "K80"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              In nhiệt K80 (80mm)
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat("A5")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                printFormat === "A5"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Khổ giấy A5
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs h-9 px-4"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            In Phiếu Thanh Toán
          </Button>
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-9 text-slate-600 hover:text-slate-900"
            >
              <X className="h-4 w-4 mr-1" />
              Đóng
            </Button>
          )}
        </div>
      </div>

      {/* VÙNG XEM TRƯỚC VÀ IN */}
      <div className="p-4 flex justify-center bg-slate-100 min-h-[420px] max-h-[78vh] overflow-y-auto">
        {printFormat === "K80" ? (
          /* ================= MẪU IN NHIỆT K80 (80mm) ================= */
          <div
            id="payment-bill-k80"
            className="printable-content w-[80mm] bg-white p-3.5 shadow-md text-[13px] leading-tight font-sans text-slate-900"
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <div className="font-extrabold text-[13px] uppercase">{schoolName}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{schoolAddress}</div>
              <div className="text-[11px] text-slate-600">Hotline: {schoolPhone}</div>
              <div className="font-black text-[15px] mt-2 text-slate-900 tracking-wide uppercase">
                PHIẾU THANH TOÁN TIỀN ĂN
              </div>
              <div className="text-[12px] font-bold text-blue-800 mt-0.5">
                Tháng {String(data.bill.month).padStart(2, "0")}/{data.bill.year}
              </div>
            </div>

            {/* Thông tin học sinh */}
            <div className="py-2.5 space-y-1 text-[12px] border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-600">Học sinh:</span>
                <span className="font-bold text-slate-900 uppercase">{data.student.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Lớp:</span>
                <span className="font-bold text-slate-900">{data.student.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Mã Bán Trú:</span>
                <span className="font-bold text-blue-700">{data.student.boardingCode || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Mã HS (CCCD):</span>
                <span className="font-mono text-slate-700">{maskStudentCode(data.student.studentCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Loại suất:</span>
                <span className="font-medium text-slate-800">{mealTypeName}</span>
              </div>

              {/* Chi tiết tính ngày ăn nếu có */}
              {data.bill.scheduleMealDays !== undefined && data.bill.scheduleMealDays > 0 && (
                <div className="pt-1.5 border-t border-dotted border-slate-300 text-[11px] space-y-0.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Số ngày ăn dự kiến:</span>
                    <span className="font-semibold text-slate-900">{data.bill.scheduleMealDays} ngày</span>
                  </div>
                  {data.bill.canceledDays !== undefined && data.bill.canceledDays > 0 && (
                    <div className="flex justify-between">
                      <span>Số ngày cắt suất:</span>
                      <span className="font-semibold text-slate-900">{data.bill.canceledDays} ngày</span>
                    </div>
                  )}
                  {data.bill.previousDeduction !== undefined && data.bill.previousDeduction > 0 && (
                    <div className="flex justify-between">
                      <span>Trừ tiền tháng trước:</span>
                      <span className="font-semibold text-slate-900">
                        -{formatCurrency(data.bill.previousDeduction)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Khung số tiền thanh toán */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1">
              {isPartial && (
                <div className="text-[11px] text-slate-600 space-y-0.5 pb-1 border-b border-dotted border-slate-300">
                  <div className="flex justify-between">
                    <span>Tổng hóa đơn:</span>
                    <span>{formatCurrency(data.bill.finalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Đã nộp:</span>
                    <span>-{formatCurrency(data.bill.paidAmount || 0)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1">
                <span className="font-extrabold text-slate-900 text-xs uppercase">
                  {isPartial ? "SỐ TIỀN CÒN NỢ:" : "SỐ TIỀN CẦN NỘP:"}
                </span>
                <span className="text-base font-black text-rose-700">
                  {formatCurrency(data.bill.remainingDebt)}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 italic leading-snug">
                (Bằng chữ: {numberToVietnameseWords(data.bill.remainingDebt)})
              </div>
            </div>

            {/* MÃ VIETQR THANH TOÁN */}
            <div className="py-3 text-center space-y-2">
              <div className="font-extrabold text-[12px] text-blue-900 uppercase tracking-wide">
                QUÉT MÃ VIETQR ĐỂ THANH TOÁN
              </div>

              {/* Ảnh mã VietQR động */}
              {data.qrCodeDataUrl && (
                <div className="flex justify-center p-1 bg-white inline-block rounded border border-slate-300">
                  <img
                    src={data.qrCodeDataUrl}
                    alt="VietQR Code"
                    className="w-[45mm] h-[45mm] object-contain mx-auto"
                  />
                </div>
              )}

              {/* Cú pháp chuyển khoản */}
              <div className="bg-slate-50 p-2 rounded border border-slate-300 text-left text-[11px] space-y-1">
                <div>
                  <span className="text-slate-500 block text-[10px]">Nội dung chuyển khoản (bắt buộc):</span>
                  <span className="font-mono font-black text-[12px] text-blue-900 block tracking-wide">
                    {data.transferContent}
                  </span>
                </div>
                <div className="pt-1 border-t border-slate-200 flex justify-between text-[10.5px]">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold text-slate-800">{bankName}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <span className="font-mono font-bold text-slate-800">{accountNo}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800">{accountName}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 italic leading-tight pt-1">
                * Quét bằng bất kỳ App Ngân hàng nào. Hệ thống tự động gạch nợ sau 1-3 giây!
              </p>
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300">
              Vui lòng giữ lại phiếu để đối chiếu. Cảm ơn Quý Phụ huynh!
            </div>
          </div>
        ) : (
          /* ================= MẪU IN KHỔ A5 ĐỨNG ================= */
          <div
            id="payment-bill-a5"
            className="printable-content w-[148mm] bg-white p-5 shadow-md text-[12px] font-sans text-slate-900 border border-slate-200"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Header Trường & Barcode */}
            <div className="flex justify-between items-start border-b-[1.5px] border-black pb-2">
              <div className="pr-2">
                <h1 className="text-[14px] font-bold uppercase leading-tight">{schoolName}</h1>
                <p className="text-[11px] text-slate-700 mt-0.5">{schoolAddress}</p>
                <p className="text-[11px] text-slate-700">ĐT: {schoolPhone} - TỔ QUẢN LÝ BÁN TRÚ</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <Barcode
                  value={barcodeValue}
                  height={28}
                  width={1.1}
                  fontSize={9}
                  margin={0}
                  displayValue={true}
                />
              </div>
            </div>

            {/* Tiêu đề phiếu */}
            <div className="text-center my-2">
              <h2 className="text-[16px] font-bold uppercase tracking-wide">
                PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ
              </h2>
              <p className="text-[12px] italic">
                Tháng {data.bill.month} / {data.bill.year}
              </p>
            </div>

            {/* Chi tiết học sinh & suất ăn */}
            <div className="border-t-[1.5px] border-b-[1.5px] border-black py-2 my-1 text-[12px] leading-relaxed">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className="space-y-1">
                  <p className="flex">
                    <span className="font-bold w-24 shrink-0">Mã Bán Trú:</span>
                    <span className="font-bold text-blue-900">{data.student.boardingCode || "Chưa cấp"}</span>
                  </p>
                  <p className="flex">
                    <span className="font-bold w-24 shrink-0">Họ và tên:</span>
                    <span className="font-bold uppercase">{data.student.fullName}</span>
                  </p>
                  <p className="flex">
                    <span className="font-bold w-24 shrink-0">Lớp học:</span>
                    <span className="font-semibold">{data.student.className}</span>
                  </p>
                  <p className="flex">
                    <span className="font-bold w-24 shrink-0">Mã HS (CCCD):</span>
                    <span className="font-mono">{maskStudentCode(data.student.studentCode)}</span>
                  </p>
                  <p className="flex">
                    <span className="font-bold w-24 shrink-0">Loại suất:</span>
                    <span>{mealTypeName}</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="flex">
                    <span className="font-bold w-36 shrink-0">Số ngày ăn dự kiến:</span>
                    <span>{data.bill.scheduleMealDays || 0} ngày</span>
                  </p>
                  <p className="flex">
                    <span className="font-bold w-36 shrink-0">Số ngày cắt suất:</span>
                    <span>{data.bill.canceledDays || 0} ngày</span>
                  </p>
                  <div className="flex">
                    <span className="font-bold w-36 shrink-0">Trừ tiền tháng trước:</span>
                    <div className="flex flex-col">
                      <span>{formatCurrency(data.bill.previousDeduction || 0)}</span>
                      <span className="text-[10px] italic text-slate-600">
                        (Hủy suất ăn của tháng {data.bill.month === 1 ? 12 : data.bill.month - 1}/
                        {data.bill.month === 1 ? data.bill.year - 1 : data.bill.year})
                      </span>
                    </div>
                  </div>
                  <p className="flex">
                    <span className="font-bold w-36 shrink-0">Đơn giá:</span>
                    <span>{formatCurrency(data.bill.unitPrice || 35000)}/suất</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Khung số tiền nộp */}
            <div className="border-[1.5px] border-black p-2 my-2 text-center bg-slate-50/50">
              {isPartial && (
                <div className="text-[11px] text-slate-700 mb-0.5">
                  Tổng hóa đơn: {formatCurrency(data.bill.finalAmount)} | Đã nộp:{" "}
                  <span className="text-emerald-700 font-bold">{formatCurrency(data.bill.paidAmount || 0)}</span>
                </div>
              )}
              <p className="text-[15px] font-extrabold uppercase">
                {isPartial ? "SỐ TIỀN CÒN NỢ CẦN NỘP:" : "SỐ TIỀN CẦN NỘP:"}{" "}
                <span className="text-rose-700">{formatCurrency(data.bill.remainingDebt)}</span>
              </p>
              <p className="text-[11px] italic mt-0.5">
                (Bằng chữ: {numberToVietnameseWords(data.bill.remainingDebt)})
              </p>
            </div>

            {/* Khung VietQR và hướng dẫn */}
            <div className="border-[1.5px] border-dashed border-black p-2.5 flex items-center gap-3">
              {data.qrCodeDataUrl && (
                <div className="shrink-0 border border-black p-1 bg-white">
                  <img
                    src={data.qrCodeDataUrl}
                    alt="Mã QR thanh toán"
                    className="w-[110px] h-[110px] object-contain"
                  />
                </div>
              )}

              <div className="flex-1 text-[11px] space-y-1">
                <p className="font-bold text-[12px] uppercase">
                  1. Quét mã QR để thanh toán (Khuyến khích)
                </p>
                <p className="text-[10.5px]">
                  2. Hoặc chuyển khoản thủ công và <b>BẮT BUỘC</b> nhập đúng nội dung sau:
                </p>
                <div className="inline-block px-2.5 py-1 border-[1.5px] border-black bg-slate-100 font-mono font-bold text-[13px]">
                  {data.transferContent}
                </div>
                <div className="text-[10px] text-slate-700 pt-0.5 flex gap-3">
                  <span>STK: <b>{accountNo}</b> ({bankName})</span>
                  <span>Chủ TK: <b>{accountName}</b></span>
                </div>
                <p className="text-[10px] italic text-slate-600">
                  * Hệ thống tự động gạch nợ sau 1-3 giây khi nhận được tiền.
                </p>
              </div>
            </div>

            {/* Chữ ký chân trang */}
            <div className="grid grid-cols-2 text-center text-[11px] mt-4 pt-1">
              <div>
                <div className="font-bold">Người nộp tiền</div>
                <div className="text-[10px] italic text-slate-500">(Ký, họ tên)</div>
              </div>
              <div>
                <div className="font-bold">Người lập phiếu (Thu ngân)</div>
                <div className="text-[10px] italic text-slate-500">(Ký, họ tên)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
