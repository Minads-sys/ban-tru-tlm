"use client";

import React from "react";
import {
  Utensils,
  MapPin,
  Truck,
  Sparkles,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

interface StudentTodayMealCardProps {
  studentInfo?: {
    mealType?: "MAN" | "CHAY" | "CHAO";
    boardingStatus?: "ACTIVE" | "CANCELLED" | "SUSPENDED";
    classId?: string;
    class?: {
      name?: string;
    };
  } | null;
  todayInfo?: {
    hasMeal?: boolean;
    dowName?: string;
    dateStr?: string;
    court?: {
      courtNumber?: number;
      courtName?: string;
      cartNumber?: number;
      cartName?: string;
    } | null;
    shiftName?: string;
    mealTypeName?: string;
    isMealOverridden?: boolean;
    cancellation?: {
      status: "APPROVED" | "PENDING" | "REJECTED";
      cancellationNote?: string;
    } | null;
    scheduleName?: string;
  } | null;
  onAction: (actionKey: string, payload?: any) => void;
}

export function StudentTodayMealCard({
  studentInfo,
  todayInfo,
  onAction,
}: StudentTodayMealCardProps) {
  const getMealTypeName = (type?: string) => {
    if (type === "MAN") return "Cơm Mặn";
    if (type === "CHAY") return "Cơm Chay";
    if (type === "CHAO") return "Cháo";
    return "Cơm Mặn";
  };

  const dayOfWeekNames = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];

  const today = new Date();
  const isSunday = today.getDay() === 0;
  const todayLabel = `${todayInfo?.dowName || dayOfWeekNames[today.getDay()]}, ${String(
    today.getDate()
  ).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  // Kiểm tra xem hôm nay có suất ăn bán trú hay không
  // Nếu todayInfo có hasMeal === false hoặc hôm nay là Chủ nhật và không có lịch đặc biệt
  const hasMealToday = todayInfo ? todayInfo.hasMeal !== false : !isSunday;

  // Tính sân ăn và xe phục vụ theo chuẩn hệ thống Ten Lơ Man (Sân 1, Sân 2... Xe 1, Xe 2...)
  const getCourtAndCart = () => {
    // 1. Đã có phân bổ cụ thể trong hệ thống
    if (todayInfo?.court?.courtName) {
      const cName = todayInfo.court.courtName;
      const cNum = todayInfo.court.courtNumber || 1;
      const cartN = todayInfo.court.cartName || `Xe ${Math.ceil(cNum / 2)}`;
      return {
        courtName: cName,
        cartName: cartN,
        hasCourt: true,
      };
    }

    // 2. Hôm nay không có suất ăn (VD: Chủ nhật, ngày nghỉ)
    if (!hasMealToday) {
      return {
        courtName: "Chưa có lịch",
        cartName: "Không phục vụ",
        hasCourt: false,
      };
    }

    // 3. Có lịch ăn hôm nay nhưng chưa có bản ghi chia sân thủ công trong CSDL:
    // Tự động phân bổ sân chuẩn theo lớp của học sinh (VD: 10A1 -> Sân 1, Xe 1; 12A1 -> Sân 1, Xe 1...)
    const className = studentInfo?.class?.name || studentInfo?.classId || "12A1";
    const classNumMatch = className.match(/\d+$/);
    const classNum = classNumMatch ? parseInt(classNumMatch[0], 10) : 1;
    const courtNumber = Math.max(1, Math.ceil(classNum / 2));
    const cartNumber = Math.max(1, Math.ceil(courtNumber / 2));

    return {
      courtName: `Sân ${courtNumber}`,
      cartName: `Xe ${cartNumber}`,
      hasCourt: true,
    };
  };

  const { courtName, cartName, hasCourt } = getCourtAndCart();

  const todayMealName = hasMealToday
    ? todayInfo?.mealTypeName || getMealTypeName(studentInfo?.mealType)
    : "Không có suất ăn hôm nay";

  const todayShift = hasMealToday
    ? todayInfo?.shiftName || "Ca Tiết 5 (11:00 - 11:45)"
    : "Nghỉ cuối tuần";

  const isTodayCancelled = !!todayInfo?.cancellation;
  const isTodayOverridden = !!todayInfo?.isMealOverridden;

  return (
    <div className="bg-gradient-to-br from-white via-slate-50 to-purple-50/40 rounded-2xl p-4 border border-purple-200/90 shadow-sm relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Hôm nay */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
            <Sparkles className="h-3 w-3 text-amber-300" />
            HÔM NAY
          </span>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Utensils className="h-4 w-4 text-purple-600" />
            <span>Suất ăn & Vị trí ăn</span>
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {todayLabel}
        </span>
      </div>

      {/* Khối NỔI BẬT SÂN ĂN & XE */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* Box 1: SÂN ĂN */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-xl p-3 shadow-md flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            <MapPin className="h-5 w-5 text-amber-300 drop-shadow-xs" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider block">
              SÂN ĂN
            </span>
            <span className="text-sm sm:text-base font-black text-white block truncate drop-shadow-xs">
              {courtName}
            </span>
          </div>
        </div>

        {/* Box 2: XE PHỤC VỤ (XE CƠM) */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white rounded-xl p-3 shadow-md flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            <Truck className="h-5 w-5 text-white drop-shadow-xs" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-amber-100 tracking-wider block">
              XE PHỤC VỤ
            </span>
            <span className="text-sm sm:text-base font-black text-white block truncate drop-shadow-xs">
              {cartName}
            </span>
          </div>
        </div>
      </div>

      {/* Chi tiết ca ăn & món ăn */}
      <div className="bg-white/90 rounded-xl p-3 border border-purple-100/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-800 truncate">
              Món: <span className="text-purple-700 font-extrabold">{todayMealName}</span>
              {isTodayOverridden && hasMealToday && (
                <span className="ml-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Đã đổi món
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium shrink-0">
            {todayShift}
          </span>
        </div>

        <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600">
            {!hasMealToday ? (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                <Clock className="h-3 w-3 text-slate-400" />
                Hôm nay không có lịch ăn bán trú
              </span>
            ) : isTodayCancelled ? (
              <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <AlertCircle className="h-3 w-3" />
                Đã báo nghỉ cắt suất
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="h-3 w-3" />
                Sẵn sàng phục vụ trưa nay
              </span>
            )}
          </div>

          <button
            onClick={() => onAction("schedule")}
            className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Xem sơ đồ sân</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
