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
  const boardingCode =
    studentInfo?.boardingCode || "BT-12A1-05";
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

          {/* Central 3D Glowing Faceted Star (matching reference image) */}
          <div className="absolute top-1 sm:top-3 left-1/2 -translate-x-1/2 w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center pointer-events-none z-0">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full drop-shadow-[0_15px_35px_rgba(255,215,0,0.7)]"
            >
              {/* Outer Golden Glow */}
              <circle cx="100" cy="100" r="75" fill="url(#starGlow)" opacity="0.45" />
              
              <defs>
                <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#EAB308" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#CA8A04" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="facetHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFBEB" />
                  <stop offset="100%" stopColor="#FDE047" />
                </linearGradient>
                <linearGradient id="facetLight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="100%" stopColor="#FACC15" />
                </linearGradient>
                <linearGradient id="facetMid" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="facetDark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D97706" />
                  <stop offset="100%" stopColor="#92400E" />
                </linearGradient>
              </defs>

              {/* 10 Facets of 3D Star: Alternating Light & Dark Triangles */}
              {/* Top Point */}
              <polygon points="100,100 100,15 78.8,70.9" fill="url(#facetHighlight)" />
              <polygon points="100,100 100,15 121.2,70.9" fill="url(#facetMid)" />

              {/* Top-Right Point */}
              <polygon points="100,100 180.8,73.7 121.2,70.9" fill="url(#facetLight)" />
              <polygon points="100,100 180.8,73.7 134.2,111.1" fill="url(#facetDark)" />

              {/* Bottom-Right Point */}
              <polygon points="100,100 150.0,168.8 134.2,111.1" fill="url(#facetMid)" />
              <polygon points="100,100 150.0,168.8 100,136" fill="url(#facetDark)" />

              {/* Bottom-Left Point */}
              <polygon points="100,100 50.0,168.8 100,136" fill="url(#facetLight)" />
              <polygon points="100,100 50.0,168.8 65.8,111.1" fill="url(#facetDark)" />

              {/* Top-Left Point */}
              <polygon points="100,100 19.2,73.7 65.8,111.1" fill="url(#facetLight)" />
              <polygon points="100,100 19.2,73.7 78.8,70.9" fill="url(#facetDark)" />
            </svg>
          </div>

          {/* Golden Flying Doves (matching reference image) */}
          <div className="absolute top-4 left-[12%] w-7 h-7 opacity-60 text-amber-200 pointer-events-none transform -rotate-12">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 4c-2.5 1-4.5 3-5.5 5.5-1.5-1-3.5-1.5-5.5-1-1.5.5-2.8 1.5-3.5 3-2.5.5-4.5 2.5-4.5 5.5 1.5-.5 3-1.5 4-2.8.8 1.8 2.2 3.2 4 4 .2-1.5 1-3 2.2-4.2C13.5 12.8 15 12 17 12c1.5 0 3 .5 4 1.5-.5-3.2-.5-6.5 0-9.5z" />
            </svg>
          </div>
          <div className="absolute top-10 right-[15%] w-6 h-6 opacity-60 text-amber-200 pointer-events-none transform rotate-12">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 4c-2.5 1-4.5 3-5.5 5.5-1.5-1-3.5-1.5-5.5-1-1.5.5-2.8 1.5-3.5 3-2.5.5-4.5 2.5-4.5 5.5 1.5-.5 3-1.5 4-2.8.8 1.8 2.2 3.2 4 4 .2-1.5 1-3 2.2-4.2C13.5 12.8 15 12 17 12c1.5 0 3 .5 4 1.5-.5-3.2-.5-6.5 0-9.5z" />
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

        {/* Floating Student Greeting Card (Transparent Glassmorphic Layout matching reference) */}
        <div className="mt-3.5 sm:mt-4">
          <div className="bg-black/25 backdrop-blur-[2px] rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-white/25 text-white transition-all hover:border-white/40">
            
            {/* Top Row: Avatar, Greeting, Detail link (Transparent background reveals banner) */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 backdrop-blur-xs flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
                  <GraduationCap className="h-6 w-6 text-amber-300 drop-shadow-xs" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1 mb-0.5 truncate">
                    <span>{schoolName}</span>
                  </div>
                  <div className="text-[11px] font-medium text-white/80">Xin chào,</div>
                  <div className="text-base sm:text-lg font-bold text-white leading-tight truncate drop-shadow-sm">
                    {studentName}
                  </div>
                  <div className="text-[11px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                    <span>Lớp {studentClass}</span>
                    <span>•</span>
                    <span className="text-amber-200 font-semibold">Mã BT: {boardingCode}</span>
                  </div>
                </div>
              </div>

              {/* Profile Button (White pill button like reference) */}
              <button
                onClick={onOpenProfile}
                className="text-[11px] font-bold text-slate-800 bg-white hover:bg-white/90 border border-white px-3 py-1.5 rounded-full flex items-center gap-1 transition shrink-0 cursor-pointer active:scale-95 shadow-md"
              >
                <span>Hồ sơ</span>
                <ChevronRight className="h-3 w-3 text-slate-600" />
              </button>
            </div>

            {/* Mid Row: Debt / Meal Fee Info */}
            <div className="mt-3.5 pt-3 border-t border-white/15 flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[11px] text-white/75 font-medium">Tiền ăn còn nợ</div>
                <div className={`text-2xl font-black tracking-tight drop-shadow-xs ${unpaidAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  {formatMoney(unpaidAmount)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-white/75 font-medium mb-0.5">Trạng thái bán trú</div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-xs ${
                  studentInfo?.boardingStatus === "ACTIVE" || !studentInfo
                    ? "text-emerald-300 bg-emerald-950/40 border-emerald-400/40"
                    : "text-rose-300 bg-rose-950/40 border-rose-400/40"
                }`}>
                  <CheckCircle2 className="h-3 w-3" />
                  {studentInfo?.boardingStatus === "ACTIVE" || !studentInfo
                    ? "Đang ăn bán trú"
                    : "Tạm dừng"}
                </span>
              </div>
            </div>

            {/* Bottom Action Sub-card (White container at bottom matching reference) */}
            <div className="mt-3 bg-white rounded-xl p-2.5 shadow-md border border-slate-100 flex items-center justify-between gap-2 text-slate-800">
              <div className="text-xs font-semibold text-slate-700 truncate">
                <span className="text-slate-400 font-normal">Chế độ ăn: </span>
                <span className="text-slate-900 font-bold">{getMealTypeName(studentInfo?.mealType)}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onTabChange && onTabChange("debt")}
                  className={`font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition flex items-center gap-1 cursor-pointer ${
                    unpaidAmount > 0
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md animate-pulse ring-2 ring-rose-400 ring-offset-1"
                      : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs"
                  }`}
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
