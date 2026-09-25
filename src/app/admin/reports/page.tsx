"use client";

import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart3,
  Printer,
  Loader2,
  ChefHat,
  CreditCard,
  Users,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Search,
  FileDown,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import StatsChartsView from "./StatsChartsView";
import ExcelJS from "exceljs";

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Báo cáo suất ăn hàng ngày
  const [dailyReport, setDailyReport] = useState<{
    date: string;
    lockTime2: string;
    isFullyLocked: boolean;
    isAfterLockTime?: boolean;
    isExpectedLocked: boolean;
    totalSummary: {
      totalRegistered: number;
      totalCanceled: number;
      finalMan: number;
      finalChay: number;
      finalChao: number;
      finalTotal: number;
      expectedMan: number;
      expectedChay: number;
      expectedChao: number;
      expectedTotal: number;
    };
    classSummaries: Array<{
      classId: string;
      className: string;
      totalRegistered: number;
      totalCanceled: number;
      finalMan: number;
      finalChay: number;
      finalChao: number;
      finalTotal: number;
      expectedMan: number;
      expectedChay: number;
      expectedChao: number;
      expectedTotal: number;
      isLocked: boolean;
      expectedLockedAt: string | null;
    }>;
  } | null>(null);

  // Helper check if report is past lock time 2 (chốt chính thức)
  const isPastLockTime2 = () => {
    if (dailyReport?.isAfterLockTime !== undefined) return dailyReport.isAfterLockTime;
    if (!dailyReport) return false;
    const now = new Date();
    const vnTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnNow = new Date(vnTimeStr);
    
    // Convert report date
    const [y, m, d] = dailyReport.date.split("-").map(Number);
    const rDate = new Date(y, m - 1, d);
    
    const today = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
    
    if (rDate.getTime() < today.getTime()) return true; // Quá khứ
    if (rDate.getTime() > today.getTime()) return false; // Tương lai
    
    // Hôm nay, so sánh giờ phút
    const [hours, minutes] = dailyReport.lockTime2.split(":").map(Number);
    if (vnNow.getHours() > hours) return true;
    if (vnNow.getHours() === hours && vnNow.getMinutes() >= minutes) return true;
    
    return false;
  };

  const handleManualLock = async (type: "EXPECTED" | "FINAL") => {
    try {
      const confirmMsg = type === "EXPECTED" 
        ? "Bạn có chắc chắn muốn CHỐT DỰ KIẾN (Lần 1) với dữ liệu hiện tại?" 
        : "Bạn có chắc chắn muốn CHỐT CHÍNH THỨC (Lần 2) với dữ liệu hiện tại? Số liệu này sẽ được khóa để chia ăn và tính tiền.";
      
      const confirm = await Swal.fire({
        title: "Xác nhận",
        text: confirmMsg,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Đồng ý",
        cancelButtonText: "Hủy",
      });

      if (!confirm.isConfirmed) return;

      setLoading(true);
      const res = await fetch("/api/daily-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate, type }),
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchDailyReport();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể chốt suất", "error");
      }
    } catch (error) {
      Swal.fire("Lỗi", "Lỗi kết nối", "error");
    } finally {
      setLoading(false);
    }
  };

  // Các state và fetch function khác giữ nguyên
  // Báo cáo công nợ
  interface DebtReportBill {
    id: string;
    studentId: string;
    student: {
      studentCode: string;
      boardingCode?: string | null;
      user: { fullName: string };
      class?: { id?: string; name: string } | null;
      classId?: string;
    };
    finalAmount: string | number;
    paymentStatus: string;
    transactions?: Array<{
      id: string;
      amount: string | number;
      transDate: string;
    }>;
  }
  const [debtReport, setDebtReport] = useState<DebtReportBill[]>([]);
  const [allMonthBills, setAllMonthBills] = useState<any[]>([]);
  const [debtViewMode, setDebtViewMode] = useState<"class_summary" | "student_detail">("class_summary");

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-meals?date=${reportDate}`);
      const data = await res.json();
      setDailyReport(data);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/billing?month=${reportMonth}&year=${reportYear}&limit=5000`
      );
      const json = await res.json();
      const rawBills: any[] = Array.isArray(json) ? json : (json?.data || []);
      setAllMonthBills(rawBills);
      // Lọc các học sinh chưa thanh toán (UNPAID) hoặc thanh toán 1 phần (PARTIAL)
      const debts = rawBills.filter(
        (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
      );
      setDebtReport(debts);
    } catch (err) {
      console.error("Lỗi khi tải báo cáo công nợ:", err);
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo công nợ", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtReport();
  }, [reportMonth, reportYear]);

  // Danh sách lớp học để phục vụ bộ lọc
  const [classes, setClasses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClasses(data);
      })
      .catch((err) => console.error("Lỗi khi tải danh sách lớp:", err));
  }, []);

  // Bộ lọc danh sách công nợ
  const [debtSearchTerm, setDebtSearchTerm] = useState("");
  const [debtSelectedClass, setDebtSelectedClass] = useState("all");
  const [debtPaymentStatus, setDebtPaymentStatus] = useState("all");

  // Dữ liệu công nợ sau khi lọc
  const filteredDebts = useMemo(() => {
    return debtReport.filter((bill) => {
      // 1. Lọc theo lớp
      if (debtSelectedClass !== "all") {
        const clsName = bill.student.class?.name || (bill.student as any).classId;
        if (clsName !== debtSelectedClass && (bill.student as any).classId !== debtSelectedClass) {
          return false;
        }
      }
      // 2. Lọc theo trạng thái nợ
      if (debtPaymentStatus !== "all") {
        if (bill.paymentStatus !== debtPaymentStatus) return false;
      }
      // 3. Lọc theo từ khóa tìm kiếm
      if (debtSearchTerm.trim()) {
        const q = debtSearchTerm.trim().toLowerCase();
        const fullName = (bill.student.user?.fullName || "").toLowerCase();
        const studentCode = (bill.student.studentCode || "").toLowerCase();
        const boardingCode = (bill.student.boardingCode || "").toLowerCase();
        const clsName = (bill.student.class?.name || "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !studentCode.includes(q) &&
          !boardingCode.includes(q) &&
          !clsName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [debtReport, debtSelectedClass, debtPaymentStatus, debtSearchTerm]);

  // Tổng nợ của danh sách đã lọc
  const totalFilteredRemainingDebt = useMemo(() => {
    return filteredDebts.reduce((sum, b) => {
      const paid = (b.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
      return sum + Math.max(0, Number(b.finalAmount) - paid);
    }, 0);
  }, [filteredDebts]);

  // Thống kê công nợ theo từng lớp
  const classDebtStats = useMemo(() => {
    if (allMonthBills.length === 0) return [];

    const map = new Map<
      string,
      {
        classId: string;
        className: string;
        totalStudents: number;
        paidStudents: number;
        unpaidStudents: number;
        totalReceivable: number;
        totalCollected: number;
        remainingDebt: number;
        percentCollected: number;
      }
    >();

    // Đưa danh mục lớp vào trước
    classes.forEach((c) => {
      map.set(c.id, {
        classId: c.id,
        className: c.name || c.id,
        totalStudents: 0,
        paidStudents: 0,
        unpaidStudents: 0,
        totalReceivable: 0,
        totalCollected: 0,
        remainingDebt: 0,
        percentCollected: 0,
      });
    });

    // Duyệt qua toàn bộ hóa đơn trong tháng
    allMonthBills.forEach((b) => {
      const billFinal = Number(b.finalAmount) || 0;
      const billPaid = (b.transactions || []).reduce(
        (s: number, t: any) => s + (Number(t.amount) || 0),
        0
      );
      const debt = Math.max(0, billFinal - billPaid);

      const clsId = b.student?.classId || b.student?.class?.id || "OTHER";
      const clsName = b.student?.class?.name || b.student?.classId || "Khác";

      if (!map.has(clsId)) {
        map.set(clsId, {
          classId: clsId,
          className: clsName,
          totalStudents: 0,
          paidStudents: 0,
          unpaidStudents: 0,
          totalReceivable: 0,
          totalCollected: 0,
          remainingDebt: 0,
          percentCollected: 0,
        });
      }

      const rec = map.get(clsId)!;
      rec.totalStudents += 1;
      rec.totalReceivable += billFinal;
      rec.totalCollected += billPaid;
      rec.remainingDebt += debt;

      if (billPaid >= billFinal && billFinal > 0) {
        rec.paidStudents += 1;
      } else if (debt > 0) {
        rec.unpaidStudents += 1;
      }
    });

    return Array.from(map.values())
      .filter((c) => c.totalStudents > 0)
      .map((c) => ({
        ...c,
        percentCollected:
          c.totalReceivable > 0
            ? Math.round((c.totalCollected / c.totalReceivable) * 1000) / 10
            : c.totalStudents > 0 && c.remainingDebt === 0
            ? 100
            : 0,
      }))
      .sort((a, b) =>
        a.className.localeCompare(b.className, undefined, { numeric: true })
      );
  }, [allMonthBills, classes]);

  // Tổng hợp chỉ số công nợ toàn trường
  const overallDebtStats = useMemo(() => {
    const totalReceivable = classDebtStats.reduce((sum, c) => sum + c.totalReceivable, 0);
    const totalCollected = classDebtStats.reduce((sum, c) => sum + c.totalCollected, 0);
    const remainingDebt = classDebtStats.reduce((sum, c) => sum + c.remainingDebt, 0);
    const totalStudents = classDebtStats.reduce((sum, c) => sum + c.totalStudents, 0);
    const paidStudents = classDebtStats.reduce((sum, c) => sum + c.paidStudents, 0);
    const unpaidStudents = classDebtStats.reduce((sum, c) => sum + c.unpaidStudents, 0);
    const percentCollected =
      totalReceivable > 0
        ? Math.round((totalCollected / totalReceivable) * 1000) / 10
        : 0;
    const completedClassesCount = classDebtStats.filter(
      (c) => c.remainingDebt === 0 && c.totalStudents > 0
    ).length;

    return {
      totalReceivable,
      totalCollected,
      remainingDebt,
      totalStudents,
      paidStudents,
      unpaidStudents,
      percentCollected,
      completedClassesCount,
      totalClassesCount: classDebtStats.length,
    };
  }, [classDebtStats]);

  // Xuất file Excel công nợ gồm 2 Sheet: Sheet 1 Tổng hợp theo lớp, Sheet 2 Chi tiết học sinh nợ
  const handleExportDebtExcel = async () => {
    if (classDebtStats.length === 0 && filteredDebts.length === 0) {
      Swal.fire("Thông báo", "Không có dữ liệu công nợ để xuất file!", "info");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Phần mềm Bán trú TLM";
      workbook.created = new Date();

      // ==========================================
      // SHEET 1: TỔNG HỢP CÔNG NỢ THEO LỚP
      // ==========================================
      const wsClass = workbook.addWorksheet("Tổng hợp theo lớp");

      wsClass.mergeCells("A1:J1");
      const titleClass = wsClass.getCell("A1");
      titleClass.value = `BÁO CÁO TỔNG HỢP CÔNG NỢ BÁN TRÚ THEO LỚP - THÁNG ${reportMonth}/${reportYear}`;
      titleClass.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleClass.alignment = { vertical: "middle", horizontal: "center" };
      wsClass.getRow(1).height = 28;

      wsClass.mergeCells("A2:J2");
      const subClass = wsClass.getCell("A2");
      subClass.value = `Tổng số: ${classDebtStats.length} lớp | Tổng HS bán trú: ${overallDebtStats.totalStudents} | Tổng phải thu: ${overallDebtStats.totalReceivable.toLocaleString("vi-VN")} đ | Đã thu: ${overallDebtStats.totalCollected.toLocaleString("vi-VN")} đ | Còn nợ: ${overallDebtStats.remainingDebt.toLocaleString("vi-VN")} đ (${overallDebtStats.unpaidStudents} HS nợ)`;
      subClass.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subClass.alignment = { vertical: "middle", horizontal: "center" };
      wsClass.getRow(2).height = 20;

      wsClass.getRow(4).values = [
        "STT",
        "Tên Lớp",
        "Sĩ số BT",
        "Đã nộp đủ (HS)",
        "Còn nợ (HS)",
        "Tổng phải thu",
        "Đã thu",
        "Còn nợ",
        "Tỷ lệ thu",
        "Trạng thái",
      ];
      wsClass.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsClass.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      wsClass.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
      wsClass.getRow(4).height = 24;

      wsClass.columns = [
        { key: "stt", width: 6 },
        { key: "className", width: 14 },
        { key: "totalStudents", width: 14 },
        { key: "paidStudents", width: 16 },
        { key: "unpaidStudents", width: 16 },
        { key: "totalReceivable", width: 20 },
        { key: "totalCollected", width: 20 },
        { key: "remainingDebt", width: 20 },
        { key: "percentCollected", width: 16 },
        { key: "status", width: 20 },
      ];

      classDebtStats.forEach((c, idx) => {
        const row = wsClass.addRow({
          stt: idx + 1,
          className: c.className,
          totalStudents: c.totalStudents,
          paidStudents: c.paidStudents,
          unpaidStudents: c.unpaidStudents,
          totalReceivable: c.totalReceivable,
          totalCollected: c.totalCollected,
          remainingDebt: c.remainingDebt,
          percentCollected: `${c.percentCollected}%`,
          status:
            c.totalStudents === 0
              ? "Chưa có HS"
              : c.remainingDebt === 0
              ? "Hoàn tất 100%"
              : `Còn ${c.unpaidStudents} HS nợ`,
        });

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

      // Dòng Tổng Cộng của Sheet 1
      const totalClassRow = wsClass.addRow({
        stt: "TỔNG CỘNG",
        className: `${classDebtStats.length} lớp`,
        totalStudents: overallDebtStats.totalStudents,
        paidStudents: overallDebtStats.paidStudents,
        unpaidStudents: overallDebtStats.unpaidStudents,
        totalReceivable: overallDebtStats.totalReceivable,
        totalCollected: overallDebtStats.totalCollected,
        remainingDebt: overallDebtStats.remainingDebt,
        percentCollected: `${overallDebtStats.percentCollected}%`,
        status:
          overallDebtStats.remainingDebt === 0 && overallDebtStats.totalStudents > 0
            ? "Hoàn tất 100%"
            : `Còn ${overallDebtStats.unpaidStudents} HS nợ`,
      });
      totalClassRow.font = { bold: true };
      totalClassRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalClassRow.getCell(6).numFmt = '#,##0" đ"';
      totalClassRow.getCell(7).numFmt = '#,##0" đ"';
      totalClassRow.getCell(8).numFmt = '#,##0" đ"';
      totalClassRow.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };

      // Kẻ viền cho Sheet 1
      wsClass.eachRow((row, rowNumber) => {
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
      // SHEET 2: CHI TIẾT HỌC SINH CÔNG NỢ
      // ==========================================
      const wsStudent = workbook.addWorksheet("Chi tiết học sinh nợ");
      const classNameText =
        debtSelectedClass !== "all" ? `Lớp ${debtSelectedClass}` : "Toàn trường";

      wsStudent.mergeCells("A1:I1");
      const titleStudent = wsStudent.getCell("A1");
      titleStudent.value = `BÁO CÁO CHI TIẾT HỌC SINH CÔNG NỢ - THÁNG ${reportMonth}/${reportYear}`;
      titleStudent.font = { bold: true, size: 14, color: { argb: "FF1E3A8A" } };
      titleStudent.alignment = { vertical: "middle", horizontal: "center" };
      wsStudent.getRow(1).height = 28;

      wsStudent.mergeCells("A2:I2");
      const subStudent = wsStudent.getCell("A2");
      subStudent.value = `Phạm vi: ${classNameText} | Số lượng: ${filteredDebts.length} học sinh nợ | Tổng nợ: ${totalFilteredRemainingDebt.toLocaleString("vi-VN")} đ${
        debtSearchTerm ? ` | Tìm kiếm: "${debtSearchTerm}"` : ""
      }`;
      subStudent.font = { italic: true, size: 10, color: { argb: "FF475569" } };
      subStudent.alignment = { vertical: "middle", horizontal: "center" };
      wsStudent.getRow(2).height = 20;

      wsStudent.getRow(4).values = [
        "STT",
        "Mã Bán Trú",
        "Mã HS / CCCD",
        "Họ và tên",
        "Lớp",
        "Tổng tiền phải đóng",
        "Đã nộp",
        "Còn nợ",
        "Trạng thái",
      ];
      wsStudent.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsStudent.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      wsStudent.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
      wsStudent.getRow(4).height = 24;

      wsStudent.columns = [
        { key: "stt", width: 6 },
        { key: "boardingCode", width: 14 },
        { key: "studentCode", width: 18 },
        { key: "fullName", width: 25 },
        { key: "className", width: 12 },
        { key: "totalAmount", width: 20 },
        { key: "paidAmount", width: 16 },
        { key: "remainingDebt", width: 20 },
        { key: "status", width: 16 },
      ];

      let totalBillAmount = 0;
      let totalPaidAmount = 0;
      let totalDebtAmount = 0;

      filteredDebts.forEach((bill, idx) => {
        const billTotal = Number(bill.finalAmount);
        const paid = (bill.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
        const remaining = Math.max(0, billTotal - paid);

        totalBillAmount += billTotal;
        totalPaidAmount += paid;
        totalDebtAmount += remaining;

        const row = wsStudent.addRow([
          idx + 1,
          bill.student.boardingCode || "—",
          bill.student.studentCode || "—",
          bill.student.user?.fullName || "",
          bill.student.class?.name || "—",
          billTotal,
          paid,
          remaining,
          bill.paymentStatus === "PARTIAL" ? "Đã nộp 1 phần" : "Chưa TT",
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(5).alignment = { horizontal: "center" };
        row.getCell(6).numFmt = '#,##0" đ"';
        row.getCell(7).numFmt = '#,##0" đ"';
        row.getCell(8).numFmt = '#,##0" đ"';
        row.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };
        row.getCell(9).alignment = { horizontal: "center" };
      });

      // Dòng Tổng Cộng của Sheet 2
      const totalStudentRow = wsStudent.addRow([
        "TỔNG CỘNG",
        "",
        "",
        `${filteredDebts.length} học sinh`,
        "",
        totalBillAmount,
        totalPaidAmount,
        totalDebtAmount,
        "",
      ]);
      totalStudentRow.font = { bold: true };
      totalStudentRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalStudentRow.getCell(6).numFmt = '#,##0" đ"';
      totalStudentRow.getCell(7).numFmt = '#,##0" đ"';
      totalStudentRow.getCell(8).numFmt = '#,##0" đ"';
      totalStudentRow.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };

      // Kẻ viền cho Sheet 2
      wsStudent.eachRow((row, rowNumber) => {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const classSuffix = debtSelectedClass !== "all" ? `_${debtSelectedClass}` : "";
      a.download = `Bao_Cao_Cong_No_T${reportMonth}_${reportYear}${classSuffix}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Lỗi xuất Excel công nợ:", err);
      Swal.fire("Lỗi", "Không thể xuất file Excel", "error");
    }
  };

  // Báo cáo nợ quá hạn đa tháng
  interface OverdueDebt {
    studentId: string;
    studentName: string;
    className: string;
    unpaidCount: number;
    totalDebt: number;
    months: string[];
  }
  const [overdueReport, setOverdueReport] = useState<OverdueDebt[]>([]);

  const fetchOverdueReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/overdue-debt");
      const data = await res.json();
      if (data.success) {
        setOverdueReport(data.data);
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo nợ quá hạn", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 no-print flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        Báo cáo & Thống kê
      </h1>

      <Tabs defaultValue="charts" className="no-print">
        <TabsList className="mb-4 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-2xs h-auto">
          <TabsTrigger
            value="charts"
            className="py-2 px-3.5 font-semibold cursor-pointer transition-all duration-150 text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <BarChart3 className="h-4 w-4 mr-1.5 text-slate-600 group-data-[state=active]:text-white" />
            Biểu đồ thống kê
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="py-2 px-3.5 font-semibold cursor-pointer transition-all duration-150 text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <ChefHat className="h-4 w-4 mr-1.5 text-slate-600 group-data-[state=active]:text-white" />
            Suất ăn hàng ngày
          </TabsTrigger>
          <TabsTrigger
            value="debt"
            className="py-2 px-3.5 font-semibold cursor-pointer transition-all duration-150 text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <CreditCard className="h-4 w-4 mr-1.5 text-slate-600 group-data-[state=active]:text-white" />
            Công nợ
          </TabsTrigger>
          <TabsTrigger
            value="overdue"
            className="py-2 px-3.5 font-semibold cursor-pointer transition-all duration-150 text-red-600 hover:text-red-900 hover:bg-red-100/80 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5 text-red-600 group-data-[state=active]:text-white" />
            Nợ quá hạn
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB BIỂU ĐỒ THỐNG KÊ ============ */}
        <TabsContent value="charts" className="space-y-4">
          <StatsChartsView />
        </TabsContent>

        {/* ============ BÁO CÁO SUẤT ĂN HÀNG NGÀY ============ */}
        <TabsContent value="daily">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end">
                <div>
                  <Label>Ngày báo cáo</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
                <Button onClick={fetchDailyReport} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Xem báo cáo
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  In
                </Button>
              </div>
            </CardContent>
          </Card>

          {dailyReport && (
            <>
              {/* Vùng nút bấm chốt sổ thủ công */}
              <div className="flex gap-4 mb-4 justify-end">
                {!dailyReport.isFullyLocked && (
                  <Button variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => handleManualLock("EXPECTED")}>
                    {dailyReport.isExpectedLocked ? "Cập nhật lại Số Dự Kiến" : "Chốt số Dự Kiến (Lần 1)"}
                  </Button>
                )}
                {(!dailyReport.isFullyLocked && isPastLockTime2()) && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleManualLock("FINAL")}>
                    Chốt Chính Thức (Lần 2)
                  </Button>
                )}
              </div>

              {/* Tổng hợp */}
              <div className="flex items-center gap-2 mb-3 mt-4">
                <h2 className="text-lg font-semibold text-slate-800">Tổng hợp toàn trường</h2>
                {dailyReport.classSummaries.length === 0 ? (
                  <Badge className="bg-slate-100 text-slate-500 border-slate-200">Không có dữ liệu</Badge>
                ) : dailyReport.isFullyLocked ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300">Đã chốt sổ ngày ăn</Badge>
                ) : dailyReport.isExpectedLocked ? (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300">Đã chốt suất dự kiến đi chợ</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300">Chưa chốt</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Đăng ký</p>
                    <p className="text-xl font-bold">
                      {dailyReport.totalSummary.totalRegistered}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Cắt suất</p>
                    <p className="text-xl font-bold text-red-600">
                      {dailyReport.totalSummary.totalCanceled}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Mặn</p>
                    <p className="text-xl font-bold text-orange-600">
                      {dailyReport.totalSummary.finalMan}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Chay</p>
                    <p className="text-xl font-bold text-green-600">
                      {dailyReport.totalSummary.finalChay}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Cháo</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {dailyReport.totalSummary.finalChao}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Tổng suất</p>
                    <p className="text-xl font-bold text-blue-600">
                      {dailyReport.totalSummary.finalTotal}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chi tiết theo lớp */}
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiết theo lớp - Ngày {formatDate(reportDate)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(dailyReport.isFullyLocked || isPastLockTime2()) ? (
                    <div className="bg-emerald-600 text-white font-bold py-2.5 px-4 text-center text-sm rounded flex items-center justify-center gap-2 shadow-xs uppercase tracking-wide">
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                      <span>ĐÃ CHỐT SỐ BÁO BẾP</span>
                    </div>
                  ) : (
                    <div className="bg-red-600 text-white font-bold py-2.5 px-4 text-center text-sm rounded flex items-center justify-center gap-2 shadow-xs tracking-wide">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <span>Số liệu chưa chốt</span>
                      <span className="text-xs font-normal opacity-90">
                        (Giờ chốt tự động trong cài đặt: {dailyReport.lockTime2 || "07:00"})
                      </span>
                    </div>
                  )}
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lớp</TableHead>
                          <TableHead className="text-center">Đăng ký</TableHead>
                          <TableHead className="text-center">Cắt suất</TableHead>
                          <TableHead className="text-center bg-orange-50">Mặn</TableHead>
                          <TableHead className="text-center bg-green-50">Chay</TableHead>
                          <TableHead className="text-center bg-yellow-50">Cháo</TableHead>
                          <TableHead className="text-center font-bold">Tổng suất</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReport.classSummaries.map((cs) => (
                          <TableRow key={cs.classId}>
                            <TableCell className="font-medium">{cs.className}</TableCell>
                            <TableCell className="text-center">{cs.totalRegistered}</TableCell>
                            <TableCell className="text-center text-red-600">
                              {cs.totalCanceled}
                            </TableCell>
                            <TableCell className="text-center bg-orange-50">{cs.finalMan}</TableCell>
                            <TableCell className="text-center bg-green-50">{cs.finalChay}</TableCell>
                            <TableCell className="text-center bg-yellow-50">{cs.finalChao}</TableCell>
                            <TableCell className="text-center font-bold text-blue-600">{cs.finalTotal}</TableCell>
                            <TableCell className="text-center">
                              {cs.isLocked ? (
                                <Badge className="bg-green-100 text-green-700">Đã chốt</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700">Chưa chốt</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============ BÁO CÁO CÔNG NỢ ============ */}
        <TabsContent value="debt" className="space-y-4">
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Hàng 1: Chọn Tháng / Năm & Nút Tải dữ liệu & In & Xuất Excel */}
              <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-slate-100">
                <div className="w-24">
                  <Label className="text-xs font-semibold text-slate-600">Tháng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={reportMonth}
                    onChange={(e) => setReportMonth(parseInt(e.target.value) || 1)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs font-semibold text-slate-600">Năm</Label>
                  <Input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value) || 2026)}
                    className="h-9 text-xs"
                  />
                </div>
                <Button onClick={fetchDebtReport} disabled={loading} className="h-9 text-xs font-semibold cursor-pointer">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Users className="h-4 w-4 mr-1.5" />
                  )}
                  Xem công nợ
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={handleExportDebtExcel}
                  disabled={classDebtStats.length === 0 && filteredDebts.length === 0}
                  className="h-9 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                  title="Xuất file Excel gồm 2 Sheet (Tổng hợp theo lớp & Chi tiết học sinh nợ)"
                >
                  <FileDown className="h-4 w-4 mr-1.5 text-emerald-600" />
                  Xuất File Excel (2 Sheet)
                </Button>
                <Button variant="outline" onClick={() => window.print()} className="h-9 text-xs cursor-pointer">
                  <Printer className="h-4 w-4 mr-1.5" />
                  In
                </Button>
              </div>

              {/* Chuyển đổi chế độ xem: [ Thống kê theo lớp ] vs [ Chi tiết học sinh nợ ] */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDebtViewMode("class_summary")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      debtViewMode === "class_summary"
                        ? "bg-white text-blue-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Thống kê theo lớp
                    {classDebtStats.length > 0 && (
                      <Badge className="ml-1 bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0 h-4 border-none">
                        {classDebtStats.length}
                      </Badge>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtViewMode("student_detail")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      debtViewMode === "student_detail"
                        ? "bg-white text-blue-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Chi tiết học sinh nợ
                    {debtReport.length > 0 && (
                      <Badge className="ml-1 bg-red-100 text-red-800 text-[10px] px-1.5 py-0 h-4 border-none">
                        {debtReport.length}
                      </Badge>
                    )}
                  </button>
                </div>

                {debtViewMode === "student_detail" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Tìm tên, mã BT, CCCD..."
                        value={debtSearchTerm}
                        onChange={(e) => setDebtSearchTerm(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    {/* Filter Class */}
                    <div className="w-36">
                      <Select value={debtSelectedClass} onValueChange={setDebtSelectedClass}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Tất cả các lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả các lớp</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.name || c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Filter Status */}
                    <div className="w-36">
                      <Select value={debtPaymentStatus} onValueChange={setDebtPaymentStatus}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Trạng thái" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả trạng thái</SelectItem>
                          <SelectItem value="UNPAID">Chưa thanh toán</SelectItem>
                          <SelectItem value="PARTIAL">Đã nộp 1 phần</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(debtSearchTerm || debtSelectedClass !== "all" || debtPaymentStatus !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDebtSearchTerm("");
                          setDebtSelectedClass("all");
                          setDebtPaymentStatus("all");
                        }}
                        className="h-8 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Xóa lọc
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPI CARDS CÔNG NỢ */}
          {allMonthBills.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Tổng dự kiến phải thu</span>
                    <CreditCard className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                    {overallDebtStats.totalReceivable.toLocaleString("vi-VN")} đ
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Toàn trường: {overallDebtStats.totalStudents} học sinh bán trú
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs bg-emerald-50/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                    <span>Đã thu thực tế</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                    {overallDebtStats.totalCollected.toLocaleString("vi-VN")} đ
                  </div>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center justify-between">
                    <span>Đạt {overallDebtStats.percentCollected}%</span>
                    <span>{overallDebtStats.paidStudents} HS đã nộp đủ</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs bg-red-50/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-xs text-red-700 font-semibold">
                    <span>Còn phải thu (Công nợ)</span>
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-red-600 font-mono">
                    {overallDebtStats.remainingDebt.toLocaleString("vi-VN")} đ
                  </div>
                  <p className="text-xs text-red-600 mt-1 flex items-center justify-between">
                    <span>Chưa thu: {(100 - overallDebtStats.percentCollected).toFixed(1)}%</span>
                    <span>{overallDebtStats.unpaidStudents} HS còn nợ</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Tiến độ hoàn tất các lớp</span>
                    <GraduationCap className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-purple-700">
                    {overallDebtStats.completedClassesCount} / {overallDebtStats.totalClassesCount} lớp
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {overallDebtStats.completedClassesCount === overallDebtStats.totalClassesCount && overallDebtStats.totalClassesCount > 0
                      ? "100% các lớp đã hoàn tất"
                      : `Còn ${overallDebtStats.totalClassesCount - overallDebtStats.completedClassesCount} lớp chưa hoàn tất`}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CHẾ ĐỘ 1: THỐNG KÊ CÔNG NỢ THEO LỚP */}
          {debtViewMode === "class_summary" && (
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="pb-3 border-b bg-slate-50/60 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  Bảng tổng hợp công nợ theo lớp - Tháng {reportMonth}/{reportYear}
                </CardTitle>
                <span className="text-xs text-slate-500 italic hidden sm:inline">
                  Bấm "Xem HS nợ" ở từng lớp để xem danh sách học sinh còn nợ
                </span>
              </CardHeader>
              <CardContent className="p-0 sm:p-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[11px]">
                      <TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead className="font-bold">Lớp</TableHead>
                      <TableHead className="text-center">Sĩ số BT</TableHead>
                      <TableHead className="text-center text-emerald-700">Đã nộp đủ</TableHead>
                      <TableHead className="text-center text-red-600">Còn nợ (HS)</TableHead>
                      <TableHead className="text-right">Tổng phải thu</TableHead>
                      <TableHead className="text-right text-emerald-600">Đã thu</TableHead>
                      <TableHead className="text-right font-bold text-red-600">Còn nợ (VNĐ)</TableHead>
                      <TableHead className="text-center">Tỷ lệ thu</TableHead>
                      <TableHead className="text-center">Trạng thái</TableHead>
                      <TableHead className="text-center w-28">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classDebtStats.map((c, idx) => {
                      const isComplete = c.remainingDebt === 0 && c.totalStudents > 0;
                      return (
                        <TableRow key={c.classId} className="hover:bg-slate-50 text-xs">
                          <TableCell className="text-center font-medium text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-bold text-blue-700">{c.className}</TableCell>
                          <TableCell className="text-center font-semibold">{c.totalStudents}</TableCell>
                          <TableCell className="text-center text-emerald-700 font-medium">{c.paidStudents}</TableCell>
                          <TableCell className="text-center text-red-600 font-semibold">
                            {c.unpaidStudents > 0 ? c.unpaidStudents : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {c.totalReceivable.toLocaleString("vi-VN")}đ
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 font-medium">
                            {c.totalCollected.toLocaleString("vi-VN")}đ
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-red-600">
                            {c.remainingDebt > 0 ? `${c.remainingDebt.toLocaleString("vi-VN")}đ` : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                c.percentCollected === 100
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.percentCollected >= 70
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {c.percentCollected}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {isComplete ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                                Hoàn tất 100%
                              </Badge>
                            ) : c.remainingDebt > 0 ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                Còn {c.unpaidStudents} HS nợ
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 text-[10px]">
                                Chưa phát sinh
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={c.unpaidStudents === 0}
                              onClick={() => {
                                setDebtSelectedClass(c.className);
                                setDebtViewMode("student_detail");
                              }}
                              className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 cursor-pointer font-medium"
                              title={`Xem chi tiết học sinh nợ lớp ${c.className}`}
                            >
                              Xem HS nợ
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {classDebtStats.length > 0 && (
                      <TableRow className="bg-slate-100/80 font-bold text-xs border-t-2 border-slate-300">
                        <TableCell className="text-center" colSpan={2}>
                          TỔNG CỘNG ({classDebtStats.length} lớp)
                        </TableCell>
                        <TableCell className="text-center">{overallDebtStats.totalStudents}</TableCell>
                        <TableCell className="text-center text-emerald-700">{overallDebtStats.paidStudents}</TableCell>
                        <TableCell className="text-center text-red-600">{overallDebtStats.unpaidStudents}</TableCell>
                        <TableCell className="text-right font-mono">
                          {overallDebtStats.totalReceivable.toLocaleString("vi-VN")}đ
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-700">
                          {overallDebtStats.totalCollected.toLocaleString("vi-VN")}đ
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600 text-sm">
                          {overallDebtStats.remainingDebt.toLocaleString("vi-VN")}đ
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                            {overallDebtStats.percentCollected}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {overallDebtStats.remainingDebt === 0 && overallDebtStats.totalStudents > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Hoàn tất 100%</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">Còn {overallDebtStats.unpaidStudents} HS nợ</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center" />
                      </TableRow>
                    )}

                    {classDebtStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-slate-400 py-8">
                          {loading ? "Đang tải dữ liệu công nợ..." : "Không có dữ liệu công nợ tháng này hoặc chưa bấm 'Xem công nợ'"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* CHẾ ĐỘ 2: CHI TIẾT HỌC SINH NỢ */}
          {debtViewMode === "student_detail" && (
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="pb-3 border-b bg-slate-50/60 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Danh sách học sinh chưa thanh toán - Tháng {reportMonth}/{reportYear}
                </CardTitle>
                {debtSelectedClass !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDebtSelectedClass("all")}
                    className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
                  >
                    Xem tất cả lớp ({debtReport.length} HS nợ)
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                {debtReport.length > 0 && (
                  <div className="mb-4 p-3.5 bg-red-50/80 border border-red-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <p className="text-red-800 font-medium text-xs sm:text-sm">
                      {debtSelectedClass !== "all" ? (
                        <>Lớp <strong>{debtSelectedClass}</strong>: Có </>
                      ) : (
                        <>Toàn trường: </>
                      )}
                      <strong className="text-base font-black text-red-900">{filteredDebts.length}</strong> / {debtReport.length} học sinh chưa hoàn tất công nợ
                      {debtSearchTerm && <span className="italic text-xs text-red-600"> (theo từ khóa "{debtSearchTerm}")</span>}
                    </p>
                    <p className="text-red-700 font-bold text-sm sm:text-base">
                      Tổng nợ:{" "}
                      <span className="text-lg font-black text-red-800 font-mono">
                        {new Intl.NumberFormat("vi-VN").format(totalFilteredRemainingDebt)} đ
                      </span>
                    </p>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[11px]">
                      <TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Mã BT / HS</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="text-center">Lớp</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">Đã nộp</TableHead>
                      <TableHead className="text-right font-bold text-red-600">Còn nợ</TableHead>
                      <TableHead className="text-center">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDebts.map((bill, idx) => {
                      const billTotal = Number(bill.finalAmount);
                      const paidAmount = (bill.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
                      const remaining = Math.max(0, billTotal - paidAmount);
                      const isPartial = bill.paymentStatus === "PARTIAL";

                      return (
                        <TableRow key={bill.id || bill.studentId || idx} className="hover:bg-slate-50 text-xs">
                          <TableCell className="text-center font-medium text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {bill.student.boardingCode ? (
                              <span className="font-bold text-blue-700">{bill.student.boardingCode}</span>
                            ) : (
                              bill.student.studentCode
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 uppercase">{bill.student.user?.fullName}</TableCell>
                          <TableCell className="text-center font-bold text-blue-700">{bill.student.class?.name || "—"}</TableCell>
                          <TableCell className="text-right text-slate-600 font-mono">
                            {new Intl.NumberFormat("vi-VN").format(billTotal)}đ
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium font-mono">
                            {paidAmount > 0 ? `-${new Intl.NumberFormat("vi-VN").format(paidAmount)}đ` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-red-600 font-mono text-sm">
                            {new Intl.NumberFormat("vi-VN").format(remaining)}đ
                          </TableCell>
                          <TableCell className="text-center">
                            {isPartial ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">Đã nộp 1 phần</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px] font-semibold">Chưa TT</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredDebts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                          {debtReport.length === 0
                            ? "Không có học sinh nợ hoặc chưa tải dữ liệu"
                            : "Không tìm thấy học sinh nợ phù hợp với bộ lọc"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ BÁO CÁO NỢ QUÁ HẠN ============ */}
        <TabsContent value="overdue">
          <Card className="mb-4 border-red-200">
            <CardHeader className="bg-red-50 border-b border-red-100">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Cảnh báo Học sinh Nợ quá hạn (Từ 2 tháng trở lên)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 mb-4">
                <Button onClick={fetchOverdueReport} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Quét Nợ Xấu
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-center">Số tháng nợ</TableHead>
                    <TableHead>Chi tiết các tháng</TableHead>
                    <TableHead className="text-right">Tổng dư nợ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueReport.map((st, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold">{st.studentName}</TableCell>
                      <TableCell>{st.className}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-600 hover:bg-red-700">{st.unpaidCount} tháng</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {st.months.join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 text-lg">
                        {new Intl.NumberFormat("vi-VN").format(st.totalDebt)}đ
                      </TableCell>
                    </TableRow>
                  ))}
                  {overdueReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        Bấm "Quét Nợ Xấu" để kiểm tra. Hệ thống sẽ hiển thị các học sinh nợ từ 2 tháng trở lên.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
