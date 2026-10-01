"use client";

import React, { useState } from "react";
import { CalendarRange, Utensils, Layers, History } from "lucide-react";
import { WeeklyMenuMatrix } from "./weekly-menu-matrix";
import { DishBankManager } from "./dish-bank-manager";
import { DishCategoryManager } from "./dish-category-manager";
import { ShowcaseHistoryView } from "./showcase-history-view";

export function MealShowcaseTab() {
  const [subTab, setSubTab] = useState<"matrix" | "dishes" | "categories" | "history">("matrix");

  return (
    <div className="space-y-4">
      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit max-w-full overflow-x-auto border border-slate-200 dark:border-slate-700 shadow-2xs">
        <button
          onClick={() => setSubTab("matrix")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            subTab === "matrix"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          <span>Lên thực đơn tuần</span>
        </button>

        <button
          onClick={() => setSubTab("dishes")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            subTab === "dishes"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Ngân hàng món ăn</span>
        </button>

        <button
          onClick={() => setSubTab("categories")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            subTab === "categories"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Cài đặt Nhóm món</span>
        </button>

        <button
          onClick={() => setSubTab("history")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            subTab === "history"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lịch sử đầy đủ</span>
        </button>
      </div>

      {/* SUB-TAB CONTENTS */}
      <div>
        {subTab === "matrix" && <WeeklyMenuMatrix />}
        {subTab === "dishes" && <DishBankManager />}
        {subTab === "categories" && <DishCategoryManager />}
        {subTab === "history" && <ShowcaseHistoryView />}
      </div>
    </div>
  );
}
