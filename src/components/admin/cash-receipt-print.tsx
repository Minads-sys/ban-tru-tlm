"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { formatCurrency, numberToVietnameseWords, formatDate } from "@/lib/utils";

export interface CashReceiptData {
  receiptNumber: string;
  transDate: string | Date;
  amount: number;
  customerPaid?: number;
  changeAmount?: number;
  note?: string | null;
  cashierName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  student: {
    fullName: string;
    studentCode: string; // CCCD đã che (VD: ********1234)
    boardingCode?: string | null;
    className: string;
  };
  bill?: {
    month: number;
    year: number;
  } | null;
}

interface Props {
  data: CashReceiptData;
  onClose?: () => void;
  format?: "K80" | "A5";
}

export function CashReceiptPrint({ data, onClose, format = "K80" }: Props) {
  const [printFormat, setPrintFormat] = React.useState<"K80" | "A5">(format);

  const handlePrint = () => {
    window.print();
  };

  const schoolName = data.schoolName || "TRƯỜNG BÁN TRÚ TIỂU HỌC & THCS THĂNG LONG";
  const schoolAddress = data.schoolAddress || "Hà Nội";
  const schoolPhone = data.schoolPhone || "(024) 3888.xxxx";

  const customerPaid = data.customerPaid ?? data.amount;
  const changeAmount = data.changeAmount ?? Math.max(0, customerPaid - data.amount);

  const formattedDate = new Date(data.transDate).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="bg-white text-slate-900">
      {/* Thanh điều khiển trên màn hình (Không in ra) */}
      <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Khổ in:</span>
          <div className="inline-flex rounded-md shadow-xs" role="group">
            <button
              type="button"
              onClick={() => setPrintFormat("K80")}
              className={`px-3 py-1.5 text-xs font-medium rounded-l-lg border ${
                printFormat === "K80"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              In nhiệt K80 (80mm)
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat("A5")}
              className={`px-3 py-1.5 text-xs font-medium rounded-r-lg border-t border-b border-r ${
                printFormat === "A5"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Khổ giấy A5
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <Printer className="h-4 w-4 mr-1.5" />
            In Phiếu Thu
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              <X className="h-4 w-4 mr-1" />
              Đóng
            </Button>
          )}
        </div>
      </div>

      {/* Nội dung in */}
      <div className="p-4 flex justify-center bg-slate-100 min-h-[400px]">
        {printFormat === "K80" ? (
          /* MẪU IN NHIỆT K80 (Khổ rộng 80mm) */
          <div
            id="print-receipt-k80"
            className="w-[80mm] bg-white p-4 shadow-md text-[13px] leading-tight font-sans print:shadow-none print:w-full print:p-0"
          >
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <div className="font-extrabold text-[13px] uppercase">{schoolName}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{schoolAddress}</div>
              <div className="text-[11px] text-slate-600">ĐT: {schoolPhone}</div>
              <div className="font-black text-[16px] mt-2 text-slate-900 tracking-wide">PHIẾU THU TIỀN MẶT</div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">Số: {data.receiptNumber}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{formattedDate}</div>
            </div>

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
                <span className="font-semibold text-slate-800">{data.student.boardingCode || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Mã HS (CCCD):</span>
                <span className="font-mono text-slate-700">{data.student.studentCode}</span>
              </div>
              {data.bill && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tiền ăn tháng:</span>
                  <span className="font-medium text-slate-800">
                    Tháng {String(data.bill.month).padStart(2, "0")}/{data.bill.year}
                  </span>
                </div>
              )}
              {data.note && (
                <div className="text-[11px] text-slate-600 pt-0.5 italic">
                  Ghi chú: {data.note}
                </div>
              )}
            </div>

            <div className="py-2.5 border-b border-slate-800 space-y-1.5">
              <div className="flex justify-between items-baseline text-base font-extrabold text-slate-900">
                <span>TỔNG TIỀN THU:</span>
                <span className="text-lg font-black">{formatCurrency(data.amount)}</span>
              </div>
              <div className="text-[11px] text-slate-700 italic">
                (Bằng chữ: {numberToVietnameseWords(data.amount)})
              </div>

              {customerPaid > data.amount && (
                <div className="pt-1.5 border-t border-dotted border-slate-300 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tiền khách đưa:</span>
                    <span className="font-medium">{formatCurrency(customerPaid)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Tiền thối lại:</span>
                    <span>{formatCurrency(changeAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 pb-2 flex justify-between text-center text-[11px]">
              <div className="w-1/2">
                <div className="font-bold">Người nộp tiền</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, họ tên)</div>
                <div className="h-10"></div>
              </div>
              <div className="w-1/2">
                <div className="font-bold">Người thu tiền</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, họ tên)</div>
                <div className="h-10"></div>
                <div className="font-semibold text-slate-800">{data.cashierName}</div>
              </div>
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300">
              Cảm ơn Quý Phụ huynh! Chúc các con ăn ngon miệng!
            </div>
          </div>
        ) : (
          /* MẪU IN KHỔ A5 NGANG */
          <div
            id="print-receipt-a5"
            className="w-[210mm] bg-white p-6 shadow-md text-[13px] font-sans print:shadow-none print:w-full print:p-4"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="font-extrabold text-sm uppercase text-slate-900">{schoolName}</div>
                <div className="text-xs text-slate-600">{schoolAddress} - ĐT: {schoolPhone}</div>
                <div className="text-xs text-slate-600">TỔ QUẢN LÝ BÁN TRÚ</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-700">Mẫu số: C40-BB</div>
                <div className="text-xs text-slate-500">(Ban hành theo TT của BTC)</div>
                <div className="text-xs font-bold text-blue-700 mt-1">Số: {data.receiptNumber}</div>
              </div>
            </div>

            <div className="text-center my-3">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                PHIẾU THU TIỀN MẶT
              </h1>
              <div className="text-xs text-slate-500 italic mt-0.5">{formattedDate}</div>
            </div>

            {/* Chi tiết nội dung */}
            <div className="space-y-2 text-xs py-2 border-y border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-600">Họ và tên học sinh:</span>{" "}
                  <b className="text-slate-900 uppercase">{data.student.fullName}</b>
                </div>
                <div>
                  <span className="text-slate-600">Lớp:</span>{" "}
                  <b className="text-slate-900">{data.student.className}</b>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-600">Mã Bán Trú:</span>{" "}
                  <span className="font-bold text-blue-800">{data.student.boardingCode || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-600">Mã HS (CCCD):</span>{" "}
                  <span className="font-mono text-slate-700 font-semibold">{data.student.studentCode}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-600">Nội dung thu:</span>{" "}
                <span className="font-medium text-slate-800">
                  {data.bill
                    ? `Thu tiền ăn bán trú Tháng ${String(data.bill.month).padStart(2, "0")}/${data.bill.year}`
                    : "Thu tiền ăn bán trú học sinh"}
                  {data.note ? ` (${data.note})` : ""}
                </span>
              </div>

              <div className="pt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-slate-600">Số tiền thu:</span>{" "}
                  <span className="text-lg font-black text-rose-600">{formatCurrency(data.amount)}</span>
                </div>
                <div className="text-xs italic text-slate-700">
                  (Bằng chữ: <b>{numberToVietnameseWords(data.amount)}</b>)
                </div>
              </div>
            </div>

            {/* Chữ ký */}
            <div className="grid grid-cols-3 text-center text-xs mt-6 pt-2">
              <div>
                <div className="font-bold">Người nộp tiền</div>
                <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
              </div>
              <div>
                <div className="font-bold">Kế toán / Thủ quỹ</div>
                <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
              </div>
              <div>
                <div className="font-bold">Người lập phiếu (Thu ngân)</div>
                <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-16"></div>
                <div className="font-semibold text-slate-900">{data.cashierName}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
