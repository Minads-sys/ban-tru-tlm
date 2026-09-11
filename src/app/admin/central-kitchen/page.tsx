"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Tv,
  FileEdit,
  TableProperties,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Utensils,
  AlertCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProductionDisplay } from "@/components/admin/central-kitchen/production-display";
import { DailyEntryForm } from "@/components/admin/central-kitchen/daily-entry-form";
import { DailySummaryTable } from "@/components/admin/central-kitchen/daily-summary-table";
import { BranchManager } from "@/components/admin/central-kitchen/branch-manager";
import { IngredientManager } from "@/components/admin/central-kitchen/ingredient-manager";

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CentralKitchenPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [date, setDate] = useState<string>(getTodayString());
  const [activeTab, setActiveTab] = useState<string>("entry");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Daily API data
  const [dailyData, setDailyData] = useState<{
    branches: any[];
    summary: {
      totalServings: number;
      totalMan: number;
      totalChao: number;
      totalChay: number;
      totalRiceKg: number;
      noodleTotals: any[];
      fruitTotals: any[];
    };
    ingredients: {
      ricePortionG: number;
      rice: any;
      noodles: any[];
      fruits: any[];
    };
  }>({
    branches: [],
    summary: {
      totalServings: 0,
      totalMan: 0,
      totalChao: 0,
      totalChay: 0,
      totalRiceKg: 0,
      noodleTotals: [],
      fruitTotals: [],
    },
    ingredients: {
      ricePortionG: 150,
      rice: null,
      noodles: [],
      fruits: [],
    },
  });

  // Settings data
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [dailyRes, branchesRes, ingredientsRes] = await Promise.all([
        fetch(`/api/central-kitchen/daily?date=${date}`),
        fetch(`/api/central-kitchen/branches?includeInactive=true`),
        fetch(`/api/central-kitchen/ingredients?includeInactive=true`),
      ]);

      if (!dailyRes.ok) throw new Error("Lỗi tải dữ liệu bếp ngày");
      const dailyJson = await dailyRes.json();
      setDailyData(dailyJson);

      if (branchesRes.ok) {
        const branchesJson = await branchesRes.json();
        setAllBranches(branchesJson.branches || []);
      }

      if (ingredientsRes.ok) {
        const ingredientsJson = await ingredientsRes.json();
        setAllIngredients(ingredientsJson.ingredients || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changeDateByDays = (days: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + days);
    const newY = curr.getFullYear();
    const newM = String(curr.getMonth() + 1).padStart(2, "0");
    const newD = String(curr.getDate()).padStart(2, "0");
    setDate(`${newY}-${newM}-${newD}`);
  };

  const isSettingsAllowed =
    userRole === "ADMIN" || userRole === "BOARDING_MANAGER";

  return (
    <div className="space-y-4">
      {/* PAGE HEADER & TABS NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              BẾP TRUNG TÂM
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                4 Chi Nhánh
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Quản lý báo cáo suất ăn, quy đổi nguyên liệu (Gạo, Bún/Phở, Trái cây) và hiển thị điều hành
            </p>
          </div>
        </div>

        {/* DATE PICKER & REFRESH (Only visible outside TV mode or accessible everywhere) */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Hôm qua"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white border-0 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => changeDateByDays(1)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Ngày mai"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* MAIN NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-auto border border-slate-200 dark:border-slate-700">
          <TabsTrigger
            value="entry"
            className="flex items-center gap-2 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm rounded-lg"
          >
            <FileEdit className="w-4 h-4 text-blue-600" />
            Nhập số liệu
          </TabsTrigger>
          <TabsTrigger
            value="production"
            className="flex items-center gap-2 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm rounded-lg"
          >
            <Tv className="w-4 h-4 text-amber-500" />
            Màn hình TV
          </TabsTrigger>
          <TabsTrigger
            value="table"
            className="flex items-center gap-2 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm rounded-lg"
          >
            <TableProperties className="w-4 h-4 text-emerald-600" />
            Bảng tổng hợp
          </TabsTrigger>
          {isSettingsAllowed && (
            <TabsTrigger
              value="settings"
              className="flex items-center gap-2 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm rounded-lg"
            >
              <Settings className="w-4 h-4 text-purple-600" />
              Cài đặt
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: DAILY ENTRY (Mobile Touch & Desktop Form) */}
        <TabsContent value="entry" className="mt-4 outline-none">
          <DailyEntryForm
            date={date}
            branches={dailyData.branches}
            ingredients={dailyData.ingredients}
            userRole={userRole}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* TAB 2: PRODUCTION DISPLAY (TV 16:9 45-INCH FULLSCREEN) */}
        <TabsContent value="production" className="mt-4 outline-none">
          <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <ProductionDisplay
              date={date}
              onDateChange={setDate}
              branches={dailyData.branches}
              summary={dailyData.summary}
              refreshData={fetchData}
              ricePortionG={dailyData.ingredients.ricePortionG}
            />
          </div>
        </TabsContent>

        {/* TAB 3: DAILY SUMMARY TABLE */}
        <TabsContent value="table" className="mt-4 outline-none">
          <DailySummaryTable
            date={date}
            branches={dailyData.branches}
            summary={dailyData.summary}
            userRole={userRole}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* TAB 4: SETTINGS (ADMIN & MANAGER) */}
        {isSettingsAllowed && (
          <TabsContent value="settings" className="mt-4 space-y-6 outline-none">
            <IngredientManager
              ingredients={allIngredients}
              onRefresh={fetchData}
              userRole={userRole}
            />
            <BranchManager
              branches={allBranches}
              onRefresh={fetchData}
              userRole={userRole}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
