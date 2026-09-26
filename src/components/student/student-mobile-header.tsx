"use client";

import React from "react";
import {
  Menu,
  Search,
  Bell,
  GraduationCap,
  ChevronRight,
  QrCode,
  Utensils,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export interface StudentThemeConfig {
  theme: "red_star" | "tet_spring" | "back_to_school" | "default_tenloman" | "custom" | string;
  bannerUrl?: string;
  motto?: string;
  announcement?: string;
  schoolName?: string;
}

interface StudentMobileHeaderProps {
  user?: {
    name?: string | null;
    username?: string | null;
    studentCode?: string | null;
  };
  studentInfo?: {
    studentCode?: string;
    boardingCode?: string | null;
    mealType?: "MAN" | "CHAY" | "CHAO";
    boardingStatus?: "ACTIVE" | "CANCELLED" | "SUSPENDED";
    user?: { fullName?: string };
    class?: { name?: string };
    classId?: string;
  } | null;
  themeConfig?: StudentThemeConfig;
  unpaidAmount?: number;
  unreadCount?: number;
  onTabChange?: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
  onOpenProfile?: () => void;
}

export function StudentMobileHeader({
  user,
  studentInfo,
  themeConfig = {
    theme: "red_star",
    schoolName: "Trường THPT Ten Lơ Man",
    motto: "Nhiệt liệt chào mừng năm học mới",
  },
  unpaidAmount = 0,
  unreadCount = 0,
  onTabChange,
  onOpenSearch,
  onOpenMenu,
  onOpenProfile,
}: StudentMobileHeaderProps) {
  const studentName =
    studentInfo?.user?.fullName || user?.name || "Nguyễn Bảo Khánh";
  const studentClass =
    studentInfo?.class?.name || studentInfo?.classId || "12A1";
  const studentCode =
    studentInfo?.studentCode || user?.studentCode || "20261102";
  const schoolName = themeConfig.schoolName || "Trường THPT Ten Lơ Man";

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(val))) + "đ";

  const getMealTypeName = (type?: string) => {
    if (type === "MAN") return "Cơm mặn";
    if (type === "CHAY") return "Cơm chay";
    if (type === "CHAO") return "Cháo";
    return "Cơm mặn";
  };

  // Determine Background Style based on theme
  const getBannerBackgroundClass = () => {
    switch (themeConfig.theme) {
      case "tet_spring":
        return "bg-gradient-to-br from-amber-600 via-rose-600 to-red-800";
      case "back_to_school":
        return "bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900";
      case "default_tenloman":
        return "bg-gradient-to-br from-sky-600 via-blue-700 to-slate-900";
      case "custom":
        return "bg-gradient-to-br from-slate-800 to-slate-950";
      case "red_star":
      default:
        // Deep celebratory national red gradient matching reference
        return "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-600 via-red-700 to-[#600202]";
    }
  };

  return (
    <div className={`relative w-full text-white pt-3 pb-8 sm:pb-10 transition-all overflow-hidden ${getBannerBackgroundClass()}`}>
      
      {/* Custom Uploaded Background Image if present */}
      {themeConfig.bannerUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-45 mix-blend-luminosity"
          style={{ backgroundImage: `url(${themeConfig.bannerUrl})` }}
        />
      ) : null}

      {/* Decorative Vector Overlays: 3D Gold Star & Curved Light Ribbons */}
      {themeConfig.theme === "red_star" && !themeConfig.bannerUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {/* Radial Light Rays */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-b from-amber-400/25 via-red-500/10 to-transparent blur-2xl rounded-full" />
          
          {/* Flowing Ribbons SVG */}
          <svg
            className="absolute inset-0 w-full h-full opacity-50 mix-blend-screen"
            viewBox="0 0 400 300"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M-50 160 C90 50, 220 220, 450 70"
              stroke="rgba(255,215,0,0.35)"
              strokeWidth="45"
              strokeLinecap="round"
            />
            <path
              d="M-20 200 C110 80, 260 210, 440 100"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M20 230 C150 130, 290 220, 430 150"
              stroke="rgba(255,200,60,0.25)"
              strokeWidth="28"
              strokeLinecap="round"
            />
          </svg>

          {/* Central 3D Glowing Star */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-44 h-44 flex items-center justify-center opacity-85 pointer-events-none">
            <svg
              viewBox="0 0 24 24"
              className="w-32 h-32 drop-shadow-[0_12px_28px_rgba(255,215,0,0.65)] text-amber-300 fill-amber-400"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        </div>
      )}

      {/* Decorative Elements for Tet Theme */}
      {themeConfig.theme === "tet_spring" && !themeConfig.bannerUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-30">
          <div className="absolute top-2 right-4 text-amber-300 text-5xl">🌸</div>
          <div className="absolute top-10 left-6 text-amber-200 text-4xl">🌼</div>
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full border-4 border-amber-300/30 flex items-center justify-center" />
        </div>
      )}

      {/* Top Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Row 1: School Identity Banner */}
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-400 text-red-950 flex items-center justify-center text-xs font-black shadow-sm shrink-0">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white drop-shadow-md">
              {schoolName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-amber-200 bg-black/25 px-2.5 py-0.5 rounded-full border border-white/20 backdrop-blur-xs">
              Cổng Học Sinh
            </span>
          </div>
        </div>

        {/* Row 2: Navigation Bar (Menu, Search, Notification) */}
        <div className="flex items-center gap-2.5 mt-0.5">
          {/* Hamburger Menu Button */}
          <button
            onClick={onOpenMenu}
            aria-label="Mở menu"
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Quick Search Bar */}
          <div
            onClick={onOpenSearch}
            className="flex-1 relative flex items-center cursor-pointer group"
          >
            <Search className="h-3.5 w-3.5 absolute left-3 text-white/70 group-hover:text-white transition-colors" />
            <div className="w-full h-9 pl-9 pr-3 bg-white/20 group-hover:bg-white/25 text-white/80 text-xs rounded-xl border border-white/25 flex items-center backdrop-blur-md transition-all shadow-inner select-none truncate">
              Tìm kiếm tính năng, tiện ích...
            </div>
          </div>

          {/* Notification Bell Button */}
          <button
            onClick={() => onTabChange && onTabChange("debt")}
            aria-label="Thông báo"
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 flex items-center justify-center text-white relative backdrop-blur-md transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-red-800 shadow-md">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Optional Slogan / Motto on Banner */}
        {themeConfig.motto ? (
          <div className="text-center mt-2.5 mb-1 text-[11px] sm:text-xs font-semibold text-amber-200/90 tracking-wide drop-shadow-sm flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
            <span>{themeConfig.motto}</span>
            <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
          </div>
        ) : null}

        {/* Floating Student Greeting Card (Matching Reference Layout) */}
        <div className="mt-3.5 sm:mt-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/80 text-slate-800 transition-all hover:shadow-2xl">
            
            {/* Top Row: Avatar, Greeting, Detail link */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md ring-2 ring-white shrink-0">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1 mb-0.5 truncate">
                    <span>{schoolName}</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">Xin chào,</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                    {studentName}
                  </div>
                  <div className="text-[11px] font-medium text-blue-600 flex items-center gap-1 mt-0.5">
                    <span>Lớp {studentClass}</span>
                    <span>•</span>
                    <span>Mã HS: {studentCode}</span>
                  </div>
                </div>
              </div>

              {/* Detail Profile Button */}
              <button
                onClick={onOpenProfile}
                className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-2.5 py-1 rounded-full flex items-center gap-1 transition shrink-0 cursor-pointer active:scale-95"
              >
                <span>Hồ sơ</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
              </button>
            </div>

            {/* Mid Row: Debt / Meal Fee Info */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Tiền ăn còn nợ</div>
                <div className={`text-xl font-extrabold tracking-tight ${unpaidAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatMoney(unpaidAmount)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-slate-500 font-medium">Trạng thái bán trú</div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${
                  studentInfo?.boardingStatus === "ACTIVE" || !studentInfo
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-rose-700 bg-rose-50 border-rose-200"
                }`}>
                  <CheckCircle2 className="h-3 w-3" />
                  {studentInfo?.boardingStatus === "ACTIVE" || !studentInfo
                    ? "Đang ăn bán trú"
                    : "Tạm dừng"}
                </span>
              </div>
            </div>

            {/* Bottom Action Sub-card */}
            <div className="mt-3 bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/70 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700 truncate">
                <span className="text-slate-400 font-normal">Chế độ ăn: </span>
                <span className="text-slate-800">{getMealTypeName(studentInfo?.mealType)}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onTabChange && onTabChange("debt")}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Thanh toán</span>
                </button>
                <button
                  onClick={() => onTabChange && onTabChange("meal")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Utensils className="h-3 w-3" />
                  <span>Cắt/Đổi món</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
