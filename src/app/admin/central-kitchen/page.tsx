"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";
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
  ExternalLink,
  Copy,
  QrCode,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProductionDisplay } from "@/components/admin/central-kitchen/production-display";
import { DailyEntryForm } from "@/components/admin/central-kitchen/daily-entry-form";
import { DailySummaryTable } from "@/components/admin/central-kitchen/daily-summary-table";
import { BranchManager } from "@/components/admin/central-kitchen/branch-manager";
import { IngredientManager } from "@/components/admin/central-kitchen/ingredient-manager";
import { PasskeyManager } from "@/components/admin/central-kitchen/passkey-manager";
import { toast } from "@/lib/toast";

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

  // TV link and QR code modal states
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [currentPasskey, setCurrentPasskey] = useState<string>("123456");
  const [fullDisplayUrl, setFullDisplayUrl] = useState<string>("https://bantrutlm.com/kitchen-display?key=123456");

  useEffect(() => {
    const origin =
      typeof window !== "undefined" && window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : "https://bantrutlm.com";
    const url = `${origin}/kitchen-display?key=${currentPasskey}`;
    setFullDisplayUrl(url);
    QRCode.toDataURL(url, { width: 280, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [currentPasskey]);

  const handleCopyTvLink = () => {
    if (!fullDisplayUrl) return;
    navigator.clipboard.writeText(fullDisplayUrl);
    toast.success("Đã sao chép link màn hình TV vào bộ nhớ tạm!");
  };

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
        <TabsContent value="production" className="mt-4 space-y-4 outline-none">
          {/* TV LINK & SHARING ACTION BANNER */}
          <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-4 rounded-2xl border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                  <span>Màn hình Tivi xưởng bếp:</span>
                  <code className="px-2.5 py-0.5 rounded-lg bg-black/50 text-emerald-400 font-mono text-xs border border-emerald-500/30">
                    {fullDisplayUrl || "/kitchen-display"}
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                  <span>
                    🔑 Mã PIN bảo mật: <strong className="text-amber-400 font-mono text-sm tracking-widest">{currentPasskey}</strong>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    ⏱️ Chu kỳ xác thực: <strong>7 ngày / lần</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                onClick={handleCopyTvLink}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition active:scale-95"
              >
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                Sao chép link
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-400" />
                Mã QR Tivi
              </button>

              <a
                href="/kitchen-display"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở link TV riêng ↗
              </a>
            </div>
          </div>

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
            <PasskeyManager
              initialPasskey={currentPasskey}
              onPasskeyUpdated={(newKey) => {
                setCurrentPasskey(newKey);
                fetchData();
              }}
              userRole={userRole}
            />
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

      {/* QR CODE MODAL FOR TV / MOBILE */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              Quét Mã Mở Trên TV / Điện Thoại
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Dùng camera điện thoại hoặc máy tính bảng để quét mã truy cập nhanh màn hình điều hành Bếp
            </p>

            {/* QR Image */}
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 inline-block shadow-inner mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code TV Kitchen"
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Đang tạo mã QR...
                </div>
              )}
            </div>

            <div className="space-y-2 text-left bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs mb-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Mã PIN bảo vệ (6 số):</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm tracking-widest">{currentPasskey}</span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ⏱️ Chu kỳ bảo mật: Tự động yêu cầu nhập lại mã sau <strong>7 ngày</strong>.
              </div>
              <ol className="list-decimal list-inside text-slate-600 dark:text-slate-400 space-y-1 pt-1">
                <li>Mã QR trên đã đính kèm sẵn mã PIN, quét là xem được ngay.</li>
                <li>Nếu nhập thủ công trên TV: Mở <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">https://bantrutlm.com/kitchen-display</span> và gõ 6 số <strong>{currentPasskey}</strong>.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyTvLink}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                Sao chép liên kết
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
