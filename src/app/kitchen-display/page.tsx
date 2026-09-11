"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProductionDisplay } from "@/components/admin/central-kitchen/production-display";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  Clock,
  ShieldCheck,
  Delete,
} from "lucide-react";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày tính bằng milliseconds

function getServingDate(transitionTime: string = "14:00"): string {
  const now = new Date();
  const [transH, transM] = (transitionTime || "14:00").split(":").map(Number);
  const nowH = now.getHours();
  const nowM = now.getMinutes();

  // Từ transition cutoff (mặc định 14:00) trở đi, tự động chuyển sang ngày phục vụ tiếp theo
  if (nowH > transH || (nowH === transH && nowM >= transM)) {
    now.setDate(now.getDate() + 1);
  }

  // Học sinh tiểu học chỉ ăn T2 - T6:
  // Nếu rơi vào Thứ Bảy (6) -> tự động chuyển sang Thứ Hai (+2)
  // Nếu rơi vào Chủ Nhật (0) -> tự động chuyển sang Thứ Hai (+1)
  if (now.getDay() === 6) {
    now.setDate(now.getDate() + 2);
  } else if (now.getDay() === 0) {
    now.setDate(now.getDate() + 1);
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function StandaloneKitchenDisplayPage() {
  const [dayTransitionTime, setDayTransitionTime] = useState<string>("14:00");
  const [date, setDate] = useState<string>(() => getServingDate("14:00"));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Passkey protection states (6 digits PIN with 7-day expiry)
  const [passkey, setPasskey] = useState<string>("");
  const [inputPasskey, setInputPasskey] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expiryNotice, setExpiryNotice] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(7);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

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
    config?: {
      marketLockTime: string;
      mealLockTime: string;
      dayTransitionTime: string;
    };
    serverTime?: string;
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

  // Tự động kiểm tra chuyển sang ngày phục vụ tiếp theo khi đến giờ chuyển ca (mặc định 14:00)
  useEffect(() => {
    const checkServingDate = () => {
      const targetDate = getServingDate(dayTransitionTime);
      setDate((prev) => (prev !== targetDate ? targetDate : prev));
    };

    checkServingDate();
    const interval = setInterval(checkServingDate, 10000);
    return () => clearInterval(interval);
  }, [dayTransitionTime]);

  // 1. Initial 7-day expiration check & key resolution
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get("key");
      const storedKey = localStorage.getItem("kitchen_display_passkey");
      const storedSavedAt = localStorage.getItem("kitchen_display_passkey_saved_at");

      const now = Date.now();

      // Kiểm tra chu kỳ 7 ngày đã hết hạn chưa
      if (storedSavedAt) {
        const savedAtTime = Number(storedSavedAt);
        const elapsed = now - savedAtTime;

        if (elapsed >= SEVEN_DAYS_MS) {
          // ĐÃ HẾT HẠN 7 NGÀY: Xóa mã lưu và khóa màn hình yêu cầu nhập lại
          localStorage.removeItem("kitchen_display_passkey");
          localStorage.removeItem("kitchen_display_passkey_saved_at");
          setIsLocked(true);
          setExpiryNotice(
            "Phiên làm việc 7 ngày đã hết hạn. Theo quy định bảo mật, vui lòng nhập lại mã PIN 6 số để tiếp tục sử dụng."
          );
          setPasskey("");
          return;
        } else {
          // Còn hạn: tính số ngày còn lại
          const remainingMs = SEVEN_DAYS_MS - elapsed;
          const remaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
          setDaysRemaining(remaining);
        }
      }

      if (urlKey) {
        // Gắn key mới từ URL: khởi tạo chu kỳ 7 ngày mới
        localStorage.setItem("kitchen_display_passkey", urlKey);
        localStorage.setItem("kitchen_display_passkey_saved_at", String(now));
        setDaysRemaining(7);
        setPasskey(urlKey);
      } else if (storedKey && storedSavedAt) {
        setPasskey(storedKey);
      }
    }
  }, []);

  // 2. Fetch data with current passkey
  const fetchData = useCallback(
    async (overrideKey?: string) => {
      const keyToUse = overrideKey !== undefined ? overrideKey : passkey;
      try {
        setError(null);
        setAuthError(null);

        const url = `/api/central-kitchen/daily?date=${date}${
          keyToUse ? `&key=${encodeURIComponent(keyToUse)}` : ""
        }`;

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (res.status === 401 && json.requirePasskey) {
          setIsLocked(true);
          setLoading(false);
          return false;
        }

        if (!res.ok) {
          throw new Error(json.error || "Không thể tải dữ liệu điều hành bếp");
        }

        setDailyData(json);
        if (
          json.config?.dayTransitionTime &&
          json.config.dayTransitionTime !== dayTransitionTime
        ) {
          setDayTransitionTime(json.config.dayTransitionTime);
        }
        setIsLocked(false);
        return true;
      } catch (err: any) {
        console.error("TV Display fetch error:", err);
        setError(err.message || "Mất kết nối máy chủ");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [date, passkey]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. 5-second background polling if unlocked
  useEffect(() => {
    if (isLocked) return;
    const timer = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchData, isLocked]);

  // 4. Verify 6-digit PIN code & reset 7-day counter
  const verifyPin = useCallback(
    async (pinToVerify: string) => {
      const clean = pinToVerify.trim();
      if (clean.length !== 6) return;

      setIsVerifying(true);
      setAuthError(null);

      const success = await fetchData(clean);
      setIsVerifying(false);

      if (success) {
        setPasskey(clean);
        setDaysRemaining(7);
        setExpiryNotice(null);
        if (typeof window !== "undefined") {
          // Lưu mã PIN kèm mốc thời gian hiện tại để đếm đủ 7 ngày
          localStorage.setItem("kitchen_display_passkey", clean);
          localStorage.setItem("kitchen_display_passkey_saved_at", String(Date.now()));
        }
      } else {
        setAuthError("Mã PIN 6 số không chính xác! Vui lòng thử lại.");
        setInputPasskey("");
      }
    },
    [fetchData]
  );

  // Auto verify when 6 digits are reached
  useEffect(() => {
    if (isLocked && inputPasskey.length === 6) {
      verifyPin(inputPasskey);
    }
  }, [inputPasskey, isLocked, verifyPin]);

  // Keyboard listener for physical keyboard or TV remote number buttons
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        setInputPasskey((prev) => (prev.length < 6 ? prev + e.key : prev));
      } else if (e.key === "Backspace") {
        setInputPasskey((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setInputPasskey("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked]);

  const handleKeypadPress = (val: string) => {
    if (val === "BACKSPACE") {
      setInputPasskey((prev) => prev.slice(0, -1));
    } else if (val === "CLEAR") {
      setInputPasskey("");
    } else {
      setInputPasskey((prev) => (prev.length < 6 ? prev + val : prev));
    }
  };

  const handleRelock = () => {
    if (confirm("Bạn có muốn đăng xuất và khóa màn hình này lại không?")) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("kitchen_display_passkey");
        localStorage.removeItem("kitchen_display_passkey_saved_at");
      }
      setPasskey("");
      setInputPasskey("");
      setDaysRemaining(0);
      setIsLocked(true);
    }
  };

  // RENDER: 6-DIGIT PIN LOCK SCREEN WITH 7-DAY NOTICE
  if (isLocked) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />

        <div className="max-w-md w-full bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center animate-in fade-in zoom-in-95">
          {/* Logo & Lock Badge */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
            <KeyRound className="w-8 h-8" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-red-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">
            BẾP TRUNG TÂM
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5" /> Chu kỳ bảo mật 7 ngày
          </div>

          {/* Expiry Notice if 7 days elapsed */}
          {expiryNotice ? (
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold mb-4 leading-relaxed text-left flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{expiryNotice}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Vui lòng nhập <strong>mã PIN 6 số</strong> do Quản trị viên (Admin) cấp để mở khóa màn hình điều hành Bếp.
            </p>
          )}

          {/* 6 VISUAL PIN BOXES */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 my-4">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const char = inputPasskey[index];
              const isFilled = char !== undefined;
              const isCurrent = inputPasskey.length === index;

              return (
                <div
                  key={index}
                  className={`w-11 h-13 sm:w-12 sm:h-14 rounded-2xl flex items-center justify-center text-2xl font-mono font-black border-2 transition-all ${
                    isFilled
                      ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20"
                      : isCurrent
                      ? "border-amber-500 bg-slate-800 animate-pulse text-white shadow-sm"
                      : "border-slate-700 bg-slate-950/60 text-slate-500"
                  }`}
                >
                  {isFilled ? (showPassword ? char : "●") : ""}
                </div>
              );
            })}
          </div>

          {/* Toggle visibility */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition"
            >
              {showPassword ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Ẩn số PIN
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Hiện số PIN
                </>
              )}
            </button>
          </div>

          {/* Error notice */}
          {authError && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-bold flex items-center gap-2 mb-3 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          {isVerifying && (
            <div className="p-2.5 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang kiểm tra mã PIN...</span>
            </div>
          )}

          {/* Touch numeric keypad for Smart TV remote / Tablets */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Bàn phím cảm ứng (Dành cho Smart TV / Máy tính bảng)
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleKeypadPress(num)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-black text-xl transition shadow-sm disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleKeypadPress("CLEAR")}
                className="py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:bg-slate-600 text-slate-400 font-bold text-xs transition disabled:opacity-50"
              >
                Xóa hết
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleKeypadPress("0")}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-black text-xl transition shadow-sm disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleKeypadPress("BACKSPACE")}
                className="py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:bg-slate-600 text-amber-400 font-bold text-xs transition flex items-center justify-center disabled:opacity-50"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: LOADING STATE
  if (loading && dailyData.branches.length === 0) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-6 animate-pulse">
          <svg
            width="36"
            height="36"
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
        <h1 className="text-3xl font-black tracking-tight mb-2">BẾP TRUNG TÂM</h1>
        <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase mb-6">
          Đang khởi tạo màn hình TV điều hành sản xuất...
        </p>
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // RENDER: FULLSCREEN PRODUCTION DASHBOARD
  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col overflow-hidden relative">
      {error && (
        <div className="bg-red-600 text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Cảnh báo mất kết nối: {error} (Đang tự động thử lại...)</span>
          </div>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1 bg-red-700 px-2 py-0.5 rounded text-[11px] hover:bg-red-800"
          >
            <RefreshCw className="w-3 h-3" /> Thử lại ngay
          </button>
        </div>
      )}

      {/* Floating 7-day Security Pill at bottom-left */}
      <div className="fixed bottom-3 left-4 z-40 flex items-center gap-2 bg-slate-900/85 border border-slate-800 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-xs text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          Bảo mật: Phiên 7 ngày (Còn <strong>{daysRemaining} ngày</strong>)
        </span>
      </div>

      {/* Subtle Lock Button at bottom-right corner to allow logging out */}
      <button
        onClick={handleRelock}
        className="fixed bottom-3 right-3 z-50 opacity-25 hover:opacity-100 transition-opacity p-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white"
        title="Khóa lại màn hình / Đổi mã PIN"
      >
        <Lock className="w-4 h-4" />
      </button>

      <div className="flex-1 w-full h-screen">
        <ProductionDisplay
          date={date}
          onDateChange={setDate}
          branches={dailyData.branches}
          summary={dailyData.summary}
          refreshData={async () => {
            await fetchData();
          }}
          ricePortionG={dailyData.ingredients?.ricePortionG || 150}
          hideDateControls={true}
          mealLockTime={dailyData.config?.mealLockTime || "08:00"}
        />
      </div>
    </div>
  );
}
