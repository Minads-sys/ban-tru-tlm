"use client";

import React, { useState } from "react";
import {
  Lock,
  Unlock,
  ShoppingCart,
  Utensils,
  Clock,
  Scale,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react";
import { toast } from "@/lib/toast";

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
  isChayRice?: boolean;
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
  materials: {
    riceKg: number;
    noodleKg: number;
    fruitKg: number;
  };
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

interface DailySummaryTableProps {
  date: string;
  branches: BranchCardData[];
  summary: DailySummary;
  userRole?: string;
  onRefresh: () => Promise<void>;
}

function formatLockTime(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "-";
  }
}

export function DailySummaryTable({
  date,
  branches,
  summary,
  userRole,
  onRefresh,
}: DailySummaryTableProps) {
  const [viewMode, setViewMode] = useState<"STANDARD" | "COMPARISON">("STANDARD");

  const handleQuickStatusChange = async (
    branchId: string,
    newStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK"
  ) => {
    try {
      const res = await fetch("/api/central-kitchen/daily", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          branchId,
          lockStatus: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật");

      toast.success("Đã cập nhật trạng thái chi nhánh");
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật trạng thái");
    }
  };

  // Calculations for comparison summary
  const totalMarketServings = branches.reduce((sum, b) => sum + (b.marketServings?.total || 0), 0);
  const totalMarketMan = branches.reduce((sum, b) => sum + (b.marketServings?.man || 0), 0);
  const totalMarketChay = branches.reduce((sum, b) => sum + (b.marketServings?.chay || 0), 0);
  const totalMarketChao = branches.reduce((sum, b) => sum + (b.marketServings?.chao || 0), 0);
  const totalComparisonDiff = summary.totalServings - totalMarketServings;
  const totalDiffPct =
    totalMarketServings > 0
      ? ((totalComparisonDiff / totalMarketServings) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Bảng Tổng Hợp Chi Tiết Chi Nhánh</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Xem đối soát toàn bộ 4 chi nhánh theo thời gian thực
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode("STANDARD")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === "STANDARD"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>🍱 Bảng Định Lượng</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("COMPARISON")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === "COMPARISON"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>⚖️ Đối Chiếu Đi Chợ vs Chốt Ăn</span>
          </button>
        </div>
      </div>

      {viewMode === "COMPARISON" ? (
        /* ================= BẢNG ĐỐI CHIẾU ĐI CHỢ VS CHỐT ĂN ================= */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th rowSpan={2} className="py-3 px-4 font-bold border-r border-slate-200 dark:border-slate-700 align-middle">
                  Chi nhánh
                </th>
                <th colSpan={4} className="py-2.5 px-3 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-black border-r border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                    <span>MỐC CHỐT ĐI CHỢ</span>
                  </div>
                </th>
                <th colSpan={4} className="py-2.5 px-3 text-center bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black border-r border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    <span>MỐC CHỐT SỐ ĂN</span>
                  </div>
                </th>
                <th colSpan={4} className="py-2.5 px-3 text-center bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-black">
                  <div className="flex items-center justify-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    <span>ĐỐI CHIẾU & BIẾN ĐỘNG</span>
                  </div>
                </th>
              </tr>
              <tr className="bg-slate-100/70 dark:bg-slate-800 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold">
                {/* Đi chợ subheaders */}
                <th className="py-2 px-2.5 text-right text-blue-900 dark:text-blue-200">Mặn</th>
                <th className="py-2 px-2.5 text-right text-blue-900 dark:text-blue-200">Chay</th>
                <th className="py-2 px-2.5 text-right text-blue-900 dark:text-blue-200">Cháo</th>
                <th className="py-2 px-3 text-right font-black text-blue-950 dark:text-blue-100 border-r border-slate-200 dark:border-slate-700">Tổng</th>
                {/* Chốt ăn subheaders */}
                <th className="py-2 px-2.5 text-right text-emerald-900 dark:text-emerald-200">Mặn</th>
                <th className="py-2 px-2.5 text-right text-emerald-900 dark:text-emerald-200">Chay</th>
                <th className="py-2 px-2.5 text-right text-emerald-900 dark:text-emerald-200">Cháo</th>
                <th className="py-2 px-3 text-right font-black text-emerald-950 dark:text-emerald-100 border-r border-slate-200 dark:border-slate-700">Tổng</th>
                {/* Đối chiếu subheaders */}
                <th className="py-2 px-3 text-right font-bold text-amber-900 dark:text-amber-200">Chênh lệch (±)</th>
                <th className="py-2 px-3 text-right font-bold text-amber-900 dark:text-amber-200">Tỷ lệ %</th>
                <th className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">Giờ (Chợ / Ăn)</th>
                <th className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map((b) => {
                const isLockedCook = b.lockStatus === "LOCKED_COOK";
                const isLockedMarket = b.lockStatus === "LOCKED_MARKET";
                const mTotal = b.marketServings?.total || 0;
                const mMan = b.marketServings?.man || 0;
                const mChay = b.marketServings?.chay || 0;
                const mChao = b.marketServings?.chao || 0;
                const diff = b.difference ?? (b.totalServings - mTotal);
                const pct = mTotal > 0 ? ((diff / mTotal) * 100).toFixed(1) : "0.0";

                return (
                  <tr
                    key={b.branchId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: b.branchColor }}
                        />
                        <span>{b.branchName}</span>
                      </div>
                    </td>

                    {/* Mốc Đi Chợ */}
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {mMan > 0 ? mMan.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {mChay > 0 ? mChay.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {mChao > 0 ? mChao.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/20 border-r border-slate-200 dark:border-slate-700">
                      {mTotal > 0 ? mTotal.toLocaleString("vi-VN") : "-"}
                    </td>

                    {/* Mốc Chốt Ăn */}
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {b.servingsMan > 0 ? b.servingsMan.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {b.servingsChay > 0 ? b.servingsChay.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {b.servingsChao > 0 ? b.servingsChao.toLocaleString("vi-VN") : "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20 border-r border-slate-200 dark:border-slate-700">
                      {b.totalServings > 0 ? b.totalServings.toLocaleString("vi-VN") : "-"}
                    </td>

                    {/* Đối Chiếu & Biến Động */}
                    <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                      {b.isHoliday ? (
                        <span className="text-slate-400 font-normal italic text-xs">Nghỉ</span>
                      ) : mTotal === 0 ? (
                        <span className="text-slate-400 font-normal text-xs">-</span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                          <TrendingUp className="w-3.5 h-3.5" />+{diff}
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                          <TrendingDown className="w-3.5 h-3.5" />{diff}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-xs whitespace-nowrap">
                      {b.isHoliday || mTotal === 0 ? (
                        <span className="text-slate-400 font-normal">-</span>
                      ) : diff > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">+{pct}%</span>
                      ) : diff < 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">{pct}%</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">0.0%</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                      {formatLockTime(b.marketLockedAt)} / {formatLockTime(b.mealLockedAt)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {b.isHoliday ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          🏖️ Lịch nghỉ
                        </span>
                      ) : isLockedCook ? (
                        diff !== 0 && mTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                            ⚡ Đã chốt (Lệch)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                            ✓ Đã chốt ăn
                          </span>
                        )
                      ) : isLockedMarket ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          🛒 Chờ chốt ăn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          ⏳ Chưa chốt
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase border-r border-slate-200 dark:border-slate-700">
                  TỔNG TOÀN TRƯỜNG
                </td>
                {/* Đi chợ totals */}
                <td className="py-3 px-2.5 text-right text-blue-900 dark:text-blue-200">
                  {totalMarketMan.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-2.5 text-right text-blue-900 dark:text-blue-200">
                  {totalMarketChay.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-2.5 text-right text-blue-900 dark:text-blue-200">
                  {totalMarketChao.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-3 text-right text-base text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 border-r border-slate-200 dark:border-slate-700">
                  {totalMarketServings.toLocaleString("vi-VN")}
                </td>
                {/* Chốt ăn totals */}
                <td className="py-3 px-2.5 text-right text-emerald-900 dark:text-emerald-200">
                  {summary.totalMan.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-2.5 text-right text-emerald-900 dark:text-emerald-200">
                  {summary.totalChay.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-2.5 text-right text-emerald-900 dark:text-emerald-200">
                  {summary.totalChao.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-3 text-right text-base text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 border-r border-slate-200 dark:border-slate-700">
                  {summary.totalServings.toLocaleString("vi-VN")}
                </td>
                {/* Chênh lệch totals */}
                <td className="py-3 px-3 text-right text-base font-black">
                  {totalMarketServings === 0 ? (
                    <span className="text-slate-400 font-normal">-</span>
                  ) : totalComparisonDiff > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">+{totalComparisonDiff}</span>
                  ) : totalComparisonDiff < 0 ? (
                    <span className="text-blue-600 dark:text-blue-400">{totalComparisonDiff}</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">0</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right font-black text-xs">
                  {totalMarketServings === 0 ? (
                    <span className="text-slate-400 font-normal">-</span>
                  ) : totalComparisonDiff > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">+{totalDiffPct}%</span>
                  ) : totalComparisonDiff < 0 ? (
                    <span className="text-blue-600 dark:text-blue-400">{totalDiffPct}%</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">0.0%</span>
                  )}
                </td>
                <td className="py-3 px-3 text-center text-xs text-slate-400 font-normal">-</td>
                <td className="py-3 px-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      totalComparisonDiff === 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {totalComparisonDiff === 0 ? "Khớp chuẩn" : "Có biến động"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ================= BẢNG TIÊU CHUẨN ĐỊNH LƯỢNG ================= */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Chi nhánh</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Món mặn chính</th>
                <th className="py-3 px-4 text-right">Suất mặn</th>
                <th className="py-3 px-4 text-right">Suất chay</th>
                <th className="py-3 px-4 text-right">Suất cháo</th>
                <th className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                  Tổng suất
                </th>
                <th className="py-3 px-4 text-right text-amber-600">Gạo (kg)</th>
                <th className="py-3 px-4 text-right text-blue-600">Món nước (kg)</th>
                <th className="py-3 px-4 text-right text-yellow-600">Trái cây (kg)</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map((b) => {
                const isLockedCook = b.lockStatus === "LOCKED_COOK";
                const isLockedMarket = b.lockStatus === "LOCKED_MARKET";

                return (
                  <tr
                    key={b.branchId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: b.branchColor }}
                        />
                        <span>{b.branchName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {b.isHoliday ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          🏖️ Nghỉ theo lịch
                        </span>
                      ) : isLockedCook ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          <Utensils className="w-3 h-3" /> 🍽️ Chốt số ăn
                        </span>
                      ) : isLockedMarket ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          <ShoppingCart className="w-3 h-3" /> 🛒 Chốt đi chợ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 animate-pulse">
                          <Clock className="w-3 h-3" /> ⏳ Chưa chốt
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      {b.isHoliday ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold italic text-xs">
                          🏖️ {b.holidayReason || "Nghỉ theo lịch"}
                        </span>
                      ) : b.manMealType === "NUOC" ? (
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          🍜 {b.noodleName && b.noodleName !== "Món nước" && b.noodleName !== "Món Nước" ? b.noodleName : "Bánh phở"}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          🍚 Mặn Cơm
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                      {b.servingsMan.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {b.servingsChay.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-cyan-600 dark:text-cyan-400">
                      {b.servingsChao.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white text-base">
                      <div>{b.totalServings.toLocaleString("vi-VN")}</div>
                      {b.marketServings && b.marketServings.total > 0 && (
                        <div className="text-[11px] font-medium flex items-center justify-end gap-1 mt-0.5 whitespace-nowrap">
                          <span className="text-slate-400 font-normal">Chợ: {b.marketServings.total}</span>
                          {b.difference !== undefined && b.difference !== 0 ? (
                            <span
                              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                b.difference > 0
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}
                            >
                              {b.difference > 0 ? `+${b.difference}` : b.difference}
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-[10px] font-bold">Khớp</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                      {b.materials.riceKg.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      {b.manMealType === "NUOC" ? b.materials.noodleKg.toFixed(1) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-yellow-600 dark:text-yellow-400">
                      {b.materials.fruitKg.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {b.isHoliday ? (
                        <span className="text-xs text-slate-400 font-medium italic">
                          Lịch nghỉ
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          {b.lockStatus === "UNLOCKED" && (
                            <button
                              onClick={() => handleQuickStatusChange(b.branchId, "LOCKED_MARKET")}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs hover:bg-blue-100 cursor-pointer"
                              title="Chốt đi chợ"
                            >
                              Chốt đi chợ
                            </button>
                          )}
                          {b.lockStatus === "LOCKED_MARKET" && (
                            <button
                              onClick={() => handleQuickStatusChange(b.branchId, "LOCKED_COOK")}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 cursor-pointer"
                              title="Chốt số ăn"
                            >
                              Chốt số ăn
                            </button>
                          )}
                          {(b.lockStatus === "LOCKED_COOK" || b.lockStatus === "LOCKED_MARKET") && (
                            <button
                              onClick={() => handleQuickStatusChange(b.branchId, "UNLOCKED")}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-semibold text-xs hover:bg-slate-200 cursor-pointer"
                              title="Mở khóa"
                            >
                              Mở khóa
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/80 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                <td colSpan={3} className="py-3 px-4 uppercase">
                  TỔNG TOÀN TRƯỜNG
                </td>
                <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">
                  {summary.totalMan.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                  {summary.totalChay.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-4 text-right text-cyan-600 dark:text-cyan-400">
                  {summary.totalChao.toLocaleString("vi-VN")}
                </td>
                <td className="py-3 px-4 text-right text-base text-blue-600 dark:text-blue-400">
                  <div>{summary.totalServings.toLocaleString("vi-VN")}</div>
                  {totalMarketServings > 0 && (
                    <div className="text-[11px] font-medium flex items-center justify-end gap-1 mt-0.5 whitespace-nowrap">
                      <span className="text-slate-400 font-normal">Chợ: {totalMarketServings}</span>
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                          totalComparisonDiff > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : totalComparisonDiff < 0
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}
                      >
                        {totalComparisonDiff > 0
                          ? `+${totalComparisonDiff} (+${totalDiffPct}%)`
                          : totalComparisonDiff < 0
                          ? `${totalComparisonDiff} (${totalDiffPct}%)`
                          : "Khớp"}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">
                  {summary.totalRiceKg.toFixed(1)} kg
                </td>
                <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">
                  {summary.noodleTotals.map((n) => `${n.noodleName}: ${n.totalKg}kg`).join(", ") || "-"}
                </td>
                <td className="py-3 px-4 text-right text-yellow-600 dark:text-yellow-400">
                  {summary.fruitTotals.map((f) => `${f.fruitName}: ${f.totalKg}kg`).join(", ") || "-"}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
