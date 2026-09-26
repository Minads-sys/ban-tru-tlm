"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Printer,
  Download,
  RotateCw,
  TrendingUp,
  TrendingDown,
  ChefHat,
  AlertTriangle,
  UserPlus,
  UserMinus,
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  Receipt,
  CheckCircle2,
  Clock,
  Banknote,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Swal from "sweetalert2";

interface StatisticsData {
  classes: Array<{ id: string; name: string }>;
  kpis: {
    totalMeals: number;
    cancellationRate: number;
    totalCancellations: number;
    newStudents: number;
    cancelledStudents: number;
    netGrowth: number;
    totalActiveStudents: number;
  };
  dailyTrend: Array<{
    dateStr: string;
    label: string;
    fullLabel?: string;
    dayName: string;
    totalRegistered: number;
    totalCanceled: number;
    finalTotal: number;
    finalMan: number;
    finalChay: number;
    finalChao: number;
    cancelRate: number;
  }>;
  monthlyGrowth: Array<{
    monthKey: string;
    label: string;
    month: number;
    year: number;
    newStudents: number;
    cancelledStudents: number;
    netGrowth: number;
  }>;
  mealDistribution: Array<{
    name: string;
    key: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  topCancellationReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  classDebtSummary?: Array<{
    classId: string;
    className: string;
    totalStudents: number;
    paidStudents: number;
    unpaidStudents: number;
    totalReceivable: number;
    totalCollected: number;
    remainingDebt: number;
    percentCollected: number;
  }>;
  financialOverview: {
    totalReceivable: number;
    totalServedMealsAmount: number;
    totalCollected: number;
    remainingDebt: number;
    unitPrice: number;
    totalMealsServed: number;
    percentCollected: number;
    paidStudentsCount: number;
    unpaidStudentsCount: number;
    totalStudentsCount: number;
    bankTransferAmount: number;
    bankTransferPercent: number;
    cashAmount: number;
    cashPercent: number;
    isEstimatedFromSchedule?: boolean;
  };
}

export default function StatsChartsView() {
  const now = new Date();
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<"today" | "week" | "month">("month");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [classId, setClassId] = useState<string>("ALL");
  const [data, setData] = useState<StatisticsData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/statistics?month=${month}&year=${year}&classId=${classId}&preset=${preset}`
      );
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        Swal.fire("Lỗi", json.error || "Không thể tải số liệu thống kê", "error");
      }
    } catch (err) {
      console.error("Fetch statistics error:", err);
      Swal.fire("Lỗi", "Không thể kết nối đến máy chủ", "error");
    } finally {
      setLoading(false);
    }
  }, [month, year, classId, preset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export to Excel using exceljs
  const handleExportExcel = async () => {
    if (!data) return;
    try {
      Swal.fire({
        title: "Đang tạo file Excel...",
        text: "Vui lòng chờ trong giây lát",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Phần mềm Bán trú TLM";
      workbook.created = new Date();

      const selectedClassObj = data?.classes?.find((c) => c.id === classId);
      const scopeText = classId === "ALL" || !selectedClassObj ? "Toàn trường" : `Lớp ${selectedClassObj.name}`;
      const periodText =
        preset === "month"
          ? `Tháng ${month}/${year}`
          : preset === "week"
          ? `Tuần này (${now.toLocaleDateString("vi-VN")})`
          : `Hôm nay (${now.toLocaleDateString("vi-VN")})`;
      const exportDateText = `${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      // ==========================================
      // SHEET 1: TỔNG QUAN KPI
      // ==========================================
      const wsKPI = workbook.addWorksheet("Tổng quan KPI");
      wsKPI.views = [{ showGridLines: true }];

      // Tiêu đề Sheet 1
      wsKPI.mergeCells("A1:C1");
      const titleKPI = wsKPI.getCell("A1");
      titleKPI.value = `BÁO CÁO TỔNG QUAN CHỈ SỐ BÁN TRÚ - ${periodText.toUpperCase()}`;
      titleKPI.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleKPI.alignment = { vertical: "middle", horizontal: "center" };
      wsKPI.getRow(1).height = 28;

      // Phụ đề Sheet 1
      wsKPI.mergeCells("A2:C2");
      const subKPI = wsKPI.getCell("A2");
      subKPI.value = `Phạm vi: ${scopeText} | Thời gian: ${periodText} | Ngày xuất file: ${exportDateText}`;
      subKPI.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subKPI.alignment = { vertical: "middle", horizontal: "center" };
      wsKPI.getRow(2).height = 20;

      wsKPI.getRow(3).height = 10;

      // Header Bảng (Dòng 4)
      const headerRowKPI = wsKPI.getRow(4);
      headerRowKPI.values = ["Chỉ số thống kê", "Giá trị", "Ghi chú giải trình"];
      headerRowKPI.height = 24;
      for (let col = 1; col <= 3; col++) {
        const cell = headerRowKPI.getCell(col);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: col === 1 ? "left" : col === 2 ? "right" : "left",
        };
      }

      wsKPI.columns = [
        { key: "metric", width: 40 },
        { key: "value", width: 28 },
        { key: "note", width: 55 },
      ];

      const kpiItems = [
        {
          metric: "Tổng số suất ăn phục vụ trong kỳ",
          value: data.kpis.totalMeals.toLocaleString("vi-VN"),
          note: `Thời gian áp dụng: ${periodText}`,
        },
        {
          metric: "Tổng số suất cắt / nghỉ ăn",
          value: data.kpis.totalCancellations.toLocaleString("vi-VN"),
          note: `Tỷ lệ cắt trung bình: ${data.kpis.cancellationRate}%`,
        },
        {
          metric: "Đăng ký bán trú mới trong kỳ",
          value: `+${data.kpis.newStudents}`,
          note: "Học sinh mới tham gia bán trú",
        },
        {
          metric: "Hủy đăng ký bán trú trong kỳ",
          value: `-${data.kpis.cancelledStudents}`,
          note: `Tăng trưởng thuần: ${data.kpis.netGrowth >= 0 ? "+" : ""}${data.kpis.netGrowth} HS`,
        },
        {
          metric: "Tổng học sinh bán trú đang hoạt động",
          value: data.kpis.totalActiveStudents.toLocaleString("vi-VN"),
          note: `Học sinh trạng thái ACTIVE (${scopeText})`,
        },
        {
          metric: "1. Tổng tiền dự kiến thu",
          value: `${data.financialOverview.totalReceivable.toLocaleString("vi-VN")} đ`,
          note: data.financialOverview.isEstimatedFromSchedule
            ? "Tạm tính theo Thời khóa biểu của học sinh ACTIVE"
            : "Theo tổng tiền hóa đơn bán trú phát hành trong tháng",
        },
        {
          metric: "2. Tổng tiền số suất ăn đã phục vụ",
          value: `${(data.financialOverview.totalServedMealsAmount || 0).toLocaleString("vi-VN")} đ`,
          note: `${(data.financialOverview.totalMealsServed || data.kpis.totalMeals).toLocaleString("vi-VN")} suất × ${(data.financialOverview.unitPrice || 45000).toLocaleString("vi-VN")} đ/suất`,
        },
        {
          metric: "3. Tổng tiền học sinh đã thanh toán",
          value: `${data.financialOverview.totalCollected.toLocaleString("vi-VN")} đ`,
          note: `Đạt ${data.financialOverview.percentCollected}% (CK SePay: ${(data.financialOverview.bankTransferAmount || 0).toLocaleString("vi-VN")} đ, Tiền mặt: ${(data.financialOverview.cashAmount || 0).toLocaleString("vi-VN")} đ)`,
        },
        {
          metric: "4. Tổng tiền dự kiến còn phải thu",
          value: `${data.financialOverview.remainingDebt.toLocaleString("vi-VN")} đ`,
          note: `${data.financialOverview.unpaidStudentsCount || 0} học sinh chưa hoàn tất tiền ăn`,
        },
      ];

      kpiItems.forEach((item) => {
        const row = wsKPI.addRow([item.metric, item.value, item.note]);
        const isHighlight =
          item.metric.startsWith("1.") ||
          item.metric.startsWith("2.") ||
          item.metric.startsWith("3.") ||
          item.metric.startsWith("4.");
        row.getCell(1).font = { bold: isHighlight };
        row.getCell(2).alignment = { horizontal: "right" };
        row.getCell(2).font = {
          bold: true,
          color:
            item.metric.startsWith("4.") && data.financialOverview.remainingDebt > 0
              ? { argb: "FFDC2626" }
              : item.metric.startsWith("3.")
              ? { argb: "FF16A34A" }
              : undefined,
        };
      });

      wsKPI.eachRow((row, rowNumber) => {
        if (rowNumber >= 4) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        }
      });

      // ==========================================
      // SHEET 2: SUẤT ĂN THEO NGÀY
      // ==========================================
      const wsDaily = workbook.addWorksheet("Suất ăn theo ngày");
      wsDaily.views = [{ showGridLines: true }];

      const totalManCount = data.mealDistribution?.find((m) => m.key === "MAN")?.count || 0;
      const totalChayCount = data.mealDistribution?.find((m) => m.key === "CHAY")?.count || 0;
      const totalChaoCount = data.mealDistribution?.find((m) => m.key === "CHAO")?.count || 0;

      // Tiêu đề Sheet 2
      wsDaily.mergeCells("A1:I1");
      const titleDaily = wsDaily.getCell("A1");
      titleDaily.value = `BÁO CÁO CHI TIẾT SUẤT ĂN HÀNG NGÀY - ${periodText.toUpperCase()}`;
      titleDaily.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleDaily.alignment = { vertical: "middle", horizontal: "center" };
      wsDaily.getRow(1).height = 28;

      // Phụ đề Sheet 2
      wsDaily.mergeCells("A2:I2");
      const subDaily = wsDaily.getCell("A2");
      subDaily.value = `Phạm vi: ${scopeText} | Tổng suất: ${data.kpis.totalMeals.toLocaleString("vi-VN")} | Cắt: ${data.kpis.totalCancellations.toLocaleString("vi-VN")} (${data.kpis.cancellationRate}%) | Mặn: ${totalManCount.toLocaleString("vi-VN")}, Chay: ${totalChayCount.toLocaleString("vi-VN")}, Cháo: ${totalChaoCount.toLocaleString("vi-VN")} | Ngày xuất: ${exportDateText}`;
      subDaily.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subDaily.alignment = { vertical: "middle", horizontal: "center" };
      wsDaily.getRow(2).height = 20;

      wsDaily.getRow(3).height = 10;

      // Header Bảng (Dòng 4)
      const headerRowDaily = wsDaily.getRow(4);
      headerRowDaily.values = [
        "Ngày",
        "Thứ",
        "Đăng ký TKB",
        "Cắt suất",
        "Tỷ lệ cắt (%)",
        "Suất Mặn",
        "Suất Chay",
        "Suất Cháo",
        "Tổng suất thực tế",
      ];
      headerRowDaily.height = 24;
      for (let col = 1; col <= 9; col++) {
        const cell = headerRowDaily.getCell(col);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      wsDaily.columns = [
        { key: "date", width: 15 },
        { key: "day", width: 14 },
        { key: "reg", width: 15 },
        { key: "cancel", width: 14 },
        { key: "rate", width: 15 },
        { key: "man", width: 14 },
        { key: "chay", width: 14 },
        { key: "chao", width: 14 },
        { key: "total", width: 18 },
      ];

      let sumReg = 0;
      let sumCancel = 0;
      let sumManDay = 0;
      let sumChayDay = 0;
      let sumChaoDay = 0;
      let sumTotalDay = 0;

      data.dailyTrend.forEach((d) => {
        sumReg += d.totalRegistered;
        sumCancel += d.totalCanceled;
        sumManDay += d.finalMan;
        sumChayDay += d.finalChay;
        sumChaoDay += d.finalChao;
        sumTotalDay += d.finalTotal;

        const row = wsDaily.addRow([
          d.dateStr,
          d.dayName,
          d.totalRegistered,
          d.totalCanceled,
          `${d.cancelRate}%`,
          d.finalMan,
          d.finalChay,
          d.finalChao,
          d.finalTotal,
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(4).alignment = { horizontal: "center" };
        if (d.totalCanceled > 0) {
          row.getCell(4).font = { color: { argb: "FFDC2626" } };
        }
        row.getCell(5).alignment = { horizontal: "center" };
        row.getCell(6).alignment = { horizontal: "center" };
        row.getCell(7).alignment = { horizontal: "center" };
        row.getCell(8).alignment = { horizontal: "center" };
        row.getCell(9).alignment = { horizontal: "center" };
        row.getCell(9).font = { bold: true, color: { argb: "FF2563EB" } };
      });

      // Dòng Tổng cộng Sheet 2
      const totalDailyRate = sumReg > 0 ? `${(Math.round((sumCancel / sumReg) * 1000) / 10)}%` : "0%";
      const totalDailyRow = wsDaily.addRow([
        "TỔNG CỘNG",
        "",
        sumReg,
        sumCancel,
        totalDailyRate,
        sumManDay,
        sumChayDay,
        sumChaoDay,
        sumTotalDay,
      ]);
      totalDailyRow.font = { bold: true };
      totalDailyRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalDailyRow.getCell(1).alignment = { horizontal: "center" };
      totalDailyRow.getCell(3).alignment = { horizontal: "center" };
      totalDailyRow.getCell(4).alignment = { horizontal: "center" };
      totalDailyRow.getCell(5).alignment = { horizontal: "center" };
      totalDailyRow.getCell(6).alignment = { horizontal: "center" };
      totalDailyRow.getCell(7).alignment = { horizontal: "center" };
      totalDailyRow.getCell(8).alignment = { horizontal: "center" };
      totalDailyRow.getCell(9).alignment = { horizontal: "center" };
      totalDailyRow.getCell(9).font = { bold: true, color: { argb: "FF2563EB" } };

      wsDaily.eachRow((row, rowNumber) => {
        if (rowNumber >= 4) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        }
      });

      // ==========================================
      // SHEET 3: BIẾN ĐỘNG SĨ SỐ THEO THÁNG
      // ==========================================
      const wsGrowth = workbook.addWorksheet("Biến động sĩ số theo tháng");
      wsGrowth.views = [{ showGridLines: true }];

      // Tiêu đề Sheet 3
      wsGrowth.mergeCells("A1:D1");
      const titleGrowth = wsGrowth.getCell("A1");
      titleGrowth.value = "BÁO CÁO BIẾN ĐỘNG SĨ SỐ BÁN TRÚ (6 THÁNG GẦN NHẤT)";
      titleGrowth.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleGrowth.alignment = { vertical: "middle", horizontal: "center" };
      wsGrowth.getRow(1).height = 28;

      // Phụ đề Sheet 3
      wsGrowth.mergeCells("A2:D2");
      const subGrowth = wsGrowth.getCell("A2");
      subGrowth.value = `Phạm vi: ${scopeText} | Sĩ số bán trú đang hoạt động: ${data.kpis.totalActiveStudents.toLocaleString("vi-VN")} HS | Ngày xuất: ${exportDateText}`;
      subGrowth.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subGrowth.alignment = { vertical: "middle", horizontal: "center" };
      wsGrowth.getRow(2).height = 20;

      wsGrowth.getRow(3).height = 10;

      // Header Bảng (Dòng 4)
      const headerRowGrowth = wsGrowth.getRow(4);
      headerRowGrowth.values = [
        "Tháng",
        "Đăng ký mới (HS)",
        "Hủy bán trú (HS)",
        "Tăng trưởng thuần (HS)",
      ];
      headerRowGrowth.height = 24;
      for (let col = 1; col <= 4; col++) {
        const cell = headerRowGrowth.getCell(col);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      wsGrowth.columns = [
        { key: "month", width: 22 },
        { key: "new", width: 20 },
        { key: "cancelled", width: 20 },
        { key: "net", width: 24 },
      ];

      let sumNewAll = 0;
      let sumCancelledAll = 0;
      let sumNetAll = 0;

      data.monthlyGrowth.forEach((m) => {
        sumNewAll += m.newStudents;
        sumCancelledAll += m.cancelledStudents;
        sumNetAll += m.netGrowth;

        const row = wsGrowth.addRow([
          m.label,
          m.newStudents,
          m.cancelledStudents,
          `${m.netGrowth >= 0 ? "+" : ""}${m.netGrowth}`,
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(2).font = { color: { argb: "FF16A34A" }, bold: true };
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(3).font = { color: { argb: "FFDC2626" } };
        row.getCell(4).alignment = { horizontal: "center" };
        row.getCell(4).font = {
          bold: true,
          color: m.netGrowth >= 0 ? { argb: "FF16A34A" } : { argb: "FFDC2626" },
        };
      });

      // Dòng Tổng cộng Sheet 3
      const totalGrowthRow = wsGrowth.addRow([
        "TỔNG CỘNG 6 THÁNG",
        sumNewAll,
        sumCancelledAll,
        `${sumNetAll >= 0 ? "+" : ""}${sumNetAll}`,
      ]);
      totalGrowthRow.font = { bold: true };
      totalGrowthRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalGrowthRow.getCell(1).alignment = { horizontal: "center" };
      totalGrowthRow.getCell(2).alignment = { horizontal: "center" };
      totalGrowthRow.getCell(3).alignment = { horizontal: "center" };
      totalGrowthRow.getCell(4).alignment = { horizontal: "center" };

      wsGrowth.eachRow((row, rowNumber) => {
        if (rowNumber >= 4) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        }
      });

      // ==========================================
      // SHEET 4: CÔNG NỢ THEO LỚP
      // ==========================================
      const wsClassDebt = workbook.addWorksheet("Công nợ theo lớp");
      wsClassDebt.views = [{ showGridLines: true }];

      // Tiêu đề Sheet 4
      wsClassDebt.mergeCells("A1:J1");
      const titleClassDebt = wsClassDebt.getCell("A1");
      titleClassDebt.value = `BÁO CÁO THỐNG KÊ CÔNG NỢ BÁN TRÚ THEO LỚP - ${periodText.toUpperCase()}`;
      titleClassDebt.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleClassDebt.alignment = { vertical: "middle", horizontal: "center" };
      wsClassDebt.getRow(1).height = 28;

      let sumStudents = 0;
      let sumPaidStudents = 0;
      let sumUnpaidStudents = 0;
      let sumReceivable = 0;
      let sumCollected = 0;
      let sumDebt = 0;

      (data.classDebtSummary || []).forEach((c) => {
        sumStudents += c.totalStudents;
        sumPaidStudents += c.paidStudents;
        sumUnpaidStudents += c.unpaidStudents;
        sumReceivable += c.totalReceivable;
        sumCollected += c.totalCollected;
        sumDebt += c.remainingDebt;
      });

      // Phụ đề Sheet 4
      wsClassDebt.mergeCells("A2:J2");
      const subClassDebt = wsClassDebt.getCell("A2");
      subClassDebt.value = `Tổng số: ${(data.classDebtSummary || []).length} lớp | Tổng phải thu: ${sumReceivable.toLocaleString("vi-VN")} đ | Đã thu: ${sumCollected.toLocaleString("vi-VN")} đ | Còn nợ: ${sumDebt.toLocaleString("vi-VN")} đ (${sumUnpaidStudents} HS nợ) | Ngày xuất: ${exportDateText}`;
      subClassDebt.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subClassDebt.alignment = { vertical: "middle", horizontal: "center" };
      wsClassDebt.getRow(2).height = 20;

      wsClassDebt.getRow(3).height = 10;

      // Header Bảng (Dòng 4)
      const headerRowClass = wsClassDebt.getRow(4);
      headerRowClass.values = [
        "STT",
        "Tên Lớp",
        "Sĩ số bán trú",
        "HS đã nộp đủ",
        "HS còn nợ",
        "Tổng phải thu",
        "Đã thu",
        "Còn nợ",
        "Tỷ lệ thu (%)",
        "Tình trạng",
      ];
      headerRowClass.height = 24;
      for (let col = 1; col <= 10; col++) {
        const cell = headerRowClass.getCell(col);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      wsClassDebt.columns = [
        { key: "stt", width: 6 },
        { key: "className", width: 14 },
        { key: "totalStudents", width: 16 },
        { key: "paidStudents", width: 16 },
        { key: "unpaidStudents", width: 15 },
        { key: "totalReceivable", width: 20 },
        { key: "totalCollected", width: 20 },
        { key: "remainingDebt", width: 20 },
        { key: "percentCollected", width: 15 },
        { key: "status", width: 20 },
      ];

      (data.classDebtSummary || []).forEach((c, idx) => {
        const row = wsClassDebt.addRow([
          idx + 1,
          c.className,
          c.totalStudents,
          c.paidStudents,
          c.unpaidStudents,
          c.totalReceivable,
          c.totalCollected,
          c.remainingDebt,
          `${c.percentCollected}%`,
          c.totalStudents === 0 ? "Chưa có HS" : c.remainingDebt === 0 ? "Hoàn tất 100%" : `Còn ${c.unpaidStudents} HS nợ`,
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(4).alignment = { horizontal: "center" };
        row.getCell(5).alignment = { horizontal: "center" };
        row.getCell(6).numFmt = '#,##0" đ"';
        row.getCell(7).numFmt = '#,##0" đ"';
        row.getCell(8).numFmt = '#,##0" đ"';
        if (c.remainingDebt > 0) {
          row.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };
        }
        row.getCell(9).alignment = { horizontal: "center" };
        row.getCell(10).alignment = { horizontal: "center" };
      });

      // Dòng Tổng Cộng toàn trường của Sheet 4
      const totalClassRow = wsClassDebt.addRow([
        "TỔNG CỘNG",
        `${(data.classDebtSummary || []).length} lớp`,
        sumStudents,
        sumPaidStudents,
        sumUnpaidStudents,
        sumReceivable,
        sumCollected,
        sumDebt,
        sumReceivable > 0 ? `${(Math.round((sumCollected / sumReceivable) * 1000) / 10)}%` : "0%",
        sumDebt === 0 && sumStudents > 0 ? "Hoàn tất 100%" : `Còn ${sumUnpaidStudents} HS nợ`,
      ]);
      totalClassRow.font = { bold: true };
      totalClassRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalClassRow.getCell(1).alignment = { horizontal: "center" };
      totalClassRow.getCell(2).alignment = { horizontal: "center" };
      totalClassRow.getCell(3).alignment = { horizontal: "center" };
      totalClassRow.getCell(4).alignment = { horizontal: "center" };
      totalClassRow.getCell(5).alignment = { horizontal: "center" };
      totalClassRow.getCell(6).numFmt = '#,##0" đ"';
      totalClassRow.getCell(7).numFmt = '#,##0" đ"';
      totalClassRow.getCell(8).numFmt = '#,##0" đ"';
      totalClassRow.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };
      totalClassRow.getCell(9).alignment = { horizontal: "center" };
      totalClassRow.getCell(10).alignment = { horizontal: "center" };

      // Kẻ viền (border) cho wsClassDebt
      wsClassDebt.eachRow((row, rowNumber) => {
        if (rowNumber >= 4) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Bao_Cao_Thong_Ke_Ban_Tru_${year}_T${month}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      Swal.fire("Thành công", "Đã xuất file Excel thành công", "success");
    } catch (err) {
      console.error("Excel export error:", err);
      Swal.fire("Lỗi", "Không thể xuất file Excel", "error");
    }
  };

  const kpis = data?.kpis || {
    totalMeals: 0,
    cancellationRate: 0,
    totalCancellations: 0,
    newStudents: 0,
    cancelledStudents: 0,
    netGrowth: 0,
    totalActiveStudents: 0,
  };

  const fin = data?.financialOverview || {
    totalReceivable: 0,
    totalServedMealsAmount: 0,
    totalCollected: 0,
    remainingDebt: 0,
    unitPrice: 45000,
    totalMealsServed: 0,
    percentCollected: 0,
    paidStudentsCount: 0,
    unpaidStudentsCount: 0,
    totalStudentsCount: 0,
    bankTransferAmount: 0,
    bankTransferPercent: 0,
    cashAmount: 0,
    cashPercent: 0,
    isEstimatedFromSchedule: false,
  };

  return (
    <div className="space-y-6">
      {/* TOP CONTROLS & FILTER BAR */}
      <Card className="border-slate-200 shadow-xs no-print">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Quick preset selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreset("month")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    preset === "month"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tháng này
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("week")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    preset === "week"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tuần này
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("today")}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    preset === "today"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hôm nay
                </button>
              </div>

              {/* Month & Year Select */}
              <div className="flex items-center gap-2">
                <Select
                  value={String(month)}
                  onValueChange={(val) => {
                    setMonth(parseInt(val));
                    setPreset("month");
                  }}
                >
                  <SelectTrigger className="w-[125px] h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Chọn tháng" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        Tháng {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(year)}
                  onValueChange={(val) => {
                    setYear(parseInt(val));
                    setPreset("month");
                  }}
                >
                  <SelectTrigger className="w-[100px] h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Chọn năm" />
                  </SelectTrigger>
                  <SelectContent>
                    {[year - 1, year, year + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        Năm {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Class filter and Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toàn trường (Tất cả lớp)</SelectItem>
                  {data?.classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Lớp {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="rounded-xl h-9 text-xs text-slate-700"
              >
                <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 rounded-xl h-9 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Xuất Excel
              </Button>

              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                In Báo Cáo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng số suất ăn */}
        <Card className="border-slate-200 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tổng suất ăn phục vụ</span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ChefHat className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {kpis.totalMeals.toLocaleString("vi-VN")}
              </span>
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 text-[10px]">
                Suất ăn
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phục vụ học sinh bán trú trong kỳ báo cáo
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />
          </CardContent>
        </Card>

        {/* KPI 2: Tỷ lệ cắt suất */}
        <Card className="border-slate-200 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tỷ lệ cắt suất ăn</span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {kpis.cancellationRate}%
              </span>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {kpis.totalCancellations} lượt nghỉ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {kpis.cancellationRate > 7
                ? "Tỷ lệ cắt suất cao hơn bình thường"
                : "Tỷ lệ duy trì trong ngưỡng an toàn"}
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </CardContent>
        </Card>

        {/* KPI 3: Đăng ký bán trú mới */}
        <Card className="border-slate-200 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Đăng ký bán trú mới</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 tracking-tight">
                +{kpis.newStudents}
              </span>
              <span className="text-xs font-medium text-slate-500">học sinh mới</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tham gia bán trú trong kỳ thống kê
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
          </CardContent>
        </Card>

        {/* KPI 4: Hủy đăng ký bán trú */}
        <Card className="border-slate-200 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Hủy đăng ký bán trú</span>
              <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <UserMinus className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-600 tracking-tight">
                -{kpis.cancelledStudents}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Tăng trưởng thuần:{" "}
                <strong
                  className={
                    kpis.netGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {kpis.netGrowth >= 0 ? `+${kpis.netGrowth}` : kpis.netGrowth}
                </strong>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hiện có {kpis.totalActiveStudents} học sinh đang ăn bán trú
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
          </CardContent>
        </Card>
      </div>

      {/* MAIN 4 CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 1: SUẤT ĂN & CẮT SUẤT THEO NGÀY (COMBO BAR + LINE) */}
        <Card className="lg:col-span-7 border-slate-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Số suất ăn và tỷ lệ hủy theo ngày
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  So sánh số suất ăn thực tế (Cột) và Tỷ lệ % cắt suất (Đường)
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                {preset === "today"
                  ? "Hôm nay"
                  : preset === "week"
                  ? "Tuần hiện tại"
                  : `Tháng ${month}/${year}`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            {data?.dailyTrend && data.dailyTrend.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.dailyTrend}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="dateStr"
                      tickFormatter={(val: string) => {
                        try {
                          const parts = val.split("-");
                          if (parts.length === 3) {
                            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                            const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                            return `${dayNames[d.getDay()]} ${parts[2]}/${parts[1]}`;
                          }
                        } catch {}
                        return val;
                      }}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#f43f5e" }}
                      unit="%"
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      domain={[0, (dataMax: number) => Math.min(100, Math.max(20, Math.ceil((dataMax || 0) * 1.15)))]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const reg = item.totalRegistered || (item.finalTotal + item.totalCanceled);
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg text-xs space-y-1.5 min-w-[210px]">
                              <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                                <span className="text-slate-900 dark:text-slate-100 font-bold">{item.fullLabel || item.label}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-0.5">
                                <span>Kế hoạch ban đầu:</span>
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {reg.toLocaleString("vi-VN")} suất
                                </strong>
                              </div>
                              <div className="flex items-center justify-between text-blue-600 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                                  Suất ăn thực tế:
                                </span>
                                <strong>{item.finalTotal.toLocaleString("vi-VN")} suất</strong>
                              </div>
                              <div className="flex items-center justify-between text-amber-600 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                                  Số suất cắt:
                                </span>
                                <strong>{item.totalCanceled.toLocaleString("vi-VN")} suất</strong>
                              </div>
                              <div className="flex items-center justify-between text-rose-600 font-bold pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                  Tỷ lệ cắt:
                                </span>
                                <span>
                                  {item.cancelRate}%
                                  <span className="text-[11px] text-slate-400 font-normal ml-1">
                                    ({item.totalCanceled}/{reg})
                                  </span>
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      yAxisId="left"
                      dataKey="finalTotal"
                      name="Suất ăn thực tế"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="totalCanceled"
                      name="Số suất cắt"
                      fill="#fbbf24"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cancelRate"
                      name="Tỷ lệ cắt (%)"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: "#f43f5e", strokeWidth: 1, stroke: "#fff" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ChefHat className="h-10 w-10 text-slate-300 mb-2" />
                <p>Chưa có dữ liệu chốt suất ăn trong khoảng thời gian này</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 2: BIẾN ĐỘNG SĨ SỐ THEO THÁNG (NET GROWTH) */}
        <Card className="lg:col-span-5 border-slate-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Biến động học sinh bán trú theo tháng
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Số học sinh Đăng ký mới vs Hủy đăng ký (6 tháng gần nhất)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            {data?.monthlyGrowth && data.monthlyGrowth.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.monthlyGrowth}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString("vi-VN")} HS`,
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: "0.75rem",
                        borderColor: "#e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="newStudents"
                      name="Đăng ký mới"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="cancelledStudents"
                      name="Hủy bán trú"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <UserPlus className="h-10 w-10 text-slate-300 mb-2" />
                <p>Chưa có dữ liệu biến động sĩ số</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 3: PHÂN BỔ LOẠI SUẤT ĂN (DONUT CHART) */}
        <Card className="lg:col-span-5 border-slate-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Tỷ lệ phân phối loại suất ăn
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Cơ cấu Suất Mặn, Suất Chay và Suất Cháo
                </CardDescription>
              </div>
              <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                {kpis.totalMeals.toLocaleString("vi-VN")} suất
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            {data?.mealDistribution && data.mealDistribution.some((d) => d.count > 0) ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 h-72">
                <div className="relative w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.mealDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {data.mealDistribution.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [
                          `${Number(val).toLocaleString("vi-VN")} suất`,
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: "0.75rem",
                          borderColor: "#e2e8f0",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list */}
                <div className="space-y-2.5 w-full sm:w-auto">
                  {data.mealDistribution.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 p-2 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {item.count.toLocaleString("vi-VN")}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ChefHat className="h-10 w-10 text-slate-300 mb-2" />
                <p>Chưa có dữ liệu cơ cấu suất ăn</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 4: TOP LÝ DO CẮT SUẤT ĂN (HORIZONTAL BARS) */}
        <Card className="lg:col-span-7 border-slate-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Lý do hủy suất ăn hàng đầu
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Phân loại từ {kpis.totalCancellations} đơn xin cắt suất trong kỳ
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Sức khỏe & Vắng mặt
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            {data?.topCancellationReasons && data.topCancellationReasons.length > 0 ? (
              <div className="space-y-4 py-2">
                {data.topCancellationReasons.map((item, idx) => {
                  const colors = [
                    "bg-blue-600",
                    "bg-indigo-500",
                    "bg-amber-500",
                    "bg-emerald-500",
                    "bg-slate-400",
                  ];
                  const barColor = colors[idx % colors.length];

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-800 flex items-center gap-1.5">
                          {idx === 0
                            ? "🤒 "
                            : idx === 1
                            ? "🏠 "
                            : idx === 2
                            ? "🍱 "
                            : idx === 3
                            ? "🏆 "
                            : "❓ "}
                          {item.reason}
                        </span>
                        <span className="text-slate-700 font-bold">
                          {item.count} lượt ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(5, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <AlertTriangle className="h-10 w-10 text-slate-300 mb-2" />
                <p>Không có dữ liệu cắt suất ăn trong kỳ báo cáo này</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FINANCIAL & BILLING PROGRESS OVERVIEW */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Tình hình Thu phí Tiền ăn & Đối soát Quyết toán (Tháng {month}/{year})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tổng hợp dòng tiền dự kiến thu, giá trị suất ăn đã phục vụ, tiền thực thu và công nợ còn lại
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-slate-50">
                Đơn giá: {fin.unitPrice.toLocaleString("vi-VN")} đ/suất
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          {/* HÀNG 1: 4 CHỈ SỐ TÀI CHÍNH TRỌNG TÂM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Tổng tiền dự kiến thu */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    1. Tổng tiền dự kiến thu
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {fin.totalReceivable.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1">đ</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-blue-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 truncate">
                  {fin.isEstimatedFromSchedule ? "Dự kiến theo TKB tháng" : "Theo hóa đơn phát hành"}
                </span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0 text-[10px] font-semibold shrink-0">
                  {fin.totalStudentsCount} HS
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />
            </div>

            {/* 2. Tổng tiền số suất ăn đã phục vụ */}
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    2. Tiền suất ăn đã phục vụ
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <ChefHat className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-indigo-950 tracking-tight">
                    {fin.totalServedMealsAmount.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1">đ</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-indigo-200/60 flex items-center justify-between text-[11px]">
                <span className="text-indigo-800 font-medium truncate">
                  {fin.totalMealsServed.toLocaleString("vi-VN")} suất × {fin.unitPrice.toLocaleString("vi-VN")} đ
                </span>
                <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-0 text-[10px] font-semibold shrink-0">
                  Bếp thực nấu
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
            </div>

            {/* 3. Tổng tiền học sinh đã thanh toán */}
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    3. Tiền HS đã thanh toán
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-emerald-800 tracking-tight">
                      {fin.totalCollected.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-1">đ</span>
                  </div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {fin.percentCollected}%
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60">
                <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, fin.percentCollected)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                  <span>Hoàn tất: {fin.paidStudentsCount}/{fin.totalStudentsCount} HS</span>
                  <span>CK & Tiền mặt</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />
            </div>

            {/* 4. Tổng tiền dự kiến còn phải thu */}
            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    4. Tiền dự kiến còn phải thu
                  </span>
                  <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-rose-700 tracking-tight">
                    {fin.remainingDebt.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1">đ</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-rose-200/60 flex items-center justify-between text-[11px]">
                <span className="text-rose-800 font-medium">Công nợ chưa nộp</span>
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 text-[10px] font-semibold shrink-0">
                  {fin.unpaidStudentsCount} HS còn nợ
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600" />
            </div>
          </div>

          {/* HÀNG 2: ĐỐI SOÁT DÒNG TIỀN & PHÂN BỔ KÊNH THANH TOÁN */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Đối soát Cân đối dòng tiền */}
            {(() => {
              const balance = fin.totalCollected - fin.totalServedMealsAmount;
              const isPositive = balance >= 0;
              return (
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isPositive
                      ? "bg-slate-50/80 border-slate-200"
                      : "bg-amber-50/80 border-amber-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className={`h-4 w-4 ${isPositive ? "text-emerald-600" : "text-amber-600"}`} />
                        ĐỐI SOÁT CÂN ĐỐI DÒNG TIỀN
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-200 text-amber-900"
                        }`}
                      >
                        {isPositive ? "Thặng dư an toàn" : "Cần tăng thu"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className={`text-xl font-black ${
                          isPositive ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {isPositive ? `+${balance.toLocaleString("vi-VN")}` : balance.toLocaleString("vi-VN")} đ
                      </span>
                      <span className="text-[11px] text-slate-500">(Đã thu − Thực nấu)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    {isPositive
                      ? "Dòng tiền an toàn: Số tiền học sinh đã đóng đủ chi trả toàn bộ suất ăn bếp đã phục vụ."
                      : "Cảnh báo dòng tiền: Số tiền đã thu chưa đủ bù đắp giá trị suất ăn đã nấu, cần đẩy nhanh thu tiền ăn."}
                  </p>
                </div>
              );
            })()}

            {/* Box 2: Chuyển khoản QR SePay */}
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between text-xs font-bold text-blue-900 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    CHUYỂN KHOẢN VIETQR SEPAY
                  </span>
                  <span className="text-blue-800 font-extrabold">{fin.bankTransferPercent}%</span>
                </div>
                <div className="text-xl font-black text-blue-950 mt-1">
                  {fin.bankTransferAmount.toLocaleString("vi-VN")} đ
                </div>
              </div>
              <div className="mt-2.5">
                <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, fin.bankTransferPercent)}%` }}
                  />
                </div>
                <p className="text-[11px] text-blue-700">
                  Giao dịch quét mã QR VietQR tự động khớp lệnh
                </p>
              </div>
            </div>

            {/* Box 3: Tiền mặt thủ quỹ */}
            <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between text-xs font-bold text-amber-900 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    TIỀN MẶT THỦ QUỸ
                  </span>
                  <span className="text-amber-800 font-extrabold">{fin.cashPercent}%</span>
                </div>
                <div className="text-xl font-black text-amber-950 mt-1">
                  {fin.cashAmount.toLocaleString("vi-VN")} đ
                </div>
              </div>
              <div className="mt-2.5">
                <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, fin.cashPercent)}%` }}
                  />
                </div>
                <p className="text-[11px] text-amber-800">
                  Biên lai nộp tiền mặt trực tiếp tại văn phòng
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
