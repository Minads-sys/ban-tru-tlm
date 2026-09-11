"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

interface MaterialDetail {
  riceKg: number;
  noodleKg: number;
  fruitKg: number;
}

interface BranchCardData {
  branchId: string;
  branchCode: string;
  branchName: string;
  branchColor: string;
  sortOrder: number;
  entryId: string | null;
  totalServings: number;
  servingsMan: number;
  servingsChao: number;
  servingsChay: number;
  manMealType: "COM" | "NUOC";
  noodleId: string | null;
  noodleName: string;
  noodlePortionG: number;
  fruitId: string | null;
  fruitName: string;
  fruitPortionG: number;
  lockStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK";
  marketServings?: {
    total: number;
    man: number;
    chao: number;
    chay: number;
  };
  difference?: number;
  marketLockedAt?: string | null;
  mealLockedAt?: string | null;
  note?: string;
  isHoliday?: boolean;
  holidayReason?: string;
  hasEntry: boolean;
  materials: MaterialDetail;
}

interface DailySummary {
  totalServings: number;
  totalMan: number;
  totalChao: number;
  totalChay: number;
  totalRiceKg: number;
  noodleTotals: Array<{
    noodleId?: string | null;
    noodleName: string;
    totalKg: number;
    servingsMan: number;
  }>;
  fruitTotals: Array<{
    fruitId?: string | null;
    fruitName: string;
    totalKg: number;
    totalServings: number;
  }>;
}

interface ProductionDisplayProps {
  date: string;
  onDateChange: (newDate: string) => void;
  branches: BranchCardData[];
  summary: DailySummary;
  refreshData: () => Promise<void>;
  ricePortionG?: number;
  hideDateControls?: boolean;
  mealLockTime?: string; // Mốc giờ chốt ăn cài đặt (mặc định "08:00")
}

const BRANCH_GRADIENTS: Record<string, { bg: string; border: string; totalColor: string }> = {
  GD: {
    bg: "linear-gradient(135deg, #1e3a8a, #1d4ed8, #2563eb)",
    border: "#3b82f6",
    totalColor: "#bfdbfe",
  },
  HHT: {
    bg: "linear-gradient(135deg, #14532d, #15803d, #16a34a)",
    border: "#22c55e",
    totalColor: "#bbf7d0",
  },
  TD: {
    bg: "linear-gradient(135deg, #7c2d12, #c2410c, #ea580c)",
    border: "#f97316",
    totalColor: "#fed7aa",
  },
  TLM: {
    bg: "linear-gradient(135deg, #581c87, #6b21a8, #7e22ce)",
    border: "#a855f7",
    totalColor: "#e9d5ff",
  },
};

const DEFAULT_GRADIENT = {
  bg: "linear-gradient(135deg, #1e293b, #334155, #475569)",
  border: "#64748b",
  totalColor: "#e2e8f0",
};

export function ProductionDisplay({
  date,
  onDateChange,
  branches,
  summary,
  refreshData,
  ricePortionG = 150,
  hideDateControls = false,
  mealLockTime = "08:00",
}: ProductionDisplayProps) {
  const [realtimeClock, setRealtimeClock] = useState<string>("");
  const [realtimeDate, setRealtimeDate] = useState<string>("");
  const [isAfterMealCutoff, setIsAfterMealCutoff] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Định dạng NGÀY ĂN PHỤC VỤ chuẩn xác theo prop date (không lấy theo now)
  const servingDateFormatted = React.useMemo(() => {
    if (!date) return "";
    const [y, m, d] = date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const daysOfWeek = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const dayName = daysOfWeek[dateObj.getDay()];
    const dayStr = String(d).padStart(2, "0");
    const monthStr = String(m).padStart(2, "0");
    return `${dayName}, ${dayStr}/${monthStr}/${y}`;
  }, [date]);

  // Tính tổng số liệu toàn hệ thống chuẩn xác theo từng thẻ hiển thị trên màn hình
  const displayedSummary = React.useMemo(() => {
    let totalServings = 0;
    let totalMan = 0;
    let totalChao = 0;
    let totalChay = 0;
    let totalRiceKg = 0;
    const noodleTotalsMap: Record<
      string,
      { noodleName: string; totalKg: number }
    > = {};
    const fruitTotalsMap: Record<
      string,
      { fruitName: string; totalKg: number }
    > = {};

    branches.forEach((b) => {
      if (b.isHoliday) return; // Bỏ qua chi nhánh nghỉ theo lịch

      const isMealLocked = b.lockStatus === "LOCKED_COOK";
      const showMealLock = isMealLocked && isAfterMealCutoff;

      const dTotal = showMealLock
        ? b.totalServings
        : (b.marketServings?.total ?? b.totalServings);
      const dMan = showMealLock
        ? b.servingsMan
        : (b.marketServings?.man ?? b.servingsMan);
      const dChay = showMealLock
        ? b.servingsChay
        : (b.marketServings?.chay ?? b.servingsChay);
      const dChao = showMealLock
        ? b.servingsChao
        : (b.marketServings?.chao ?? b.servingsChao);

      totalServings += dTotal;
      totalMan += dMan;
      totalChay += dChay;
      totalChao += dChao;

      // Gạo
      const riceServings =
        b.manMealType === "COM" ? dMan + dChay : dChay;
      totalRiceKg += (riceServings * ricePortionG) / 1000;

      // Món Nước
      if (b.manMealType === "NUOC" && dMan > 0) {
        const nName = b.noodleName || "Món Nước";
        const nPortion = b.noodlePortionG || 200;
        const nKg = (dMan * nPortion) / 1000;
        if (!noodleTotalsMap[nName]) {
          noodleTotalsMap[nName] = { noodleName: nName, totalKg: 0 };
        }
        noodleTotalsMap[nName].totalKg += nKg;
      }

      // Trái cây
      if (dTotal > 0 && b.fruitName) {
        const fPortion = b.fruitPortionG || 150;
        const fKg = (dTotal * fPortion) / 1000;
        if (!fruitTotalsMap[b.fruitName]) {
          fruitTotalsMap[b.fruitName] = { fruitName: b.fruitName, totalKg: 0 };
        }
        fruitTotalsMap[b.fruitName].totalKg += fKg;
      }
    });

    return {
      totalServings,
      totalMan,
      totalChao,
      totalChay,
      totalRiceKg: Number(totalRiceKg.toFixed(1)),
      noodleTotals: Object.values(noodleTotalsMap).map((n) => ({
        ...n,
        totalKg: Number(n.totalKg.toFixed(1)),
      })),
      fruitTotals: Object.values(fruitTotalsMap).map((f) => ({
        ...f,
        totalKg: Number(f.totalKg.toFixed(1)),
      })),
    };
  }, [branches, isAfterMealCutoff, ricePortionG]);

  // Live clock thời gian thực và kiểm tra mốc giờ chốt ăn (mealLockTime)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setRealtimeClock(timeStr);

      const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      const dayShort = daysOfWeek[now.getDay()];
      const d = String(now.getDate()).padStart(2, "0");
      const m = String(now.getMonth() + 1).padStart(2, "0");
      setRealtimeDate(`${dayShort}, ${d}/${m}`);

      // Kiểm tra giờ hiện tại có qua giờ chốt ăn (mặc định 08:00) hay chưa
      const [cutH, cutM] = (mealLockTime || "08:00").split(":").map(Number);
      const nowH = now.getHours();
      const nowM = now.getMinutes();
      setIsAfterMealCutoff(nowH > cutH || (nowH === cutH && nowM >= cutM));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [mealLockTime]);

  // 30s auto-refresh polling
  useEffect(() => {
    const pollTimer = setInterval(() => {
      refreshData();
    }, 30000);
    return () => clearInterval(pollTimer);
  }, [refreshData]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const changeDateByDays = (days: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + days);
    const newY = curr.getFullYear();
    const newM = String(curr.getMonth() + 1).padStart(2, "0");
    const newD = String(curr.getDate()).padStart(2, "0");
    onDateChange(`${newY}-${newM}-${newD}`);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-slate-950 text-white select-none w-full overflow-hidden transition-colors"
      style={{
        minHeight: isFullscreen ? "100vh" : "calc(100vh - 110px)",
        height: isFullscreen ? "100vh" : undefined,
      }}
    >
      {/* TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-2 bg-slate-900/90 border-b border-slate-800 shrink-0 gap-2 sm:gap-3">
        {/* Left: Title & Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sm:w-[22px] sm:h-[22px]"
              >
                <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
                <line x1="6" y1="17" x2="18" y2="17" />
              </svg>
            </div>
            <div>
              <div className="text-base sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2">
                BẾP TRUNG TÂM
                <span className="hidden sm:inline-block text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-widest">
                  Màn hình TV 16:9
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
                CHẾ ĐỘ SẢN XUẤT • {branches.length} CHI NHÁNH
              </div>
            </div>
          </div>

          {/* Controls on mobile: Refresh & Fullscreen */}
          <div className="flex sm:hidden items-center gap-1">
            <button
              onClick={handleManualRefresh}
              className={`p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition ${
                isRefreshing ? "animate-spin text-blue-400" : ""
              }`}
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình TV"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Center: Date picker navigator (Ẩn khi hideDateControls = true trên màn hình TV) */}
        {!hideDateControls && (
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700 self-center sm:self-auto">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Ngày trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-sm font-bold text-white border-0 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => changeDateByDays(1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Ngày sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right: Date 40px, Clock 25px, Action Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto">
          {/* KHỐI 1: TIÊU ĐỀ NGÀY ĂN PHỤC VỤ (Font lớn trên TV, gọn gàng trên mobile không bị tràn) */}
          <div className="flex-1 sm:flex-initial flex items-center gap-1.5 sm:gap-2 bg-white/10 px-2.5 sm:px-4 py-1.5 rounded-xl border border-white/20 shadow-inner min-w-0">
            <span className="text-[10px] sm:text-sm font-black text-amber-300 uppercase tracking-wider shrink-0">
              📅 NGÀY ĂN:
            </span>
            <span
              className="font-black text-white tracking-tight leading-none text-xs sm:text-[28px] lg:text-[38px] whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ letterSpacing: "-0.5px" }}
            >
              {servingDateFormatted}
            </span>
          </div>

          {/* KHỐI 2: ĐỒNG HỒ THỜI GIAN THỰC TẾ HIỆN TẠI */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/5 px-2 sm:px-3 py-1.5 rounded-xl border border-white/10 shadow-inner shrink-0">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-emerald-400 tabular-nums leading-none text-xs sm:text-[20px]">
                {realtimeClock}
              </span>
              <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none mt-0.5 sm:mt-1 whitespace-nowrap">
                Hiện tại ({realtimeDate})
              </span>
            </div>
          </div>

          {/* Controls: Refresh & Fullscreen on Desktop / TV */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition ${
                isRefreshing ? "animate-spin text-blue-400" : ""
              }`}
              title="Làm mới dữ liệu (Tự động mỗi 30s)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình TV (F11)"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4 BRANCH CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 flex-1 p-2 sm:p-3 gap-3 min-h-0 auto-rows-fr overflow-y-auto">
        {branches.map((branch) => {
          const config = BRANCH_GRADIENTS[branch.branchCode] || DEFAULT_GRADIENT;

          // QUY TẮC VÀNG: Chỉ hiển thị "CHỐT SỐ ĂN" khi:
          // 1. Chi nhánh đã bấm chốt ăn (LOCKED_COOK)
          // 2. VÀ thời gian thực tế đã qua giờ chốt ăn (sau 08:00)
          const isMealLocked = branch.lockStatus === "LOCKED_COOK";
          const showMealLock = isMealLocked && isAfterMealCutoff;

          // Số lượng hiển thị: Nếu chưa hiển thị Chốt Ăn thì VẪN CHỈ HIỂN THỊ SỐ ĐI CHỢ
          const displayedTotal = showMealLock
            ? branch.totalServings
            : (branch.marketServings?.total ?? branch.totalServings);

          const displayedMan = showMealLock
            ? branch.servingsMan
            : (branch.marketServings?.man ?? branch.servingsMan);

          const displayedChay = showMealLock
            ? branch.servingsChay
            : (branch.marketServings?.chay ?? branch.servingsChay);

          const displayedChao = showMealLock
            ? branch.servingsChao
            : (branch.marketServings?.chao ?? branch.servingsChao);

          const diffServings = branch.marketServings
            ? branch.totalServings - branch.marketServings.total
            : 0;

          const displayedRiceServings =
            branch.manMealType === "COM"
              ? displayedMan + displayedChay
              : displayedChay;
          const displayedRiceKg = (displayedRiceServings * ricePortionG) / 1000;
          const displayedNoodleKg =
            branch.manMealType === "NUOC"
              ? (displayedMan * (branch.noodlePortionG || 200)) / 1000
              : 0;
          const displayedFruitKg =
            (displayedTotal * (branch.fruitPortionG || 150)) / 1000;

          return (
            <div
              key={branch.branchId}
              className="rounded-2xl overflow-hidden flex flex-col min-h-[220px] shadow-2xl transition-transform"
              style={{
                background: config.bg,
                border: `2px solid ${config.border}`,
              }}
            >
              {/* BRANCH HEADER */}
              <div className="px-4 py-2 bg-black/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div
                    className="w-3 h-3 rounded-full shadow-md shrink-0"
                    style={{ backgroundColor: branch.branchColor || "#60a5fa" }}
                  />
                  <div>
                    <span className="text-lg sm:text-2xl font-black uppercase tracking-wider text-white">
                      {branch.branchName}
                    </span>
                    {/* Dòng chênh lệch số lượng nếu có */}
                    {showMealLock && diffServings !== 0 && (
                      <div className="text-[11px] font-bold text-amber-200 bg-black/40 px-2 py-0.5 rounded border border-amber-400/30 mt-0.5">
                        Đi chợ: {branch.marketServings?.total} ➔ Ăn: {branch.totalServings} (
                        {diffServings > 0 ? `+${diffServings}` : diffServings} suất)
                      </div>
                    )}
                  </div>

                  {/* Trạng thái chốt đặt cạnh tên chi nhánh */}
                  {branch.isHoliday ? (
                    <div className="flex flex-col items-start">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-purple-500/30 text-purple-200 border border-purple-400/50">
                        <span>🏖️</span> NGHỈ THEO LỊCH
                      </div>
                      {branch.holidayReason && (
                        <span className="text-[10px] sm:text-xs text-purple-200 font-semibold pl-1 mt-0.5 max-w-[180px] sm:max-w-[240px] truncate">
                          {branch.holidayReason}
                        </span>
                      )}
                    </div>
                  ) : showMealLock ? (
                    <div className="flex flex-col items-start">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-emerald-500/25 text-emerald-300 border border-emerald-500/50">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        🍽️ ĐÃ CHỐT SỐ ĂN
                      </div>
                      {branch.mealLockedAt && (
                        <span className="text-[10px] text-emerald-200/80 font-medium pl-1 mt-0.5">
                          Lúc {new Date(branch.mealLockedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  ) : branch.lockStatus === "LOCKED_MARKET" || branch.lockStatus === "LOCKED_COOK" ? (
                    <div className="flex flex-col items-start">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-blue-500/25 text-blue-300 border border-blue-500/50">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        🛒 ĐÃ CHỐT ĐI CHỢ
                      </div>
                      {isAfterMealCutoff && (
                        <span className="text-[10px] text-amber-300 font-bold pl-1 mt-0.5 animate-pulse">
                          ⚠️ Chưa chốt số ăn
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        ⏳ CHƯA BÁO ĐI CHỢ
                      </div>
                      {isAfterMealCutoff && (
                        <span className="text-[10px] text-amber-300 font-bold pl-1 mt-0.5">
                          ⚠️ Chưa chốt số ăn
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Số suất tổng to hơn 1.5 lần (68px) */}
                <div className="flex items-baseline gap-1.5 bg-white/15 px-3.5 py-1 rounded-xl shadow-inner shrink-0">
                  <span
                    className="font-black leading-none text-4xl sm:text-5xl lg:text-[68px]"
                    style={{
                      color: branch.isHoliday ? "#cbd5e1" : config.totalColor,
                      letterSpacing: "-2px",
                    }}
                  >
                    {branch.isHoliday ? "0" : displayedTotal.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-xs sm:text-base font-bold opacity-80 text-slate-200">
                    suất
                  </span>
                </div>
              </div>

              {/* BRANCH BODY */}
              {branch.isHoliday ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-black/25 min-h-[140px]">
                  <div className="text-4xl sm:text-5xl mb-2">🏖️</div>
                  <div className="text-lg sm:text-2xl font-black text-white">
                    Chi nhánh nghỉ hoạt động theo lịch
                  </div>
                  {branch.holidayReason && (
                    <div className="mt-2 px-4 py-1.5 bg-white/10 rounded-full text-xs sm:text-sm text-purple-200 font-bold max-w-md border border-purple-400/20 shadow-sm">
                      📢 {branch.holidayReason}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-300">
                    Không phục vụ suất ăn trong ngày này
                  </div>
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-0 min-h-0">
                  {/* Left: Meals List (Mặn, Chay, Cháo) */}
                  <div className="px-4 py-2 flex flex-col justify-center gap-1.5 sm:gap-2">
                    {/* Row 1: Mặn Cơm hoặc Mặn Nước */}
                    <div className="flex items-center justify-between py-1">
                      <span className="font-extrabold opacity-95 text-xl sm:text-2xl lg:text-[32px] leading-tight">
                        {branch.manMealType === "NUOC" ? (
                          <>🍜 {branch.noodleName || "Món Nước"}</>
                        ) : (
                          <>🍚 Mặn Cơm</>
                        )}
                      </span>
                      <span
                        className="font-black leading-none text-3xl sm:text-4xl lg:text-[63px]"
                        style={{ color: "#fbbf24", letterSpacing: "-1.5px" }}
                      >
                        {displayedMan.toLocaleString("vi-VN")}
                      </span>
                    </div>

                    {/* Row 2: Chay */}
                    <div className="flex items-center justify-between py-1">
                      <span className="font-extrabold opacity-95 text-xl sm:text-2xl lg:text-[32px] leading-tight">
                        🥬 Chay
                      </span>
                      <span
                        className="font-black leading-none text-3xl sm:text-4xl lg:text-[63px]"
                        style={{ color: "#4ade80", letterSpacing: "-1.5px" }}
                      >
                        {displayedChay.toLocaleString("vi-VN")}
                      </span>
                    </div>

                    {/* Row 3: Cháo */}
                    <div className="flex items-center justify-between py-1">
                      <span className="font-extrabold opacity-95 text-xl sm:text-2xl lg:text-[32px] leading-tight">
                        🥣 Cháo
                      </span>
                      <span
                        className="font-black leading-none text-3xl sm:text-4xl lg:text-[63px]"
                        style={{ color: "#67e8f9", letterSpacing: "-1.5px" }}
                      >
                        {displayedChao.toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>

                  {/* Right: Calculated Materials (Gạo, Món Nước, Trái cây) */}
                  <div className="px-4 py-2 flex flex-col justify-center gap-1.5 sm:gap-2 border-t sm:border-t-0 sm:border-l border-white/10 bg-black/15">
                    {/* If Mặn Cơm: Single Gạo box */}
                    {branch.manMealType === "COM" ? (
                      <div className="bg-black/25 rounded-xl p-2 sm:p-2.5 border-l-4 border-amber-400">
                        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                          <span className="font-black text-white text-base sm:text-xl lg:text-[24px]">
                            🌾 Gạo
                          </span>
                          <span className="text-[11px] sm:text-[13px] font-semibold text-slate-300">
                            ({ricePortionG}g ×{" "}
                            {displayedRiceServings.toLocaleString("vi-VN")}{" "}
                            suất cơm)
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-amber-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                            {displayedRiceKg.toFixed(1)}
                          </span>
                          <span className="text-sm sm:text-lg font-bold text-amber-300">
                            kg
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* If Mặn Nước: Noodle box + Chay rice box */
                      <>
                        <div className="bg-black/25 rounded-xl p-2 sm:p-2.5 border-l-4 border-amber-400">
                          <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                            <span className="font-black text-white text-base sm:text-xl lg:text-[24px]">
                              🍜 {branch.noodleName || "Món Nước"}
                            </span>
                            <span className="text-[11px] sm:text-[13px] font-semibold text-slate-300">
                              ({branch.noodlePortionG || 200}g ×{" "}
                              {displayedMan.toLocaleString("vi-VN")} suất mặn)
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-amber-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                              {displayedNoodleKg.toFixed(1)}
                            </span>
                            <span className="text-sm sm:text-lg font-bold text-amber-300">
                              kg
                            </span>
                          </div>
                        </div>

                        {displayedChay > 0 && (
                          <div className="bg-black/25 rounded-xl p-2 sm:p-2.5 border-l-4 border-emerald-400">
                            <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                              <span className="font-black text-white text-base sm:text-xl lg:text-[24px]">
                                🌾 Gạo cấp Chay
                              </span>
                              <span className="text-[11px] sm:text-[13px] font-semibold text-slate-300">
                                ({ricePortionG}g × {displayedChay} suất chay)
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-emerald-200 leading-none text-xl sm:text-2xl lg:text-[30px]">
                                {((displayedChay * ricePortionG) / 1000).toFixed(1)}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-emerald-300">
                                kg
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Trái cây box */}
                    <div className="bg-black/25 rounded-xl p-2 sm:p-2.5 border-l-4 border-yellow-400">
                      <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                        <span className="font-black text-white text-base sm:text-xl lg:text-[24px]">
                          🍌 {branch.fruitName || "Trái cây"}
                        </span>
                        <span className="text-[11px] sm:text-[13px] font-semibold text-slate-300">
                          ({branch.fruitPortionG || 150}g ×{" "}
                          {displayedTotal.toLocaleString("vi-VN")} suất)
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-yellow-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                          {displayedFruitKg.toFixed(1)}
                        </span>
                        <span className="text-sm sm:text-lg font-bold text-yellow-300">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BOTTOM TOTAL SUMMARY BAR */}
      <div className="mx-2 sm:mx-3 mb-2 px-4 sm:px-6 py-2 bg-slate-900/95 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between shrink-0 gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest">
            HỆ THỐNG TOÀN TRƯỜNG
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          {/* Tổng suất */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">
              TỔNG SUẤT
            </div>
            <div className="text-2xl sm:text-4xl font-black text-white leading-none">
              {displayedSummary.totalServings.toLocaleString("vi-VN")}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800 hidden sm:block" />

          {/* Mặn */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase">
              MẶN
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 leading-none">
              {displayedSummary.totalMan.toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Chay */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase">
              CHAY
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 leading-none">
              {displayedSummary.totalChay.toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Cháo */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase">
              CHÁO
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 leading-none">
              {displayedSummary.totalChao.toLocaleString("vi-VN")}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800 hidden sm:block" />

          {/* Tổng Gạo */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase">
              TỔNG GẠO
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-200 leading-none">
              {displayedSummary.totalRiceKg.toFixed(1)}{" "}
              <span className="text-xs text-slate-400 font-semibold">kg</span>
            </div>
          </div>

          {/* Món Nước */}
          {displayedSummary.noodleTotals.map((noodle, idx) => (
            <div key={idx} className="text-center">
              <div className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase">
                {noodle.noodleName}
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-200 leading-none">
                {noodle.totalKg.toFixed(1)}{" "}
                <span className="text-xs text-slate-400 font-semibold">kg</span>
              </div>
            </div>
          ))}

          {/* Trái cây */}
          {displayedSummary.fruitTotals.map((fruit, idx) => (
            <div key={idx} className="text-center">
              <div className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase">
                {fruit.fruitName}
              </div>
              <div className="text-xl sm:text-2xl font-black text-yellow-200 leading-none">
                {fruit.totalKg.toFixed(1)}{" "}
                <span className="text-xs text-slate-400 font-semibold">kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
