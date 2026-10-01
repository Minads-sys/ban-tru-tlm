"use client";

import React, { useState, useEffect } from "react";
import { History, Calendar, Search, RefreshCw, Image as ImageIcon, Utensils, Eye, ExternalLink } from "lucide-react";

export function ShowcaseHistoryView() {
  const [showcases, setShowcases] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [hasPhotoOnly, setHasPhotoOnly] = useState<boolean>(false);
  const [selectedShowcase, setSelectedShowcase] = useState<any | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      let url = `/api/central-kitchen/daily-showcase/history?month=${month}&year=${year}&limit=60`;
      if (hasPhotoOnly) url += "&hasPhoto=true";

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setShowcases(data.showcases || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [month, year, hasPhotoOnly]);

  return (
    <div className="space-y-4">
      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              Lịch sử Suất ăn Công khai Bán trú
            </h3>
            <p className="text-xs text-slate-500">
              Lưu trữ vĩnh viễn toàn bộ thực đơn và hình ảnh các ngày từ trước đến nay
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="bg-transparent font-bold cursor-pointer focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-transparent font-bold cursor-pointer focus:outline-none"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer px-2">
            <input
              type="checkbox"
              checked={hasPhotoOnly}
              onChange={(e) => setHasPhotoOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <span>Chỉ xem ngày có ảnh</span>
          </label>

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* DANH SÁCH LỊCH SỬ DẠNG LƯỚI CARD */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Đang tải lịch sử suất ăn...</div>
      ) : showcases.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          Chưa có dữ liệu suất ăn nào trong Tháng {month}/{year}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {showcases.map((sc) => {
            const dateStr = sc.date ? sc.date.split("T")[0] : "";
            const hasPhotos = sc.photoUrls && sc.photoUrls.length > 0;
            const thumb = hasPhotos ? sc.photoUrls[0] : null;

            return (
              <div
                key={sc.id}
                onClick={() => setSelectedShowcase(sc)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      {dateStr}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        hasPhotos
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950"
                      }`}
                    >
                      {hasPhotos ? `${sc.photoUrls.length} ảnh 1:1` : "Chưa có ảnh"}
                    </span>
                  </div>

                  {/* THUMBNAIL HOẶC PLACEHOLDER */}
                  <div className="my-2 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                    {thumb ? (
                      <img src={thumb} alt={dateStr} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="text-center text-slate-400 p-2">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px]">Chưa tải ảnh khay cơm</span>
                      </div>
                    )}
                  </div>

                  {/* DANH SÁCH MÓN ĂN TÓM TẮT */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Thực đơn ({sc.items?.length || 0} món):
                    </span>
                    <div className="space-y-0.5">
                      {sc.items?.slice(0, 3).map((it: any, i: number) => (
                        <div key={i} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          • {it.dishName}
                        </div>
                      ))}
                      {sc.items?.length > 3 && (
                        <div className="text-[10px] text-slate-400 italic">
                          + thêm {sc.items.length - 3} món nữa...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{sc.providerName || "Bếp Trung Tâm"}</span>
                  <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Chi tiết
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL XEM CHI TIẾT 1 NGÀY TRONG LỊCH SỬ */}
      {selectedShowcase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">
                  Chi tiết suất ăn ngày {selectedShowcase.date?.split("T")[0]}
                </h4>
                <p className="text-[10px] text-indigo-100">
                  Đơn vị cung cấp: {selectedShowcase.providerName || "Bếp Trung Tâm TLM"}
                </p>
              </div>
              <button onClick={() => setSelectedShowcase(null)} className="text-white/80 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* ALBUM ẢNH 1:1 */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Hình ảnh khay cơm thực tế ({selectedShowcase.photoUrls?.length || 0} ảnh):
                </span>
                {selectedShowcase.photoUrls?.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedShowcase.photoUrls.map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden border border-slate-200 block group">
                        <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    Chưa có ảnh khay cơm cho ngày này.
                  </p>
                )}
              </div>

              {/* DANH SÁCH MÓN ĂN */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Danh mục món ăn:
                </span>
                <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedShowcase.items?.map((it: any, idx: number) => (
                    <div key={idx} className="pt-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600">{it.dishCode}</span>
                        <span className="font-bold text-slate-800 dark:text-white">{it.dishName}</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">{it.categoryName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedShowcase.note && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600">
                  <strong>Ghi chú:</strong> {selectedShowcase.note}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedShowcase(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
