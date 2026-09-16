"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  LayoutDashboard,
  Maximize,
  Minimize,
  Clock,
  User,
  ShieldCheck,
  Utensils,
  ArrowLeft,
  Store,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CashPos } from "@/components/admin/cash-pos";

export default function StandalonePosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Đồng hồ thời gian thực (Live Clock)
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Tải thông tin cài đặt trường học
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.SCHOOL_NAME) {
          setSchoolName(data.SCHOOL_NAME);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Bật / tắt chế độ toàn màn hình
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => console.error(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        }).catch((err) => console.error(err));
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Điều hướng nếu chưa đăng nhập
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Banknote className="h-12 w-12 text-emerald-400 animate-bounce mb-4" />
        <h2 className="text-xl font-bold">Đang tải Quầy Thu Ngân Chuyên Nghiệp...</h2>
        <p className="text-slate-400 text-sm mt-1">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  const currentUser = session?.user;
  const cashierName =
    currentUser?.name ||
    (currentUser as any)?.fullName ||
    (currentUser as any)?.username ||
    "Thu ngân";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* ================= THANH ĐIỀU HÀNH QUẦY THU (TOPBAR CHUYÊN NGHIỆP) ================= */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Cụm Trái: Thương hiệu & Tên trường */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wide text-white uppercase">
                  Quầy Thu Ngân
                </span>
                <Badge className="bg-emerald-600 text-white border-none text-[10px] font-bold px-2 py-0.5 shadow-xs">
                  POS PRO
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                {schoolName || "Hệ Thống Quản Lý Bán Trú Học Sinh"}
              </p>
            </div>
          </div>

          {/* Cụm Giữa: Đồng hồ Live & Trạng thái ca trực */}
          <div className="hidden md:flex items-center gap-4 px-4 py-1 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-400">Ca đang mở</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-mono text-sm font-bold text-white tracking-wider">{currentTime}</span>
              <span className="text-[11px] text-slate-400 capitalize">• {currentDate}</span>
            </div>
          </div>

          {/* Cụm Phải: Thu ngân trực ca, Nút Toàn màn hình & Nút QUẢN TRỊ QUAY VỀ */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Thông tin Thu ngân */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-xl border border-slate-700/40 text-xs">
              <User className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-slate-300">Trực ca:</span>
              <span className="font-bold text-white">{cashierName}</span>
            </div>

            {/* Nút Toàn Màn Hình */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 font-medium text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title={isFullscreen ? "Thu nhỏ màn hình" : "Mở rộng toàn màn hình (F11)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Toàn màn hình</span>
                </>
              )}
            </Button>

            {/* NÚT QUẢN TRỊ: QUAY VỀ TRANG QUẢN TRỊ CỦA QUYỀN THU NGÂN */}
            <Link href="/admin/billing">
              <Button
                type="button"
                className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                title="Quay về trang quản trị hóa đơn & chốt ca"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Quản trị</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ================= NỘI DUNG CHÍNH: COMPONENT QUẦY THU NGÂN TIỀN MẶT ================= */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 lg:p-6">
        <CashPos currentUser={currentUser} />
      </main>

      {/* ================= GỢI Ý PHÍM TẮT DƯỚI ĐÁY TRANG ================= */}
      <footer className="py-2 px-4 bg-slate-900 text-slate-400 text-[11px] border-t border-slate-800 text-center flex flex-wrap items-center justify-center gap-4">
        <span>
          💡 <b>Phím tắt:</b>
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 font-mono font-bold">F2</kbd> Tìm học sinh
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 font-mono font-bold">F9</kbd> Xác nhận thu tiền
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 font-mono font-bold">ESC</kbd> Đóng cửa sổ in
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">
          BAN-TRU-TLM • POS System v2.0
        </span>
      </footer>
    </div>
  );
}
