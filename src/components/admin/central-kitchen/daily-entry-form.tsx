"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Save,
  ChevronDown,
  ArrowDown,
  Info,
  ShoppingCart,
  Flame,
  Clock,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/lib/toast";

interface IngredientOption {
  id: string;
  code: string;
  name: string;
  category: string;
  quantityPerServing: number;
  unit: string;
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
}

interface DailyEntryFormProps {
  date: string;
  branches: BranchCardData[];
  ingredients: {
    ricePortionG: number;
    rice: IngredientOption | null;
    noodles: IngredientOption[];
    fruits: IngredientOption[];
  };
  userRole?: string;
  onRefresh: () => Promise<void>;
  onResetDay?: () => void;
}

export function DailyEntryForm({
  date,
  branches,
  ingredients,
  userRole,
  onRefresh,
  onResetDay,
}: DailyEntryFormProps) {
  // Local form state mapped by branchId
  const [formValues, setFormValues] = useState<
    Record<
      string,
      {
        servingsMan: number;
        servingsChao: number;
        servingsChay: number;
        manMealType: "COM" | "NUOC";
        noodleId: string;
        noodleName: string;
        fruitId: string;
        fruitName: string;
        note: string;
        lockStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK";
      }
    >
  >({});

  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [activeFilterBranchId, setActiveFilterBranchId] = useState<string | null>(null);

  // Sync initial branches data to local state
  useEffect(() => {
    const initial: typeof formValues = {};
    const defaultNoodle = ingredients.noodles[0];
    const defaultFruit = ingredients.fruits[0];

    branches.forEach((b) => {
      const noodleObj =
        ingredients.noodles.find((n) => n.id === b.noodleId) || defaultNoodle;
      const fruitObj =
        ingredients.fruits.find((f) => f.id === b.fruitId) || defaultFruit;

      const noodleName =
        b.noodleName &&
        b.noodleName !== "Món nước" &&
        b.noodleName !== "Món Nước"
          ? b.noodleName
          : noodleObj?.name || "Bánh phở";
      const noodleId = b.noodleId || noodleObj?.id || "";

      const fruitName =
        b.fruitName || fruitObj?.name || "Ổi";
      const fruitId = b.fruitId || fruitObj?.id || "";

      initial[b.branchId] = {
        servingsMan: b.servingsMan || 0,
        servingsChao: b.servingsChao || 0,
        servingsChay: b.servingsChay || 0,
        manMealType: b.manMealType || "COM",
        noodleId,
        noodleName,
        fruitId,
        fruitName,
        note: b.note || "",
        lockStatus: b.lockStatus || "UNLOCKED",
      };
    });
    setFormValues(initial);
  }, [branches, ingredients]);

  const updateField = (
    branchId: string,
    field: string,
    value: any
  ) => {
    setFormValues((prev) => {
      const current = prev[branchId] || {
        servingsMan: 0,
        servingsChao: 0,
        servingsChay: 0,
        manMealType: "COM",
        noodleId: ingredients.noodles[0]?.id || "",
        noodleName: ingredients.noodles[0]?.name || "",
        fruitId: ingredients.fruits[0]?.id || "",
        fruitName: ingredients.fruits[0]?.name || "",
        note: "",
        lockStatus: "UNLOCKED",
      };

      const updated = { ...current, [field]: value };

      // Auto update names if noodleId or fruitId changed
      if (field === "noodleId") {
        const found = ingredients.noodles.find((n) => n.id === value);
        if (found) updated.noodleName = found.name;
      }
      if (field === "fruitId") {
        const found = ingredients.fruits.find((f) => f.id === value);
        if (found) updated.fruitName = found.name;
      }

      return { ...prev, [branchId]: updated };
    });
  };

  const adjustNumber = (
    branchId: string,
    field: "servingsMan" | "servingsChao" | "servingsChay",
    delta: number
  ) => {
    const currentVal = formValues[branchId]?.[field] || 0;
    const newVal = Math.max(0, currentVal + delta);
    updateField(branchId, field, newVal);
  };

  // Save single branch
  const handleSaveBranch = async (branchId: string) => {
    const data = formValues[branchId];
    if (!data) return;

    setSavingBranchId(branchId);
    try {
      const res = await fetch("/api/central-kitchen/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          branchId,
          ...data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Lỗi lưu dữ liệu");
      }

      toast.success("Đã lưu số liệu chi nhánh thành công!");
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu chi nhánh");
    } finally {
      setSavingBranchId(null);
    }
  };

  // Save all branches
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const b of branches) {
      const data = formValues[b.branchId];
      if (!data) continue;

      try {
        const res = await fetch("/api/central-kitchen/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            branchId: b.branchId,
            ...data,
          }),
        });

        if (res.ok) successCount++;
        else errorCount++;
      } catch (e) {
        errorCount++;
      }
    }

    setIsSavingAll(false);
    if (errorCount === 0) {
      toast.success(`Đã lưu thành công cả ${successCount} chi nhánh!`);
    } else {
      toast.warning(`Đã lưu ${successCount} chi nhánh, ${errorCount} chi nhánh gặp sự cố`);
    }
    await onRefresh();
  };

  // Update lock status
  const handleStatusChange = async (
    branchId: string,
    newStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK"
  ) => {
    const data = formValues[branchId];
    try {
      const res = await fetch("/api/central-kitchen/daily", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          branchId,
          ...data,
          lockStatus: newStatus,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Lỗi cập nhật trạng thái");
      }

      updateField(branchId, "lockStatus", newStatus);
      toast.success(`Đã chuyển trạng thái sang: ${getStatusLabel(newStatus)}`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật trạng thái");
    }
  };

  // Batch lock/unlock all branches
  const handleBatchLock = async (status: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK") => {
    if (!confirm(`Bạn có chắc chắn muốn chuyển TẤT CẢ chi nhánh sang trạng thái "${getStatusLabel(status)}"?`)) {
      return;
    }

    try {
      const res = await fetch("/api/central-kitchen/daily", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          allBranches: true,
          lockStatus: status,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Lỗi cập nhật");

      toast.success(resData.message || "Cập nhật thành công");
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật hàng loạt");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "LOCKED_COOK":
        return "🍽️ Chốt số ăn";
      case "LOCKED_MARKET":
        return "🛒 Chốt đi chợ";
      default:
        return "⏳ Chưa chốt";
    }
  };

  // Find missing branches
  const missingBranches = branches.filter((b) => {
    const val = formValues[b.branchId];
    const total = (val?.servingsMan || 0) + (val?.servingsChao || 0) + (val?.servingsChay || 0);
    return !b.hasEntry || total === 0 || val?.lockStatus === "UNLOCKED";
  });

  const displayedBranches = activeFilterBranchId
    ? branches.filter((b) => b.branchId === activeFilterBranchId)
    : branches;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16 overflow-x-hidden">
      {/* 1. WARNING STRIP: MISSING BRANCHES (Mobile & Desktop) */}
      {missingBranches.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-3 sm:p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-sm sm:text-base">
              Cảnh báo: Có {missingBranches.length} chi nhánh chưa chốt số liệu hoặc có 0 suất!
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {missingBranches.map((mb) => (
              <button
                key={mb.branchId}
                onClick={() => {
                  setActiveFilterBranchId(mb.branchId);
                  const el = document.getElementById(`branch-card-${mb.branchId}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/50 bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 transition shadow-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: mb.branchColor || "#eab308" }}
                />
                {mb.branchName}
                <span className="text-[10px] opacity-75 font-normal">
                  (Chưa xong)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. QUICK-JUMP BRANCH PILLS & BATCH ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Quick jump pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilterBranchId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              activeFilterBranchId === null
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Tất cả ({branches.length})
          </button>
          {branches.map((b) => {
            const val = formValues[b.branchId];
            const total =
              (val?.servingsMan || 0) +
              (val?.servingsChao || 0) +
              (val?.servingsChay || 0);

            return (
              <button
                key={b.branchId}
                onClick={() => setActiveFilterBranchId(b.branchId)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  activeFilterBranchId === b.branchId
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: b.branchColor }}
                />
                {b.branchCode}
                <span className="text-[11px] opacity-80">
                  {total.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global actions: Save All & Batch Lock */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {userRole === "ADMIN" && (
            <div className="relative inline-block text-left">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchLock(e.target.value as any);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 focus:outline-none"
              >
                <option value="" disabled>
                  ⚡ Khóa hàng loạt...
                </option>
                <option value="UNLOCKED">⏳ Mở tất cả (Chưa chốt)</option>
                <option value="LOCKED_MARKET">🛒 Chốt đi chợ tất cả</option>
                <option value="LOCKED_COOK">🍽️ Chốt số ăn tất cả</option>
              </select>
            </div>
          )}

          <button
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSavingAll ? "Đang lưu..." : "Lưu tất cả"}
          </button>

          {(userRole === "ADMIN" || userRole === "BOARDING_MANAGER") && onResetDay && (
            <button
              onClick={onResetDay}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold border border-red-200 dark:border-red-800/60 transition cursor-pointer"
              title="Đặt lại toàn bộ số liệu ngày này về 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại ngày</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. BRANCH ENTRY CARDS */}
      <div className="space-y-4">
        {displayedBranches.map((branch) => {
          const val = formValues[branch.branchId] || {
            servingsMan: 0,
            servingsChao: 0,
            servingsChay: 0,
            manMealType: "COM",
            noodleId: ingredients.noodles[0]?.id || "",
            noodleName: ingredients.noodles[0]?.name || "",
            fruitId: ingredients.fruits[0]?.id || "",
            fruitName: ingredients.fruits[0]?.name || "",
            note: "",
            lockStatus: "UNLOCKED",
          };

          const totalServings =
            val.servingsMan + val.servingsChao + val.servingsChay;

          // Material calculations
          const ricePortion = ingredients.ricePortionG || 150;
          const selectedNoodle = ingredients.noodles.find(
            (n) => n.id === val.noodleId
          );
          const noodlePortion = selectedNoodle?.quantityPerServing || 200;
          const selectedFruit = ingredients.fruits.find(
            (f) => f.id === val.fruitId
          );
          const fruitPortion = selectedFruit?.quantityPerServing || 150;

          let riceKg = 0;
          let noodleKg = 0;
          if (val.manMealType === "COM") {
            riceKg = ((val.servingsMan + val.servingsChay) * ricePortion) / 1000;
          } else {
            riceKg = (val.servingsChay * ricePortion) / 1000;
            noodleKg = (val.servingsMan * noodlePortion) / 1000;
          }
          const fruitKg = (totalServings * fruitPortion) / 1000;

          const isLocked =
            val.lockStatus === "LOCKED_COOK" && userRole !== "ADMIN";
          const isSavingThis = savingBranchId === branch.branchId;

          return (
            <div
              key={branch.branchId}
              id={`branch-card-${branch.branchId}`}
              className="bg-white dark:bg-slate-900 rounded-2xl border-2 shadow-sm transition-all overflow-hidden"
              style={{ borderColor: `${branch.branchColor}40` }}
            >
              {/* 2-TIER CARD HEADER (Strict Anti-Overflow Design) */}
              <div
                className="p-3 sm:p-4 text-white"
                style={{
                  background: `linear-gradient(135deg, ${branch.branchColor}dd, ${branch.branchColor})`,
                }}
              >
                {/* TIER 1: Branch Title + Total Servings */}
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow shrink-0" />
                    <h3 className="text-base sm:text-xl font-black uppercase tracking-wider truncate">
                      {branch.branchName}
                    </h3>
                  </div>

                  {/* Total Servings Badge */}
                  <div className="flex items-baseline gap-1 bg-black/25 px-3 py-1 rounded-xl shrink-0 shadow-inner">
                    <span className="text-xl sm:text-2xl font-black text-white">
                      {totalServings.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs font-semibold opacity-85">suất</span>
                  </div>
                </div>

                {/* TIER 2: Lock Status Selector / Transition Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold opacity-80">
                      Trạng thái:
                    </span>
                    <select
                      value={val.lockStatus}
                      onChange={(e) =>
                        handleStatusChange(branch.branchId, e.target.value as any)
                      }
                      disabled={isLocked}
                      aria-label="Trạng thái chốt số liệu"
                      className={`text-xs font-black px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        val.lockStatus === "LOCKED_COOK"
                          ? "bg-emerald-500/90 text-white border-emerald-300"
                          : val.lockStatus === "LOCKED_MARKET"
                          ? "bg-blue-500/90 text-white border-blue-300"
                          : "bg-red-500/90 text-white border-red-300 animate-pulse"
                      }`}
                    >
                      <option value="UNLOCKED" className="bg-slate-900 text-white">
                        ⏳ Chưa chốt
                      </option>
                      <option
                        value="LOCKED_MARKET"
                        className="bg-slate-900 text-white"
                      >
                        🛒 Chốt đi chợ
                      </option>
                      <option value="LOCKED_COOK" className="bg-slate-900 text-white">
                        🍽️ Chốt số ăn
                      </option>
                    </select>
                  </div>

                  {/* Save button for this branch */}
                  <button
                    onClick={() => handleSaveBranch(branch.branchId)}
                    disabled={isSavingThis || isLocked}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 active:scale-95 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingThis ? "Đang lưu..." : "Lưu chi nhánh"}
                  </button>
                </div>
              </div>

              {/* CARD BODY: INPUTS & STEPPERS */}
              <div className="p-3 sm:p-5 space-y-4">
                {/* 1. Meal Type Selection: Mặn Cơm vs Mặn Nước */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Món Mặn Chính:
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      (Có thể chọn Cơm hoặc Món Nước độc lập cho từng chi nhánh)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => updateField(branch.branchId, "manMealType", "COM")}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition ${
                        val.manMealType === "COM"
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      🍚 Mặn Cơm
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        const currNoodleId = val.noodleId || ingredients.noodles[0]?.id || "";
                        const foundNoodle =
                          ingredients.noodles.find((n) => n.id === currNoodleId) ||
                          ingredients.noodles[0];
                        setFormValues((prev) => ({
                          ...prev,
                          [branch.branchId]: {
                            ...(prev[branch.branchId] || val),
                            manMealType: "NUOC",
                            noodleId: foundNoodle?.id || currNoodleId,
                            noodleName: foundNoodle?.name || "Bánh phở",
                          },
                        }));
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition ${
                        val.manMealType === "NUOC"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 cursor-pointer"
                      }`}
                    >
                      🍜 Mặn Nước (Bún/Phở)
                    </button>
                  </div>

                  {/* If Mặn Nước: Noodle Selector */}
                  {val.manMealType === "NUOC" && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1.5">
                        Chọn loại nguyên liệu món nước:
                      </label>
                      <select
                        value={val.noodleId || ingredients.noodles[0]?.id || ""}
                        disabled={isLocked}
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          const found = ingredients.noodles.find((n) => n.id === chosenId);
                          setFormValues((prev) => ({
                            ...prev,
                            [branch.branchId]: {
                              ...(prev[branch.branchId] || val),
                              noodleId: chosenId,
                              noodleName: found?.name || "Bánh phở",
                            },
                          }));
                        }}
                        className="w-full text-xs sm:text-sm font-semibold p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                      >
                        {ingredients.noodles.map((noodle) => (
                          <option key={noodle.id} value={noodle.id}>
                            🍜 {noodle.name} ({noodle.quantityPerServing}g/suất)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Stepper Inputs: Mặn, Chay, Cháo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* MẶN */}
                  <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase">
                        {val.manMealType === "NUOC" ? "🍜 Mặn Nước" : "🍚 Suất Mặn"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsMan", -10)}
                        className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsMan", -1)}
                        className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        disabled={isLocked}
                        value={val.servingsMan}
                        onChange={(e) =>
                          updateField(
                            branch.branchId,
                            "servingsMan",
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-16 sm:w-20 text-center font-black text-lg py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsMan", 1)}
                        className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsMan", 10)}
                        className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* CHAY */}
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase">
                        🥬 Suất Chay
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChay", -10)}
                        className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChay", -1)}
                        className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        disabled={isLocked}
                        value={val.servingsChay}
                        onChange={(e) =>
                          updateField(
                            branch.branchId,
                            "servingsChay",
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-16 sm:w-20 text-center font-black text-lg py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChay", 1)}
                        className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChay", 10)}
                        className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* CHÁO */}
                  <div className="bg-cyan-500/5 p-3 rounded-xl border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-cyan-700 dark:text-cyan-300 uppercase">
                        🍲 Suất Cháo
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChao", -10)}
                        className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChao", -1)}
                        className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        disabled={isLocked}
                        value={val.servingsChao}
                        onChange={(e) =>
                          updateField(
                            branch.branchId,
                            "servingsChao",
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-16 sm:w-20 text-center font-black text-lg py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChao", 1)}
                        className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => adjustNumber(branch.branchId, "servingsChao", 10)}
                        className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 font-bold text-xs flex items-center justify-center transition"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Fruit selector & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Trái cây tráng miệng:
                    </label>
                    <select
                      value={val.fruitId}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateField(branch.branchId, "fruitId", e.target.value)
                      }
                      className="w-full text-xs sm:text-sm font-semibold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ingredients.fruits.map((fruit) => (
                        <option key={fruit.id} value={fruit.id}>
                          🍌 {fruit.name} ({fruit.quantityPerServing}g/suất)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ghi chú / Lưu ý nấu:
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="Ghi chú thêm cho bếp..."
                      value={val.note}
                      onChange={(e) => updateField(branch.branchId, "note", e.target.value)}
                      className="w-full text-xs sm:text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. AUTO-CALCULATED MATERIALS SUMMARY BOX (Responsive & Clean) */}
                <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Dự toán xuất kho:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-semibold">
                    {/* GẠO */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 dark:text-slate-400">
                        {val.manMealType === "COM" ? "🌾 Gạo:" : "🌾 Gạo (Chay):"}
                      </span>
                      <span className="font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base">
                        {riceKg.toFixed(1)} kg
                      </span>
                    </div>

                    {/* MÓN NƯỚC (if NUOC) */}
                    {val.manMealType === "NUOC" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 dark:text-slate-400">
                          🍜 {selectedNoodle?.name || (val.noodleName && val.noodleName !== "Món nước" && val.noodleName !== "Món Nước" ? val.noodleName : "Bánh phở")}:
                        </span>
                        <span className="font-black text-blue-600 dark:text-blue-400 text-sm sm:text-base">
                          {noodleKg.toFixed(1)} kg
                        </span>
                      </div>
                    )}

                    {/* TRÁI CÂY */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 dark:text-slate-400">
                        🍌 {val.fruitName || "Trái cây"}:
                      </span>
                      <span className="font-black text-yellow-600 dark:text-yellow-400 text-sm sm:text-base">
                        {fruitKg.toFixed(1)} kg
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
