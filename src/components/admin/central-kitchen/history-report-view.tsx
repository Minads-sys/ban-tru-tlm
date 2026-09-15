"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Clock,
  Utensils,
  ChevronRight,
  TrendingUp,
  Download,
  Building2,
  Info,
} from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "@/lib/toast";

interface BranchOption {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface HistoryEntry {
  id: string;
  date: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  branchColor: string;
  isHoliday: boolean;
  holidayReason: string;
  totalServings: number;
  servingsMan: number;
  servingsChay: number;
  servingsChao: number;
  manMealType: "COM" | "NUOC";
  isChayRice: boolean;
  noodleName: string | null;
  noodleServings: number;
  fruitName: string;
  lockStatus: "UNLOCKED" | "LOCKED_MARKET" | "LOCKED_COOK";
  marketTotalServings: number | null;
  difference: number;
  marketLockedAt: string | null;
  mealLockedAt: string | null;
  note: string;
  materials: {
    riceKg: number;
    noodleKg: number;
    fruitKg: number;
  };
}

interface BranchSummaryItem {
  branchId: string;
  branchCode: string;
  branchName: string;
  branchColor: string;
  daysCount: number;
  totalServings: number;
  servingsMan: number;
  servingsChay: number;
  servingsChao: number;
  riceKg: number;
  noodleKg: number;
  fruitKg: number;
}

interface TotalSummary {
  totalDays: number;
  totalEntries: number;
  totalServings: number;
  totalMan: number;
  totalChay: number;
  totalChao: number;
  totalRiceKg: number;
  totalNoodleKg: number;
  totalFruitKg: number;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Helpers to get quick date ranges
function getQuickRange(type: "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH"): {
  start: string;
  end: string;
} {
  const now = new Date();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (type === "THIS_WEEK") {
    // Thứ Hai tuần này -> Thứ Sáu tuần này
    const d = new Date(now);
    const day = d.getDay();
    const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diffToMon));
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { start: formatDate(mon), end: formatDate(fri) };
  }

  if (type === "LAST_WEEK") {
    // Thứ Hai tuần trước -> Thứ Sáu tuần trước
    const d = new Date(now);
    const day = d.getDay();
    const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const mon = new Date(d.setDate(diffToMon));
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { start: formatDate(mon), end: formatDate(fri) };
  }

  if (type === "THIS_MONTH") {
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { start: formatDate(first), end: formatDate(last) };
  }

  if (type === "LAST_MONTH") {
    const y = now.getFullYear();
    const m = now.getMonth() - 1;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { start: formatDate(first), end: formatDate(last) };
  }

  return { start: formatDate(now), end: formatDate(now) };
}

export function HistoryReportView() {
  const [quickType, setQuickType] = useState<
    "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM"
  >("THIS_WEEK");

  const [startDate, setStartDate] = useState<string>(() => getQuickRange("THIS_WEEK").start);
  const [endDate, setEndDate] = useState<string>(() => getQuickRange("THIS_WEEK").end);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [branchSummary, setBranchSummary] = useState<BranchSummaryItem[]>([]);
  const [totalSummary, setTotalSummary] = useState<TotalSummary>({
    totalDays: 0,
    totalEntries: 0,
    totalServings: 0,
    totalMan: 0,
    totalChay: 0,
    totalChao: 0,
    totalRiceKg: 0,
    totalNoodleKg: 0,
    totalFruitKg: 0,
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/central-kitchen/history?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranchId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi tải lịch sử");

      setBranches(data.branches || []);
      setEntries(data.entries || []);
      setBranchSummary(data.branchSummary || []);
      setTotalSummary(
        data.totalSummary || {
          totalDays: 0,
          totalEntries: 0,
          totalServings: 0,
          totalMan: 0,
          totalChay: 0,
          totalChao: 0,
          totalRiceKg: 0,
          totalNoodleKg: 0,
          totalFruitKg: 0,
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Không thể tải dữ liệu lịch sử");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBranchId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleQuickSelect = (type: "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH") => {
    setQuickType(type);
    const range = getQuickRange(type);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  // Filtered detailed entries by search text
  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const q = searchTerm.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.branchName.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        formatDateDisplay(e.date).includes(q) ||
        (e.noodleName && e.noodleName.toLowerCase().includes(q)) ||
        (e.fruitName && e.fruitName.toLowerCase().includes(q)) ||
        (e.note && e.note.toLowerCase().includes(q))
    );
  }, [entries, searchTerm]);

  // Export to formatted Excel file
  const handleExportExcel = async () => {
    if (entries.length === 0) {
      toast.error("Không có dữ liệu trong khoảng thời gian này để xuất file");
      return;
    }

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Phần mềm Bán trú TLM";
      workbook.created = new Date();

      // ================= SHEET 1: TỔNG HỢP THEO CHI NHÁNH =================
      const ws1 = workbook.addWorksheet("Tong_Hop_Chi_Nhanh");

      // Banner Title
      ws1.mergeCells("A1:J1");
      const title1 = ws1.getCell("A1");
      title1.value = "BÁO CÁO TỔNG HỢP SUẤT ĂN & NGUYÊN LIỆU - BẾP TRUNG TÂM";
      title1.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      title1.alignment = { vertical: "middle", horizontal: "center" };
      title1.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A8A" },
      };
      ws1.getRow(1).height = 32;

      // Subtitle info
      ws1.mergeCells("A2:J2");
      const sub1 = ws1.getCell("A2");
      sub1.value = `Giai đoạn: Từ ngày ${formatDateDisplay(startDate)} đến ngày ${formatDateDisplay(
        endDate
      )} | Ngày xuất: ${new Date().toLocaleDateString("vi-VN")} lúc ${new Date().toLocaleTimeString(
        "vi-VN"
      )}`;
      sub1.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
      sub1.alignment = { vertical: "middle", horizontal: "center" };
      ws1.getRow(2).height = 20;

      // Header row
      ws1.getRow(4).values = [
        "STT",
        "Tên Chi Nhánh",
        "Số Ngày Phục Vụ",
        "Suất Mặn",
        "Suất Chay",
        "Suất Cháo",
        "Tổng Suất Ăn",
        "Tổng Gạo (kg)",
        "Bún / Phở (kg)",
        "Trái Cây (kg)",
      ];
      ws1.getRow(4).font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      ws1.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
      ws1.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      ws1.getRow(4).height = 26;

      let r1 = 5;
      branchSummary.forEach((bs, idx) => {
        const row = ws1.getRow(r1);
        row.values = [
          idx + 1,
          bs.branchName,
          bs.daysCount,
          bs.servingsMan,
          bs.servingsChay,
          bs.servingsChao,
          bs.totalServings,
          bs.riceKg,
          bs.noodleKg,
          bs.fruitKg,
        ];
        row.font = { name: "Arial", size: 11 };
        row.alignment = { vertical: "middle" };
        row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
        [4, 5, 6, 7, 8, 9, 10].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = colIdx >= 8 ? "#,##0.0" : "#,##0";
          row.getCell(colIdx).alignment = { vertical: "middle", horizontal: "right" };
        });
        row.height = 22;
        r1++;
      });

      // Grand Total Row Sheet 1
      const totalRow1 = ws1.getRow(r1);
      totalRow1.values = [
        "",
        "TỔNG TOÀN TRƯỜNG",
        totalSummary.totalDays,
        totalSummary.totalMan,
        totalSummary.totalChay,
        totalSummary.totalChao,
        totalSummary.totalServings,
        totalSummary.totalRiceKg,
        totalSummary.totalNoodleKg,
        totalSummary.totalFruitKg,
      ];
      totalRow1.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF991B1B" } };
      totalRow1.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
      totalRow1.alignment = { vertical: "middle" };
      totalRow1.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      totalRow1.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
      [4, 5, 6, 7, 8, 9, 10].forEach((colIdx) => {
        totalRow1.getCell(colIdx).numFmt = colIdx >= 8 ? "#,##0.0" : "#,##0";
        totalRow1.getCell(colIdx).alignment = { vertical: "middle", horizontal: "right" };
      });
      totalRow1.height = 26;

      // Borders for Sheet 1
      for (let i = 4; i <= r1; i++) {
        ws1.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      }

      // Column widths
      ws1.columns = [
        { width: 8 },
        { width: 24 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
      ];

      // ================= SHEET 2: CHI TIẾT TỪNG NGÀY =================
      const ws2 = workbook.addWorksheet("Chi_Tiet_Tung_Ngay");

      // Banner Title
      ws2.mergeCells("A1:M1");
      const title2 = ws2.getCell("A1");
      title2.value = "NHẬT KÝ CHI TIẾT SUẤT ĂN THEO NGÀY - BẾP TRUNG TÂM";
      title2.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      title2.alignment = { vertical: "middle", horizontal: "center" };
      title2.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF065F46" },
      };
      ws2.getRow(1).height = 32;

      ws2.mergeCells("A2:M2");
      const sub2 = ws2.getCell("A2");
      sub2.value = `Từ ngày ${formatDateDisplay(startDate)} đến ngày ${formatDateDisplay(
        endDate
      )} | Số dòng ghi nhận: ${entries.length}`;
      sub2.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
      sub2.alignment = { vertical: "middle", horizontal: "center" };
      ws2.getRow(2).height = 20;

      // Header row
      ws2.getRow(4).values = [
        "STT",
        "Ngày Ăn",
        "Chi Nhánh",
        "Trạng Thái Chốt",
        "Thực Đơn Mặn",
        "Suất Mặn",
        "Suất Chay",
        "Suất Cháo",
        "Tổng Suất",
        "Gạo (kg)",
        "Món Nước (kg)",
        "Trái Cây (kg)",
        "Ghi Chú",
      ];
      ws2.getRow(4).font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      ws2.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
      ws2.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF059669" },
      };
      ws2.getRow(4).height = 26;

      let r2 = 5;
      entries.forEach((e, idx) => {
        const row = ws2.getRow(r2);
        const statusText =
          e.lockStatus === "LOCKED_COOK"
            ? "Đã chốt ăn"
            : e.lockStatus === "LOCKED_MARKET"
            ? "Đã chốt đi chợ"
            : "Chưa chốt";

        const mealText =
          e.manMealType === "NUOC" ? `Mặn Nước (${e.noodleName || "Bánh phở"})` : "Mặn Cơm";

        row.values = [
          idx + 1,
          formatDateDisplay(e.date),
          e.branchName,
          statusText,
          mealText,
          e.servingsMan,
          e.servingsChay,
          e.servingsChao,
          e.totalServings,
          e.materials.riceKg,
          e.manMealType === "NUOC" ? e.materials.noodleKg : "-",
          e.materials.fruitKg,
          e.note || "",
        ];

        row.font = { name: "Arial", size: 10 };
        row.alignment = { vertical: "middle" };
        row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
        [6, 7, 8, 9, 10, 11, 12].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = colIdx >= 10 ? "#,##0.0" : "#,##0";
          row.getCell(colIdx).alignment = { vertical: "middle", horizontal: "right" };
        });
        row.height = 20;
        r2++;
      });

      // Borders for Sheet 2
      for (let i = 4; i <= r2 - 1; i++) {
        ws2.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      }

      ws2.columns = [
        { width: 6 },
        { width: 14 },
        { width: 20 },
        { width: 16 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 30 },
      ];

      // Generate buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Bao_Cao_Bep_Trung_Tam_${startDate}_den_${endDate}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.success("Đã xuất file Excel thành công!");
    } catch (err: any) {
      console.error("Lỗi xuất Excel:", err);
      toast.error(err.message || "Lỗi khi tạo file Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. FILTER & ACTION TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
              Lịch Sử & Báo Cáo Đối Soát Suất Ăn
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tra cứu đối soát lịch sử chốt suất ăn, định lượng nguyên liệu theo tuần, tháng hoặc khoảng ngày bất kỳ
            </p>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || entries.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            title="Tải file Excel báo cáo chi tiết"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? "Đang xuất file..." : "Xuất file Excel (.xlsx)"}</span>
          </button>
        </div>

        {/* Date Ranges & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick selectors */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => handleQuickSelect("THIS_WEEK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickType === "THIS_WEEK"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
              }`}
            >
              Tuần này
            </button>
            <button
              onClick={() => handleQuickSelect("LAST_WEEK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickType === "LAST_WEEK"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
              }`}
            >
              Tuần trước
            </button>
            <button
              onClick={() => handleQuickSelect("THIS_MONTH")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickType === "THIS_MONTH"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => handleQuickSelect("LAST_MONTH")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickType === "LAST_MONTH"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700"
              }`}
            >
              Tháng trước
            </button>
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-slate-500 dark:text-slate-400">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setQuickType("CUSTOM");
                  setStartDate(e.target.value);
                }}
                className="bg-transparent font-bold text-slate-900 dark:text-white border-0 focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-slate-300 dark:text-slate-600">-</span>
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-slate-500 dark:text-slate-400">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setQuickType("CUSTOM");
                  setEndDate(e.target.value);
                }}
                className="bg-transparent font-bold text-slate-900 dark:text-white border-0 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white border-0 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900">
                Tất cả chi nhánh
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchHistory()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. KPI HIGHLIGHT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Tổng Suất Ăn Cả Kỳ
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
              {totalSummary.totalServings.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs font-bold text-slate-500">suất</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            (Mặn: {totalSummary.totalMan.toLocaleString("vi-VN")} | Chay:{" "}
            {totalSummary.totalChay.toLocaleString("vi-VN")} | Cháo:{" "}
            {totalSummary.totalChao.toLocaleString("vi-VN")})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            🌾 Tổng Gạo Xuất Kho
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {totalSummary.totalRiceKg.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">kg</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            (Gồm cả gạo nấu cơm & gạo nấu cháo)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            🍜 Tổng Món Nước (Bún/Phở)
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
              {totalSummary.totalNoodleKg.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">kg</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            (Gồm cả suất chay ăn món nước)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            🍌 Tổng Trái Cây
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-yellow-600 dark:text-yellow-400">
              {totalSummary.totalFruitKg.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">kg</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            (Phục vụ {totalSummary.totalDays} ngày học sinh ăn)
          </div>
        </div>
      </div>

      {/* 3. TABLE 1: TỔNG HỢP LŨY KẾ THEO CHI NHÁNH */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              1. Bảng Tổng Hợp Lũy Kế Theo Chi Nhánh
            </h4>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {formatDateDisplay(startDate)} ➔ {formatDateDisplay(endDate)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 text-center w-12">STT</th>
                <th className="py-3 px-4">Chi nhánh</th>
                <th className="py-3 px-4 text-center">Số ngày ăn</th>
                <th className="py-3 px-4 text-right">Suất Mặn</th>
                <th className="py-3 px-4 text-right">Suất Chay</th>
                <th className="py-3 px-4 text-right">Suất Cháo</th>
                <th className="py-3 px-4 text-right font-black">Tổng Suất Ăn</th>
                <th className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">Gạo (kg)</th>
                <th className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">Bún/Phở (kg)</th>
                <th className="py-3 px-4 text-right text-yellow-600 dark:text-yellow-400">Trái cây (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {branchSummary.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không có dữ liệu trong khoảng thời gian đã chọn
                  </td>
                </tr>
              ) : (
                branchSummary.map((bs, idx) => (
                  <tr key={bs.branchId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bs.branchColor }} />
                        <span>{bs.branchName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-400">
                      {bs.daysCount}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                      {bs.servingsMan.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {bs.servingsChay.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-cyan-600 dark:text-cyan-400">
                      {bs.servingsChao.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white text-base">
                      {bs.totalServings.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-amber-600 dark:text-amber-400">
                      {bs.riceKg.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-blue-600 dark:text-blue-400">
                      {bs.noodleKg > 0 ? bs.noodleKg.toFixed(1) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-yellow-600 dark:text-yellow-400">
                      {bs.fruitKg.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {branchSummary.length > 0 && (
              <tfoot>
                <tr className="bg-red-50/80 dark:bg-red-950/40 font-black text-red-900 dark:text-red-200 border-t-2 border-red-200 dark:border-red-900">
                  <td colSpan={2} className="py-3.5 px-4 text-center uppercase tracking-wider">
                    TỔNG CỘNG TOÀN TRƯỜNG
                  </td>
                  <td className="py-3.5 px-4 text-center text-red-700 dark:text-red-300">
                    {totalSummary.totalDays} ngày
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-700 dark:text-red-300">
                    {totalSummary.totalMan.toLocaleString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-700 dark:text-red-300">
                    {totalSummary.totalChay.toLocaleString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-700 dark:text-red-300">
                    {totalSummary.totalChao.toLocaleString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-red-700 dark:text-red-300">
                    {totalSummary.totalServings.toLocaleString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-amber-700 dark:text-amber-300">
                    {totalSummary.totalRiceKg.toFixed(1)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-blue-700 dark:text-blue-300">
                    {totalSummary.totalNoodleKg > 0 ? totalSummary.totalNoodleKg.toFixed(1) : "-"}
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-yellow-700 dark:text-yellow-300">
                    {totalSummary.totalFruitKg.toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. TABLE 2: NHẬT KÝ CHI TIẾT TỪNG NGÀY */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              2. Nhật Ký Chi Tiết Chốt Suất Ăn Từng Ngày ({filteredEntries.length} bản ghi)
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm ngày, chi nhánh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 text-center w-10">STT</th>
                <th className="py-3 px-3">Ngày</th>
                <th className="py-3 px-3">Chi nhánh</th>
                <th className="py-3 px-3 text-center">Trạng thái chốt</th>
                <th className="py-3 px-3">Thực đơn mặn</th>
                <th className="py-3 px-3 text-right">Mặn</th>
                <th className="py-3 px-3 text-right">Chay</th>
                <th className="py-3 px-3 text-right">Cháo</th>
                <th className="py-3 px-3 text-right font-black">Tổng</th>
                <th className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">Gạo (kg)</th>
                <th className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">Nước (kg)</th>
                <th className="py-3 px-3 text-right text-yellow-600 dark:text-yellow-400">Trái cây (kg)</th>
                <th className="py-3 px-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400">
                    Không có bản ghi nhật ký phù hợp
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e, idx) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatDateDisplay(e.date)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.branchColor }} />
                        <span>{e.branchName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {e.lockStatus === "LOCKED_COOK" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          🍽️ Đã chốt ăn
                        </span>
                      ) : e.lockStatus === "LOCKED_MARKET" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          🛒 Đã chốt chợ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          ⏳ Chưa chốt
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {e.manMealType === "NUOC" ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                          🍜 {e.noodleName || "Bánh phở"}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 dark:text-amber-400 text-xs">
                          🍚 Cơm
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      {e.servingsMan.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {e.servingsChay.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-600 dark:text-cyan-400">
                      {e.servingsChao.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                      {e.totalServings.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      {e.materials.riceKg.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                      {e.manMealType === "NUOC" ? e.materials.noodleKg.toFixed(1) : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-yellow-600 dark:text-yellow-400">
                      {e.materials.fruitKg.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[180px] truncate" title={e.note}>
                      {e.note || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
