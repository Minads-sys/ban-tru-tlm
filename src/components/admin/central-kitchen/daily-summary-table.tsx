"use client";

import React from "react";
import { Lock, Unlock, ShoppingCart, Flame, Clock } from "lucide-react";
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
  noodleId: string | null;
  noodleName: string;
  noodlePortionG: number;
  fruitId: string | null;
  fruitName: string;
  fruitPortionG: number;
  lockStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK";
  note?: string;
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

export function DailySummaryTable({
  date,
  branches,
  summary,
  userRole,
  onRefresh,
}: DailySummaryTableProps) {
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Bảng Tổng Hợp Chi Tiết Chi Nhánh
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Xem đối soát toàn bộ 4 chi nhánh theo thời gian thực
          </p>
        </div>
      </div>

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
                    {isLockedCook ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        <Flame className="w-3 h-3" /> 🔥 Chốt nấu
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
                    {b.manMealType === "NUOC" ? (
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        🍜 {b.noodleName || "Món Nước"}
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
                    {b.totalServings.toLocaleString("vi-VN")}
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
                    <div className="inline-flex items-center gap-1">
                      {b.lockStatus === "UNLOCKED" && (
                        <button
                          onClick={() => handleQuickStatusChange(b.branchId, "LOCKED_MARKET")}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs hover:bg-blue-100"
                          title="Chốt đi chợ"
                        >
                          Chốt đi chợ
                        </button>
                      )}
                      {b.lockStatus === "LOCKED_MARKET" && (
                        <button
                          onClick={() => handleQuickStatusChange(b.branchId, "LOCKED_COOK")}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100"
                          title="Chốt nấu"
                        >
                          Chốt nấu
                        </button>
                      )}
                      {(b.lockStatus === "LOCKED_COOK" || b.lockStatus === "LOCKED_MARKET") && (
                        <button
                          onClick={() => handleQuickStatusChange(b.branchId, "UNLOCKED")}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-semibold text-xs hover:bg-slate-200"
                          title="Mở khóa"
                        >
                          Mở khóa
                        </button>
                      )}
                    </div>
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
                {summary.totalServings.toLocaleString("vi-VN")}
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
    </div>
  );
}
