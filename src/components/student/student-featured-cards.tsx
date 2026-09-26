"use client";

import React from "react";
import {
  FileText,
  Megaphone,
  QrCode,
} from "lucide-react";

interface StudentFeaturedCardsProps {
  studentInfo?: {
    mealType?: "MAN" | "CHAY" | "CHAO";
    boardingStatus?: "ACTIVE" | "CANCELLED" | "SUSPENDED";
  } | null;
  bills?: Array<{
    id: string;
    month: number;
    year: number;
    scheduleMealDays: number;
    canceledDays: number;
    netPayableDays: number;
    unitPrice: string | number;
    finalAmount: string | number;
    paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "SETTLED";
  }>;
  announcement?: string;
  cutoffTime?: string;
  onAction: (actionKey: string, payload?: any) => void;
}

export function StudentFeaturedCards({
  bills = [],
  announcement,
  cutoffTime = "16:00",
  onAction,
}: StudentFeaturedCardsProps) {
  const formatMoney = (val: number | string) =>
    new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(Number(val || 0)))) + "đ";

  // Tìm hóa đơn nợ gần nhất hoặc hóa đơn mới nhất
  const latestUnpaidBill = bills.find(
    (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
  ) || bills[0];

  return (
    <div className="space-y-4">
      {/* 1. Phiếu báo tiền ăn & Hóa đơn (Chỉ hiện khi có hóa đơn) */}
      {latestUnpaidBill ? (
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/50 rounded-2xl p-4 border border-blue-200/80 shadow-xs relative">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100/90 px-2 py-0.5 rounded-md inline-block mb-1.5">
                Tiền ăn Tháng {latestUnpaidBill.month}/{latestUnpaidBill.year}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {latestUnpaidBill.netPayableDays} bữa ăn bán trú
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Đơn giá: {formatMoney(latestUnpaidBill.unitPrice)}/suất • Trừ {latestUnpaidBill.canceledDays} ngày cắt
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-slate-900 block">
                {formatMoney(latestUnpaidBill.finalAmount)}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                latestUnpaidBill.paymentStatus === "PAID" || latestUnpaidBill.paymentStatus === "SETTLED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-600 border-rose-200"
              }`}>
                {latestUnpaidBill.paymentStatus === "PAID" || latestUnpaidBill.paymentStatus === "SETTLED"
                  ? "Đã thanh toán"
                  : "Chưa thanh toán"}
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-blue-100 flex items-center gap-2">
            <button
              onClick={() => onAction("debt")}
              className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition active:scale-95 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Chi tiết phiếu</span>
            </button>
            <button
              onClick={() => onAction("debt")}
              className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Thanh toán QR</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 2. Thông báo từ Nhà trường / Quy định bán trú */}
      {announcement ? (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-2.5 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="text-xs text-slate-700 leading-relaxed min-w-0">
            <span className="font-bold text-amber-900 block mb-0.5">
              Thông báo nhà trường:
            </span>
            <span>{announcement}</span>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Megaphone className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs text-slate-600 leading-snug">
            <span className="font-bold text-slate-800">Quy định bán trú:</span> Học sinh có nhu cầu cắt suất ăn hoặc đổi món vui lòng thực hiện trước <b>{cutoffTime}</b> hàng ngày.
          </div>
        </div>
      )}
    </div>
  );
}
