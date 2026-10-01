"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Building,
  Phone,
  Maximize2,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface PublicMealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

function getTodayVN(): string {
  try {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    return d.toISOString().split("T")[0];
  }
}

export function PublicMealsModal({ isOpen, onClose, initialDate }: PublicMealsModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || getTodayVN());
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Touch swipe support for Carousel
  const touchStartXRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      const today = initialDate || getTodayVN();
      setSelectedDate(today);
      fetchMealData(today);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const changeDate = (daysOffset: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    cur.setUTCDate(cur.getUTCDate() + daysOffset);

    // Bỏ qua Thứ 7 / Chủ Nhật nếu chuyển ngày
    if (daysOffset > 0 && cur.getUTCDay() === 6) {
      cur.setUTCDate(cur.getUTCDate() + 2); // Sang Thứ Hai
    } else if (daysOffset < 0 && cur.getUTCDay() === 0) {
      cur.setUTCDate(cur.getUTCDate() - 2); // Về Thứ Sáu
    }

    const newDateStr = cur.toISOString().split("T")[0];
    setSelectedDate(newDateStr);
    fetchMealData(newDateStr);
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

  const photos: string[] = data?.showcase?.photoUrls || [];
  const items: any[] = data?.showcase?.items || [];
  const schoolName = data?.schoolInfo?.name || "Trường THPT Ten Lơ Man";
  const providerName = data?.providerInfo?.name || "Bếp Trung Tâm TLM";
  const providerPhone = data?.providerInfo?.phone || "(028) 3829 7990";
  const isToday = selectedDate === getTodayVN();

  // Nhóm các món theo danh mục
  const groupedItems: Record<string, any[]> = {};
  items.forEach((it) => {
    const cat = it.categoryName || "Món khác";
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(it);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[92vh] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* HEADER BAR */}
        <div className="p-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Utensils className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide truncate max-w-[240px]">
                {schoolName}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-100 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
                <span>Cổng công khai suất ăn bán trú</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* DATE SELECTOR BAR */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1.5 shrink-0">
          <button
            onClick={() => changeDate(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Ngày trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                fetchMealData(e.target.value);
              }}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-white cursor-pointer focus:outline-none"
            />
            {isToday && (
              <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                Hôm nay
              </span>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Ngày sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Đang tải thông tin suất ăn...</span>
            </div>
          ) : (
            <>
              {/* 1. CAROUSEL ẢNH TỈ LỆ 1:1 */}
              {photos.length > 0 ? (
                <div className="space-y-2">
                  <div
                    className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img
                      src={photos[activePhotoIdx]}
                      alt={`Khay cơm ${activePhotoIdx + 1}`}
                      className="w-full h-full object-cover transition-all duration-300"
                    />

                    {/* Nút phóng to Lightbox */}
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition cursor-pointer shadow-md"
                      title="Phóng to ảnh"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    {/* Số đếm ảnh */}
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold font-mono">
                      {activePhotoIdx + 1} / {photos.length}
                    </div>

                    {/* Nút prev/next trên Desktop */}
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Pagination Dots */}
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
                </div>
              ) : (
                /* TRẠNG THÁI "ĐANG CẬP NHẬT ẢNH" */
                <div className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full inline-block mb-1">
                      Đang cập nhật hình ảnh
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                      Khay cơm ngày {selectedDate}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {items.length > 0
                      ? "Thực đơn món ăn đã sẵn sàng bên dưới. Hình ảnh khay cơm thực tế sẽ được bếp chụp mẫu và cập nhật trước giờ phục vụ (khoảng 10:30)."
                      : "Dữ liệu thực đơn và hình ảnh bữa ăn của ngày này đang được nhà bếp cập nhật."}
                  </p>
                </div>
              )}

              {/* 2. THẺ ĐƠN VỊ CUNG CẤP */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Đơn vị cung cấp suất ăn
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white">
                      {providerName}
                    </h5>
                  </div>
                </div>

                {providerPhone && (
                  <a
                    href={`tel:${providerPhone.replace(/[^0-9]/g, "")}`}
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 text-blue-600 shadow-2xs hover:bg-blue-50 transition shrink-0"
                    title={`Gọi hotline: ${providerPhone}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* 3. DANH MỤC THỰC ĐƠN CHI TIẾT */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-blue-600" />
                    Thực đơn khẩu phần ({items.length} món)
                  </span>
                  <span className="text-[10px] text-slate-400">Từ Bếp Trung Tâm</span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    Chưa có danh mục món cho ngày này.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(groupedItems).map(([catName, catItems]) => (
                      <div
                        key={catName}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5"
                      >
                        <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider">
                          {catName}
                        </span>
                        <div className="space-y-1">
                          {catItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                • {it.dishName}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-slate-600">
                                {it.dishCode}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ghi chú dinh dưỡng nếu có */}
              {data?.showcase?.note && (
                <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 text-xs text-blue-800 dark:text-blue-300">
                  <strong>Ghi chú:</strong> {data.showcase.note}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
          <a
            href="https://congkhai.bantrutlm.com"
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition shadow-2xs"
          >
            <span>Trang công khai</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX KHI BẤM VÀO ẢNH */}
      {lightboxOpen && photos.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150 cursor-zoom-out"
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
