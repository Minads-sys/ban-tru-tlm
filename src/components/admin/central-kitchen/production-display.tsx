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
  note?: string;
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
}: ProductionDisplayProps) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [dateFormatted, setDateFormatted] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live clock and date formatted
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setCurrentTime(timeStr);

      const daysOfWeek = [
        "Chủ Nhật",
        "Thứ Hai",
        "Thứ Ba",
        "Thứ Tư",
        "Thứ Năm",
        "Thứ Sáu",
        "Thứ Bảy",
      ];
      const dayName = daysOfWeek[now.getDay()];
      const d = String(now.getDate()).padStart(2, "0");
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = now.getFullYear();
      setDateFormatted(`${dayName}, ${d}/${m}/${y}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 shrink-0 gap-3">
        {/* Left: Title & Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
              <line x1="6" y1="17" x2="18" y2="17" />
            </svg>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              BẾP TRUNG TÂM
              <span className="hidden sm:inline-block text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-widest">
                Màn hình TV 16:9
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
              CHẾ ĐỘ SẢN XUẤT • {branches.length} CHI NHÁNH
            </div>
          </div>
        </div>

        {/* Center: Date picker navigator */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
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

        {/* Right: Date 40px, Clock 25px, Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Thứ, ngày, tháng tăng font lên 40px (responsive scaled on mobile) */}
          <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <span
              className="font-black text-slate-100 tracking-tight leading-none text-2xl sm:text-[34px] lg:text-[40px]"
              style={{ letterSpacing: "-0.5px" }}
            >
              {dateFormatted}
            </span>
          </div>

          {/* Đồng hồ thời gian thực font 25px */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span
              className="font-extrabold text-emerald-400 tabular-nums leading-none text-lg sm:text-[25px]"
            >
              {currentTime}
            </span>
          </div>

          {/* Controls: Refresh & Fullscreen */}
          <div className="flex items-center gap-1.5">
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
          const isLockedCook = branch.lockStatus === "LOCKED_COOK";
          const isLockedMarket = branch.lockStatus === "LOCKED_MARKET";

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
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shadow-md"
                    style={{ backgroundColor: branch.branchColor || "#60a5fa" }}
                  />
                  <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
                    {branch.branchName}
                  </span>

                  {/* Trạng thái chốt đặt cạnh tên chi nhánh */}
                  {isLockedCook ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-emerald-500/25 text-emerald-300 border border-emerald-500/50">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      🔥 CHỐT NẤU
                    </div>
                  ) : isLockedMarket ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-blue-500/25 text-blue-300 border border-blue-500/50">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      🛒 CHỐT ĐI CHỢ
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      ⏳ CHƯA CHỐT
                    </div>
                  )}
                </div>

                {/* Số suất tổng to hơn 1.5 lần (68px) */}
                <div className="flex items-baseline gap-1.5 bg-white/15 px-3.5 py-1 rounded-xl shadow-inner">
                  <span
                    className="font-black leading-none text-4xl sm:text-5xl lg:text-[68px]"
                    style={{
                      color: config.totalColor,
                      letterSpacing: "-2px",
                    }}
                  >
                    {branch.totalServings.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-xs sm:text-base font-bold opacity-80 text-slate-200">
                    suất
                  </span>
                </div>
              </div>

              {/* BRANCH BODY: 2 Columns */}
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
                      {branch.servingsMan.toLocaleString("vi-VN")}
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
                      {branch.servingsChay.toLocaleString("vi-VN")}
                    </span>
                  </div>

                  {/* Row 3: Cháo */}
                  <div className="flex items-center justify-between py-1">
                    <span className="font-extrabold opacity-95 text-xl sm:text-2xl lg:text-[32px] leading-tight">
                      🍲 Cháo
                    </span>
                    <span
                      className="font-black leading-none text-3xl sm:text-4xl lg:text-[63px]"
                      style={{ color: "#67e8f9", letterSpacing: "-1.5px" }}
                    >
                      {branch.servingsChao.toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>

                {/* Right: Export Ingredients */}
                <div className="px-3 sm:px-4 py-2 flex flex-col justify-center gap-2 border-t sm:border-t-0 sm:border-l-2 border-white/15 bg-black/10">
                  <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest opacity-70">
                    📦 Xuất Kho Nguyên Liệu
                  </div>

                  {/* If Mặn Cơm: 1 Gạo box */}
                  {branch.manMealType === "COM" ? (
                    <div className="bg-black/25 rounded-xl p-2 sm:p-2.5 border-l-4 border-amber-400">
                      <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                        <span className="font-black text-white text-base sm:text-xl lg:text-[24px]">
                          🌾 Gạo
                        </span>
                        <span className="text-[11px] sm:text-[13px] font-semibold text-slate-300">
                          ({ricePortionG}g ×{" "}
                          {(branch.servingsMan + branch.servingsChay).toLocaleString("vi-VN")}{" "}
                          suất cơm)
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-amber-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                          {branch.materials.riceKg.toFixed(1)}
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
                            ({branch.noodlePortionG}g ×{" "}
                            {branch.servingsMan.toLocaleString("vi-VN")} suất mặn)
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-amber-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                            {branch.materials.noodleKg.toFixed(1)}
                          </span>
                          <span className="text-sm sm:text-lg font-bold text-amber-300">
                            kg
                          </span>
                        </div>
                      </div>

                      {branch.servingsChay > 0 && (
                        <div className="bg-black/25 rounded-xl p-1.5 sm:p-2 border-l-4 border-emerald-400">
                          <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                            <span className="font-black text-white text-sm sm:text-lg lg:text-[20px]">
                              🌾 Gạo (Chay)
                            </span>
                            <span className="text-[10px] sm:text-[12px] font-semibold text-slate-300">
                              ({ricePortionG}g ×{" "}
                              {branch.servingsChay.toLocaleString("vi-VN")} suất chay)
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-emerald-200 leading-none text-xl sm:text-2xl lg:text-[30px]">
                              {branch.materials.riceKg.toFixed(1)}
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
                        ({branch.fruitPortionG}g ×{" "}
                        {branch.totalServings.toLocaleString("vi-VN")} suất)
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-black text-yellow-200 leading-none text-2xl sm:text-3xl lg:text-[40px] tracking-tight">
                        {branch.materials.fruitKg.toFixed(1)}
                      </span>
                      <span className="text-sm sm:text-lg font-bold text-yellow-300">
                        kg
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
              {summary.totalServings.toLocaleString("vi-VN")}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800 hidden sm:block" />

          {/* Mặn */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase">
              MẶN
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 leading-none">
              {summary.totalMan.toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Chay */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase">
              CHAY
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 leading-none">
              {summary.totalChay.toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Cháo */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase">
              CHÁO
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 leading-none">
              {summary.totalChao.toLocaleString("vi-VN")}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800 hidden sm:block" />

          {/* Tổng Gạo */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase">
              TỔNG GẠO
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-200 leading-none">
              {summary.totalRiceKg.toFixed(1)}{" "}
              <span className="text-xs text-slate-400 font-semibold">kg</span>
            </div>
          </div>

          {/* Món Nước */}
          {summary.noodleTotals.map((noodle, idx) => (
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
          {summary.fruitTotals.map((fruit, idx) => (
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
