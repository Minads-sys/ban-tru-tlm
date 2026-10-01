"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  Camera,
  Save,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Eye,
  X,
  Upload,
} from "lucide-react";
import Swal from "sweetalert2";
import { cropAndCompressToSquareWebP } from "@/lib/image-compressor";
import { Dish } from "./dish-bank-manager";
import { DishCategory } from "./dish-category-manager";

interface DayMenuData {
  date: string;
  dayName: string;
  shortDate: string;
  items: Array<{
    dishId?: string;
    dishCode: string;
    dishName: string;
    categoryName: string;
    sortOrder: number;
  }>;
  photoUrls: string[];
  note?: string;
  isToday?: boolean;
}

const DAY_NAMES = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeeklyMenuMatrix() {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [weekDaysData, setWeekDaysData] = useState<DayMenuData[]>([]);

  // Dish bank & categories for selecting dishes
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);

  // Dialog chọn món cho 1 ngày cụ thể
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>("");
  const [pickerCategory, setPickerCategory] = useState<string>("");

  // Dialog tải ảnh cho 1 ngày cụ thể
  const [photoDayIndex, setPhotoDayIndex] = useState<number | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ file: File; preview: string; sizeKb: number }>>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);

  // Load danh sách món và nhóm món
  useEffect(() => {
    fetch("/api/central-kitchen/dish-bank?activeOnly=true")
      .then((res) => res.json())
      .then((data) => setDishes(data.dishes || []))
      .catch(console.error);

    fetch("/api/central-kitchen/dish-categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(console.error);
  }, []);

  // Fetch dữ liệu cả tuần
  const fetchWeekData = async () => {
    try {
      setLoading(true);
      const startStr = formatDate(currentMonday);
      const res = await fetch(`/api/central-kitchen/daily-showcase/weekly?startDate=${startStr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải thực đơn tuần");

      const todayStr = formatDate(new Date());

      // Tạo cấu trúc 5 ngày Thứ 2 -> Thứ 6
      const days: DayMenuData[] = [];
      for (let i = 0; i < 5; i++) {
        const curDate = new Date(currentMonday);
        curDate.setDate(currentMonday.getDate() + i);
        const dateStr = formatDate(curDate);
        const dayRecord = data.showcaseMap?.[dateStr];

        days.push({
          date: dateStr,
          dayName: DAY_NAMES[i],
          shortDate: `${String(curDate.getDate()).padStart(2, "0")}/${String(curDate.getMonth() + 1).padStart(2, "0")}`,
          items: dayRecord?.items?.map((it: any, idx: number) => ({
            dishId: it.dishId,
            dishCode: it.dishCode,
            dishName: it.dishName,
            categoryName: it.categoryName || "Món khác",
            sortOrder: it.sortOrder || idx + 1,
          })) || [],
          photoUrls: dayRecord?.photoUrls || [],
          note: dayRecord?.note || "",
          isToday: dateStr === todayStr,
        });
      }

      setWeekDaysData(days);
    } catch (err: any) {
      console.error(err);
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekData();
  }, [currentMonday]);

  // Điều hướng tuần
  const changeWeek = (offsetDays: number) => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + offsetDays);
    setCurrentMonday(next);
  };

  const jumpToCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Thêm món vào ngày
  const handleAddDishToDay = (dayIndex: number, dish: Dish) => {
    setWeekDaysData((prev) => {
      const copy = [...prev];
      const targetDay = copy[dayIndex];
      // Kiểm tra trùng món trong ngày
      if (targetDay.items.some((it) => it.dishCode === dish.code)) {
        Swal.fire("Lưu ý", `Món "${dish.name}" đã có trong thực đơn ngày này rồi`, "info");
        return prev;
      }

      targetDay.items.push({
        dishId: dish.id,
        dishCode: dish.code,
        dishName: dish.name,
        categoryName: dish.category?.name || "Món khác",
        sortOrder: targetDay.items.length + 1,
      });

      return copy;
    });
  };

  // Xóa món khỏi ngày
  const handleRemoveDish = (dayIndex: number, itemIndex: number) => {
    setWeekDaysData((prev) => {
      const copy = [...prev];
      copy[dayIndex].items.splice(itemIndex, 1);
      return copy;
    });
  };

  // Sao chép thực đơn tuần trước
  const handleCopyPreviousWeek = async () => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);

    const fromDateStr = formatDate(prevMonday);
    const toDateStr = formatDate(currentMonday);

    const confirm = await Swal.fire({
      title: "Sao chép thực đơn tuần trước?",
      text: `Sao chép toàn bộ món ăn từ tuần [${fromDateStr}] sang tuần này [${toDateStr}]. (Các ảnh khay cơm sẽ không bị ghi đè).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Đồng ý sao chép",
      cancelButtonText: "Hủy",
    });

    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      const res = await fetch("/api/central-kitchen/daily-showcase/copy-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromStartDate: fromDateStr,
          toStartDate: toDateStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể sao chép");

      Swal.fire({
        icon: "success",
        title: "Hoàn tất",
        text: data.message,
        timer: 1600,
        showConfirmButton: false,
      });

      await fetchWeekData();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Lưu toàn bộ thực đơn tuần
  const handleSaveAllWeek = async () => {
    try {
      setSaving(true);
      const daysPayload = weekDaysData.map((d) => ({
        date: d.date,
        items: d.items,
        note: d.note,
      }));

      const res = await fetch("/api/central-kitchen/daily-showcase/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: daysPayload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu thực đơn tuần");

      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Đã lưu thực đơn cả tuần thành công! Học sinh và phụ huynh có thể xem thực đơn ngay.",
        timer: 2000,
        showConfirmButton: false,
      });

      await fetchWeekData();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Xử lý chọn ảnh & nén 1:1 (150KB - 300KB)
  const openPhotoModal = (dayIndex: number) => {
    const day = weekDaysData[dayIndex];
    setPhotoDayIndex(dayIndex);
    setExistingPhotos(day.photoUrls || []);
    setSelectedPhotos([]);
  };

  const handleSelectImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - existingPhotos.length - selectedPhotos.length;
    if (remainingSlots <= 0) {
      Swal.fire("Giới hạn", "Tối đa chỉ được tải 3 ảnh cho mỗi ngày", "warning");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newItems: Array<{ file: File; preview: string; sizeKb: number }> = [];

    for (const file of filesToProcess) {
      try {
        // Nén tỉ lệ 1:1, dung lượng 150KB - 300KB
        const result = await cropAndCompressToSquareWebP(file, 150, 300, 1080);
        newItems.push({
          file: result.file,
          preview: result.previewUrl,
          sizeKb: result.sizeKb,
        });
      } catch (err) {
        console.error("Lỗi nén ảnh:", err);
      }
    }

    setSelectedPhotos((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const handleUploadAndSavePhotos = async () => {
    if (photoDayIndex === null) return;
    const day = weekDaysData[photoDayIndex];

    try {
      setUploadingPhotos(true);
      let finalPhotoUrls = [...existingPhotos];

      // Nếu có ảnh mới chọn, upload lên server
      if (selectedPhotos.length > 0) {
        const formData = new FormData();
        formData.append("date", day.date);
        selectedPhotos.forEach((item) => {
          formData.append("photos", item.file);
        });

        const res = await fetch("/api/central-kitchen/daily-showcase/upload-photos", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tải ảnh lên máy chủ");
        finalPhotoUrls = [...finalPhotoUrls, ...(data.photoUrls || [])].slice(0, 3);
      }

      // Lưu lại showcase của ngày đó với photoUrls mới
      const saveRes = await fetch("/api/central-kitchen/daily-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: day.date,
          photoUrls: finalPhotoUrls,
          items: day.items,
          note: day.note,
          isPublished: true,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Không thể lưu thông tin ảnh ngày");

      Swal.fire({
        icon: "success",
        title: "Đã cập nhật ảnh",
        text: `Đã cập nhật ảnh suất ăn ngày ${day.date} thành công!`,
        timer: 1500,
        showConfirmButton: false,
      });

      setPhotoDayIndex(null);
      await fetchWeekData();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Tính ngày Thứ 6 kết thúc tuần
  const fridayDate = new Date(currentMonday);
  fridayDate.setDate(currentMonday.getDate() + 4);

  return (
    <div className="space-y-4">
      {/* TOOLBAR TUẦN & TIỆN ÍCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => changeWeek(-7)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-0.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                Tuần: {formatDate(currentMonday)} đến {formatDate(fridayDate)}
              </span>
            </div>
            <button
              onClick={() => changeWeek(7)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={jumpToCurrentWeek}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tuần này
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyPreviousWeek}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800/60 transition cursor-pointer active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao chép tuần trước</span>
          </button>

          <button
            onClick={handleSaveAllWeek}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Đang lưu..." : "Lưu toàn bộ thực đơn tuần"}</span>
          </button>
        </div>
      </div>

      {/* MATRIX TABLE 5 CỘT (THỨ 2 -> THỨ 6) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {weekDaysData.map((day, dayIndex) => {
          const hasPhotos = day.photoUrls && day.photoUrls.length > 0;
          const hasMenu = day.items && day.items.length > 0;

          return (
            <div
              key={day.date}
              className={`rounded-2xl border flex flex-col bg-white dark:bg-slate-900 transition-all shadow-xs ${
                day.isToday
                  ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Cột Header ngày */}
              <div
                className={`p-3 rounded-t-2xl border-b flex items-center justify-between ${
                  day.isToday
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm">{day.dayName}</span>
                    {day.isToday && (
                      <span className="text-[10px] bg-white text-blue-700 px-1.5 py-0.2 rounded-full font-bold">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      day.isToday ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {day.shortDate}
                  </span>
                </div>

                {/* Badge trạng thái */}
                {hasPhotos ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      day.isToday
                        ? "bg-white/20 text-white"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                    title="Đã có ảnh suất ăn thực tế"
                  >
                    <CheckCircle2 className="w-3 h-3" /> {day.photoUrls.length} ảnh
                  </span>
                ) : hasMenu ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      day.isToday
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                    title="Đã có thực đơn, chờ tải ảnh"
                  >
                    <Clock className="w-3 h-3" /> Chờ ảnh
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Chưa có món
                  </span>
                )}
              </div>

              {/* Danh sách món ăn trong ngày */}
              <div className="p-2.5 flex-1 space-y-1.5 min-h-[220px] max-h-[360px] overflow-y-auto">
                {day.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                    <p className="text-xs">Chưa có món ăn nào.</p>
                    <p className="text-[10px] mt-1">Bấm "+ Thêm món" bên dưới</p>
                  </div>
                ) : (
                  day.items.map((it, itemIndex) => (
                    <div
                      key={`${it.dishCode}-${itemIndex}`}
                      className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-1 text-xs group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                            {it.dishCode}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {it.dishName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {it.categoryName}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveDish(dayIndex, itemIndex)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 transition cursor-pointer"
                        title="Xóa món này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Nút hành động của ngày: Thêm món & Tải ảnh */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setPickerDayIndex(dayIndex);
                    setPickerSearch("");
                    setPickerCategory("");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Thêm món</span>
                </button>

                <button
                  onClick={() => openPhotoModal(dayIndex)}
                  className={`inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                    hasPhotos
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  }`}
                  title="Chụp / Tải ảnh suất ăn khay cơm 1:1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{hasPhotos ? "Sửa ảnh" : "Up ảnh"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL CHỌN MÓN TỪ NGÂN HÀNG MÓN */}
      {pickerDayIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">
                  Thêm món cho {weekDaysData[pickerDayIndex]?.dayName} ({weekDaysData[pickerDayIndex]?.date})
                </h4>
                <p className="text-[11px] text-slate-400">Chọn các món từ Ngân hàng món ăn Bếp Trung Tâm</p>
              </div>
              <button onClick={() => setPickerDayIndex(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô tìm kiếm & lọc */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <input
                type="text"
                placeholder="Gõ tên hoặc mã món..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={pickerCategory}
                onChange={(e) => setPickerCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
              >
                <option value="">Tất cả nhóm</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || "🍱"} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Danh sách món */}
            <div className="p-3 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 space-y-1">
              {dishes
                .filter((d) => {
                  if (pickerCategory && d.categoryId !== pickerCategory) return false;
                  if (pickerSearch.trim()) {
                    const q = pickerSearch.trim().toLowerCase();
                    return d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
                  }
                  return true;
                })
                .map((dish) => {
                  const isAdded = weekDaysData[pickerDayIndex]?.items.some((it) => it.dishCode === dish.code);
                  return (
                    <div
                      key={dish.id}
                      className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                            {dish.code}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                            {dish.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {dish.category?.icon || "🍱"} {dish.category?.name || "Chưa phân nhóm"}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddDishToDay(pickerDayIndex, dish)}
                        disabled={isAdded}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isAdded
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                        }`}
                      >
                        {isAdded ? "Đã thêm" : "+ Chọn"}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setPickerDayIndex(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẢI ẢNH 1:1 KHAY CƠM (NÉN 150KB - 300KB) */}
      {photoDayIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-white" />
                <div>
                  <h4 className="text-sm font-bold">
                    Tải ảnh suất ăn {weekDaysData[photoDayIndex]?.dayName} ({weekDaysData[photoDayIndex]?.date})
                  </h4>
                  <p className="text-[10px] text-blue-100">
                    Tối đa 3 ảnh • Tỉ lệ chuẩn 1:1 • Tự động nén WebP 150KB - 300KB
                  </p>
                </div>
              </div>
              <button onClick={() => setPhotoDayIndex(null)} className="text-white/80 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* KHUNG HIỂN THỊ CÁC ẢNH ĐÃ CÓ / VỪA CHỌN */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Ảnh đã lưu từ trước */}
                {existingPhotos.map((url, idx) => (
                  <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setExistingPhotos(existingPhotos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition cursor-pointer"
                      title="Xóa ảnh này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-bold">
                      Ảnh {idx + 1}
                    </span>
                  </div>
                ))}

                {/* 2. Ảnh mới chọn chuẩn bị tải lên */}
                {selectedPhotos.map((item, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-blue-500 group">
                    <img src={item.preview} alt="Mới" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSelectedPhotos(selectedPhotos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition cursor-pointer"
                      title="Hủy ảnh này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                      {item.sizeKb} KB
                    </span>
                  </div>
                ))}

                {/* 3. Nút Thêm ảnh mới nếu chưa đủ 3 ảnh */}
                {existingPhotos.length + selectedPhotos.length < 3 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Chọn ảnh 1:1
                    </span>
                    <span className="text-[9px] text-slate-400">({3 - existingPhotos.length - selectedPhotos.length} slot còn lại)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleSelectImageFiles}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-slate-800/80 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Cơ chế nén ảnh tự động chuẩn di động
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Ảnh chọn từ điện thoại sẽ được tự động crop vuông 1:1 và nén tối ưu trong khoảng <strong>150KB - 300KB</strong> để tải siêu tốc cho phụ huynh và học sinh.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPhotoDayIndex(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={handleUploadAndSavePhotos}
                  disabled={uploadingPhotos}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${uploadingPhotos ? "animate-spin" : ""}`} />
                  <span>{uploadingPhotos ? "Đang xử lý & Lưu..." : "Lưu ảnh ngày này"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
