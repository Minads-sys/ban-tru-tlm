"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Building,
  Phone,
  Maximize2,
  Clock,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
  Share2,
  Check,
} from "lucide-react";

function getTodayVN(): string {
  try {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    return d.toISOString().split("T")[0];
  }
}

export default function CongKhaiSuatAnPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayVN());
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [recent7Days, setRecent7Days] = useState<any[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const touchStartXRef = useRef<number | null>(null);

  // Fetch dữ liệu suất ăn của ngày được chọn
  const fetchMealData = async (dateStr: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/daily-showcase?date=${dateStr}`);
      const resData = await res.json();
      if (res.ok) {
        setData(resData);
        setActivePhotoIdx(0);
      }
    } catch (err) {
      console.error("Lỗi lấy dữ liệu suất ăn:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch 7 ngày gần nhất
  const fetch7Days = async () => {
    try {
      const res = await fetch("/api/public/daily-showcase/recent-7days");
      const resData = await res.json();
      if (res.ok) {
        setRecent7Days(resData.days || []);
      }
    } catch (err) {
      console.error("Lỗi lấy 7 ngày gần nhất:", err);
    }
  };

  useEffect(() => {
    fetchMealData(selectedDate);
    fetch7Days();
  }, [selectedDate]);

  const changeDate = (daysOffset: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    cur.setUTCDate(cur.getUTCDate() + daysOffset);

    // Bỏ qua Thứ 7 / Chủ nhật
    if (daysOffset > 0 && cur.getUTCDay() === 6) cur.setUTCDate(cur.getUTCDate() + 2);
    else if (daysOffset < 0 && cur.getUTCDay() === 0) cur.setUTCDate(cur.getUTCDate() - 2);

    const nextStr = cur.toISOString().split("T")[0];
    setSelectedDate(nextStr);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    const photoCount = data?.showcase?.photoUrls?.length || 0;

    if (Math.abs(diff) > 40 && photoCount > 1) {
      if (diff > 0 && activePhotoIdx < photoCount - 1) {
        setActivePhotoIdx((prev) => prev + 1);
      } else if (diff < 0 && activePhotoIdx > 0) {
        setActivePhotoIdx((prev) => prev - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const photos: string[] = data?.showcase?.photoUrls || [];
  const items: any[] = data?.showcase?.items || [];
  const schoolName = data?.schoolInfo?.name || "Trường THPT Ten Lơ Man";
  const schoolPhone = data?.schoolInfo?.phone || "(028) 3829 7990";
  const providerName = data?.providerInfo?.name || "Bếp Trung Tâm TLM";
  const providerPhone = data?.providerInfo?.phone || "(028) 3829 7990";
  const isToday = selectedDate === getTodayVN();

  // Nhóm các món theo nhóm
  const groupedItems: Record<string, any[]> = {};
  items.forEach((it) => {
    const cat = it.categoryName || "Món khác";
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(it);
  });

  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {/* 1. HEADER THƯƠNG HIỆU */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {schoolName}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cổng công khai suất ăn bán trú</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title="Sao chép link chia sẻ"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
            {schoolPhone && (
              <a
                href={`tel:${schoolPhone.replace(/[^0-9]/g, "")}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 text-xs font-bold"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{schoolPhone}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT (MOBILE-FIRST) */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* THANH CHỌN NGÀY THÔNG MINH */}
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Ngày trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none"
            />
            {isToday ? (
              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                Hôm nay
              </span>
            ) : (
              <button
                onClick={() => setSelectedDate(getTodayVN())}
                className="text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded-full font-bold transition cursor-pointer"
              >
                Về hôm nay
              </button>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Ngày sau"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* KHU VỰC CHÍNH (GRID 2 CỘT TRÊN DESKTOP, DỌC TRÊN MOBILE) */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs sm:text-sm font-semibold">Đang tải hình ảnh và thực đơn suất ăn...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CỘT TRÁI: CAROUSEL ẢNH 1:1 */}
            <div className="space-y-2">
              {photos.length > 0 ? (
                <>
                  <div
                    className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md group select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img
                      src={photos[activePhotoIdx]}
                      alt={`Khay cơm thực tế ${activePhotoIdx + 1}`}
                      className="w-full h-full object-cover transition-all duration-300"
                    />

                    {/* Nút phóng to Lightbox */}
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition cursor-pointer shadow-lg"
                      title="Phóng to ảnh"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    {/* Đếm số ảnh */}
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-mono font-bold">
                      Ảnh {activePhotoIdx + 1} / {photos.length}
                    </div>

                    {/* Nút lật ảnh Prev/Next */}
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition cursor-pointer"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition cursor-pointer"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Dots indicator */}
                  {photos.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      {photos.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            activePhotoIdx === idx ? "w-6 bg-blue-600" : "w-2 bg-slate-300 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-center text-slate-400">
                    📷 Hình ảnh chụp khay cơm thực tế phân phối tại bếp trước giờ phục vụ
                  </p>
                </>
              ) : (
                /* KHUNG THÔNG BÁO "ĐANG CẬP NHẬT HÌNH ẢNH" */
                <div className="aspect-square w-full rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-dashed border-amber-200 dark:border-amber-800/40 p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shadow-inner">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                      Đang cập nhật hình ảnh
                    </span>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                      Bữa ăn ngày {selectedDate}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    {items.length > 0
                      ? "Danh mục món ăn hôm nay đã sẵn sàng! Hình ảnh chụp khay cơm thực tế sẽ được bếp tải lên trước giờ ăn trưa (khoảng 10:30)."
                      : "Dữ liệu thực đơn và hình ảnh bữa ăn của ngày này đang được nhà bếp cập nhật."}
                  </p>
                </div>
              )}
            </div>

            {/* CỘT PHẢI: ĐƠN VỊ CUNG CẤP & THỰC ĐƠN */}
            <div className="space-y-3">
              {/* Card Đơn vị cung cấp */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Đơn vị cung cấp suất ăn
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {providerName}
                    </h4>
                  </div>
                </div>

                {providerPhone && (
                  <a
                    href={`tel:${providerPhone.replace(/[^0-9]/g, "")}`}
                    className="p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition shrink-0"
                    title={`Hotline: ${providerPhone}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Danh sách thực đơn theo nhóm món */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                      Thực đơn bữa ăn ({items.length} món)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Bếp Trung Tâm</span>
                </div>

                {items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Chưa có danh mục món cho ngày này.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(groupedItems).map(([catName, catItems]) => (
                      <div
                        key={catName}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5"
                      >
                        <span className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider">
                          {catName}
                        </span>
                        <div className="space-y-1">
                          {catItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs sm:text-sm py-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                • {it.dishName}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                                {it.dishCode}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data?.showcase?.note && (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 text-xs text-blue-800 dark:text-blue-300">
                    <strong>Ghi chú:</strong> {data.showcase.note}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. LỊCH SỬ SUẤT ĂN: CHỈ 7 NGÀY GẦN NHẤT */}
        {recent7Days.length > 0 && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Lịch sử suất ăn (7 ngày gần nhất)
              </span>
              <span className="text-[10px] text-slate-400">Vuốt ngang để xem các ngày trước</span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              {recent7Days.map((d) => {
                const isCurrent = d.date === selectedDate;
                return (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 w-24 p-2 rounded-2xl border text-center transition cursor-pointer ${
                      isCurrent
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-500/20 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100"
                    }`}
                  >
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 mb-1.5 flex items-center justify-center">
                      {d.thumbnail ? (
                        <img src={d.thumbnail} alt={d.date} className="w-full h-full object-cover" />
                      ) : (
                        <Utensils className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="block text-[11px] font-bold text-slate-800 dark:text-white truncate">
                      {d.dayName}
                    </span>
                    <span className="block text-[10px] text-slate-400">{d.shortDate}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="mt-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-600 dark:text-slate-300">
            © 2026 {schoolName} • Bán Trú TLM
          </p>
          <p className="text-[11px]">
            Hệ thống công khai thực đơn & hình ảnh suất ăn bán trú học đường • Bảo đảm minh bạch & ATVSTP
          </p>
        </div>
      </footer>

      {/* FULLSCREEN LIGHTBOX */}
      {lightboxOpen && photos.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={photos[activePhotoIdx]}
            alt="Toàn màn hình"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
          <div className="mt-3 text-white text-xs font-mono font-bold bg-black/60 px-3 py-1 rounded-full">
            Khay cơm ngày {selectedDate} • Ảnh {activePhotoIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
