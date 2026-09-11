"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Palmtree,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Building2,
  HelpCircle,
  Filter,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/lib/toast";

interface BranchItem {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface HolidayItem {
  id: string;
  date: string; // YYYY-MM-DD
  branchId: string | null;
  branchName: string;
  branchCode: string;
  branchColor: string;
  reason: string;
  createdAt: string;
}

interface HolidayManagerProps {
  branches: BranchItem[];
  userRole?: string;
  onRefresh?: () => void;
}

export function HolidayManager({
  branches = [],
  userRole,
  onRefresh,
}: HolidayManagerProps) {
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [isRangeMode, setIsRangeMode] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [allBranches, setAllBranches] = useState<boolean>(true);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [reason, setReason] = useState<string>("");

  // Quick suggestions
  const SUGGESTIONS = [
    "Nghỉ lễ 2/9",
    "Nghỉ Tết Dương lịch",
    "Nghỉ Tết Nguyên Đán",
    "Nghỉ lễ 30/4 & 1/5",
    "Nghỉ Giỗ Tổ Hùng Vương",
    "Dã ngoại ngoại khóa",
    "Hội thao / Văn nghệ",
    "Nghỉ học kỳ",
  ];

  // Fetch holidays
  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/central-kitchen/holidays", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tải danh sách ngày nghỉ");
      setHolidays(data.holidays || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể tải lịch nghỉ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
    // Default start date to tomorrow
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const y = tmr.getFullYear();
    const m = String(tmr.getMonth() + 1).padStart(2, "0");
    const d = String(tmr.getDate()).padStart(2, "0");
    setStartDate(`${y}-${m}-${d}`);
  }, []);

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error("Vui lòng chọn ngày bắt đầu nghỉ");
      return;
    }

    if (isRangeMode && endDate && endDate < startDate) {
      toast.error("Ngày kết thúc không thể trước ngày bắt đầu");
      return;
    }

    if (!allBranches && selectedBranchIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 chi nhánh được nghỉ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/central-kitchen/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate: isRangeMode ? endDate || startDate : startDate,
          allBranches,
          branchIds: allBranches ? [] : selectedBranchIds,
          reason: reason.trim() || "Nghỉ theo lịch",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu lịch nghỉ");

      toast.success(data.message || "Đã lưu lịch nghỉ thành công!");
      setReason("");
      setSelectedBranchIds([]);
      setAllBranches(true);
      await fetchHolidays();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu lịch nghỉ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, date: string, branchName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa lịch nghỉ ngày ${date} cho "${branchName}" không?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/central-kitchen/holidays?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi xóa lịch nghỉ");

      toast.success("Đã xóa lịch nghỉ thành công!");
      await fetchHolidays();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa lịch nghỉ");
    } finally {
      setDeletingId(null);
    }
  };

  const formatHolidayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      return `${daysOfWeek[dateObj.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const isPast = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split("-").map(Number);
    const itemDate = new Date(y, m - 1, d);
    return itemDate < today;
  };

  const canEdit = userRole === "ADMIN" || userRole === "BOARDING_MANAGER" || !userRole;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
            <Palmtree className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Lịch Nghỉ Bếp & Chi Nhánh (Holidays / Days-Off)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cài đặt trước ngày nghỉ toàn trường hoặc lịch dã ngoại / ngoại khóa riêng của từng chi nhánh
            </p>
          </div>
        </div>

        <button
          onClick={fetchHolidays}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* BANNER HUONG DAN */}
      <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-300 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <span>💡</span> Quy tắc vận hành & Chuyển ngày thông minh:
        </div>
        <ul className="list-disc pl-5 space-y-0.5 text-purple-800 dark:text-purple-300/90 text-[11px] sm:text-xs">
          <li>
            <strong>Cuối tuần (Thứ 7 & Chủ Nhật):</strong> Mặc định học sinh tiểu học chỉ ăn Thứ Hai - Thứ Sáu. Sau 14:00 Thứ 6 hoặc trong Thứ 7 & Chủ Nhật, màn hình TV tự động chuyển sang <strong>Thứ Hai tuần tới</strong>.
          </li>
          <li>
            <strong>Nghỉ toàn trường:</strong> Khi tất cả chi nhánh được cài đặt nghỉ (hoặc chọn "Tất cả chi nhánh"), màn hình TV sẽ tự động nhảy qua các ngày nghỉ này đến ngày có phục vụ ăn đầu tiên.
          </li>
          <li>
            <strong>Chi nhánh nghỉ riêng:</strong> Nếu chỉ 1 chi nhánh nghỉ (ví dụ đi dã ngoại), chi nhánh đó sẽ hiển thị biển báo <strong>🏖️ NGHỈ THEO LỊCH</strong>, không tính nguyên liệu và không cảnh báo đỏ.
          </li>
        </ul>
      </div>

      {/* FORM THEM LICH NGHI */}
      {canEdit && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-600" />
              Thêm lịch nghỉ mới
            </span>

            {/* Toggle ngày đơn vs khoảng ngày */}
            <div className="flex items-center p-0.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsRangeMode(false)}
                className={`px-3 py-1 rounded-md transition ${
                  !isRangeMode
                    ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                1 ngày
              </button>
              <button
                type="button"
                onClick={() => setIsRangeMode(true)}
                className={`px-3 py-1 rounded-md transition ${
                  isRangeMode
                    ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Nhiều ngày liên tiếp
              </button>
            </div>
          </div>

          {/* CHON NGAY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRangeMode ? "Từ ngày bắt đầu:" : "Ngày nghỉ:"}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            {isRangeMode && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Đến hết ngày:
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                    required={isRangeMode}
                  />
                </div>
              </div>
            )}
          </div>

          {/* AP DUNG CHO CHI NHANH */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Áp dụng cho chi nhánh nào:
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <input
                  type="radio"
                  name="branchScope"
                  checked={allBranches}
                  onChange={() => {
                    setAllBranches(true);
                    setSelectedBranchIds([]);
                  }}
                  className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  🌐 Toàn bộ trường (Tất cả chi nhánh)
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <input
                  type="radio"
                  name="branchScope"
                  checked={!allBranches}
                  onChange={() => setAllBranches(false)}
                  className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  🏫 Từng chi nhánh riêng biệt
                </span>
              </label>
            </div>

            {/* LIST CHI NHANH CHON RIENG */}
            {!allBranches && (
              <div className="pt-1.5 flex flex-wrap gap-2">
                {branches.map((b) => {
                  const isChecked = selectedBranchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBranchToggle(b.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        isChecked
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-purple-400"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: b.color || "#64748b" }}
                      />
                      <span>{b.name}</span>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* LY DO */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Lý do nghỉ (Hiển thị trên màn hình Tivi & ghi chú):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nghỉ lễ Quốc Khánh 2/9, Đi dã ngoại Củ Chi..."
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
              required
            />

            {/* Quick chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 font-medium">Gợi ý nhanh:</span>
              {SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setReason(sug)}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 text-slate-600 dark:text-slate-300 transition"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {submitting ? "Đang lưu lịch nghỉ..." : "Lưu vào lịch nghỉ"}
            </button>
          </div>
        </form>
      )}

      {/* DANH SACH CAC NGAY NGHI DA CAI DAT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-purple-500" />
            Danh sách các ngày nghỉ đã cài đặt ({holidays.length})
          </h4>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Đang tải danh sách ngày nghỉ...
          </div>
        ) : holidays.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <Palmtree className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Chưa có ngày nghỉ nào được cài đặt
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Thêm lịch nghỉ lễ hoặc lịch ngoại khóa ở form bên trên để hệ thống tự động điều hướng
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Ngày nghỉ</th>
                  <th className="py-2.5 px-3">Phạm vi áp dụng</th>
                  <th className="py-2.5 px-3">Lý do nghỉ</th>
                  {canEdit && <th className="py-2.5 px-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {holidays.map((item) => {
                  const past = isPast(item.date);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition ${
                        past ? "opacity-60 bg-slate-50/30 dark:bg-slate-900/40" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{formatHolidayDate(item.date)}</span>
                          {past && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded font-normal">
                              Đã qua
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        {item.branchId === null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-purple-200 dark:border-purple-800/50">
                            🌐 Tất cả chi nhánh
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white font-bold text-[11px] shadow-xs"
                            style={{ backgroundColor: item.branchColor || "#3b82f6" }}
                          >
                            🏫 {item.branchName}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        <span className="flex items-center gap-1">
                          <span>🏖️</span>
                          <span>{item.reason}</span>
                        </span>
                      </td>

                      {canEdit && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(item.id, item.date, item.branchName)
                            }
                            disabled={deletingId === item.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
                            title="Xóa ngày nghỉ này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
