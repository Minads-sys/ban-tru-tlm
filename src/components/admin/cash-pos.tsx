"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Swal from "sweetalert2";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search,
  CreditCard,
  Banknote,
  Printer,
  QrCode,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  Receipt,
  User,
  History,
  FileText,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  UserX,
  AlertTriangle,
  CheckCircle2,
  Scale,
  ArrowDownLeft,
  FileSpreadsheet,
  Download,
  Filter,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import ExcelJS from "exceljs";
import { formatCurrency, numberToVietnameseWords, maskStudentCode, getVietnamTodayString, formatDate } from "@/lib/utils";
import { generateMealPaymentQR, generateMealPaymentEMVCo } from "@/lib/vietqr";
import { CashReceiptPrint, CashReceiptData } from "./cash-receipt-print";
import { PaymentBillPrint, PaymentBillData } from "./payment-bill-print";

export interface SettlementRecordItem {
  id: string;
  settlementDate: string;
  totalPaid: number;
  actualUsedAmount: number;
  refundOrDebt: number;
  settlementType: "REFUND" | "ADDITIONAL_PAYMENT" | "BALANCED";
  note?: string | null;
  isRefunded?: boolean;
  refundedAt?: string | null;
  refundMethod?: string | null;
}

export interface StudentSearchResult {
  id: string;
  studentCode: string; // CCCD
  boardingCode: string | null;
  classId: string;
  class?: { name: string };
  user?: { fullName: string };
  boardingStatus?: "ACTIVE" | "CANCELLED" | "SUSPENDED";
  boardingCancelledAt?: string | null;
  parentPhone?: string | null;
  settlementRecords?: SettlementRecordItem[];
}

interface BillItem {
  id: string;
  month: number;
  year: number;
  finalAmount: number;
  totalAmount?: number;
  scheduleMealDays?: number;
  canceledDays?: number;
  scheduleReducedDays?: number;
  extraMealDays?: number;
  previousDeduction?: number;
  previousAddition?: number;
  unitPrice?: number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "SETTLED";
  transactions?: Array<{ id: string; amount: number; isVoided?: boolean }>;
  student?: any;
}

export function CashPos({ currentUser }: { currentUser: any }) {
  const canCollectCash = currentUser?.role === "CASHIER" || currentUser?.role === "ADMIN";
  // Tìm kiếm học sinh
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  // Danh sách hóa đơn của học sinh
  const [studentBills, setStudentBills] = useState<BillItem[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillItem | null>(null);

  // Form thu tiền mặt
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [customerPaid, setCustomerPaid] = useState<number>(0);
  const [note, setNote] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Modal in phiếu thu
  const [printReceiptData, setPrintReceiptData] = useState<CashReceiptData | null>(null);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // Modal in phiếu thanh toán có mã QR (A5 & K80)
  const [printBillData, setPrintBillData] = useState<PaymentBillData | null>(null);
  const [openPrintBillModal, setOpenPrintBillModal] = useState(false);

  // Cài đặt hệ thống (thông tin trường học, ngân hàng)
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Quyền Kế toán / Admin để thực hiện các thao tác quản trị đặc biệt như Hủy phiếu thu
  const isAccountantOrAdmin =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "ACCOUNTANT" ||
    (currentUser?.permissions || []).includes("MANAGE_FINANCE");

  // Bảng danh sách phiếu thu tiền mặt (hỗ trợ toàn thời gian, bộ lọc thời gian, tìm kiếm, phân trang)
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptDatePreset, setReceiptDatePreset] = useState<"today" | "yesterday" | "7days" | "this_month" | "all" | "custom">("today");
  const [receiptCustomStart, setReceiptCustomStart] = useState<string>("");
  const [receiptCustomEnd, setReceiptCustomEnd] = useState<string>("");
  const [receiptSearchTerm, setReceiptSearchTerm] = useState<string>("");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<"all" | "VALID" | "CLOSED" | "VOIDED">("all");
  const [receiptPage, setReceiptPage] = useState<number>(1);
  const [receiptLimit, setReceiptLimit] = useState<number>(20);
  const [receiptTotalRecords, setReceiptTotalRecords] = useState<number>(0);
  const [receiptTotalPages, setReceiptTotalPages] = useState<number>(1);
  const [receiptStats, setReceiptStats] = useState<{ totalValidCount: number; totalAmount: number }>({ totalValidCount: 0, totalAmount: 0 });
  const [exportingExcel, setExportingExcel] = useState(false);

  // Danh sách học sinh hủy bán trú chờ quyết toán nợ (Dành cho Thu ngân)
  const [pendingCollections, setPendingCollections] = useState<any[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tính toán tham số ngày dựa theo Preset thời gian
  const getDateQueryParams = useCallback(() => {
    const today = getVietnamTodayString();
    if (receiptDatePreset === "today") {
      return `date=${today}`;
    }
    if (receiptDatePreset === "yesterday") {
      const now = new Date();
      now.setDate(now.getDate() - 1);
      const yStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return `date=${yStr}`;
    }
    if (receiptDatePreset === "7days") {
      const now = new Date();
      now.setDate(now.getDate() - 6);
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return `startDate=${startStr}&endDate=${today}`;
    }
    if (receiptDatePreset === "this_month") {
      const now = new Date();
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return `startDate=${startStr}&endDate=${endStr}`;
    }
    if (receiptDatePreset === "custom") {
      let params = "";
      if (receiptCustomStart) params += `startDate=${receiptCustomStart}`;
      if (receiptCustomEnd) params += `${params ? "&" : ""}endDate=${receiptCustomEnd}`;
      return params;
    }
    // "all": Không giới hạn ngày
    return "";
  }, [receiptDatePreset, receiptCustomStart, receiptCustomEnd]);

  // Tải danh sách phiếu thu tiền mặt theo bộ lọc & phân trang
  const fetchReceiptsList = useCallback(
    async (pageToFetch = 1) => {
      setLoadingReceipts(true);
      try {
        const dateParams = getDateQueryParams();
        let url = `/api/billing/cash-payment?page=${pageToFetch}&limit=${receiptLimit}&status=${receiptStatusFilter}`;
        if (dateParams) url += `&${dateParams}`;
        if (receiptSearchTerm.trim()) url += `&search=${encodeURIComponent(receiptSearchTerm.trim())}`;

        const res = await fetch(url);
        const data = await res.json();
        if (data.data) {
          setReceiptsList(data.data);
          setReceiptTotalRecords(data.total || 0);
          setReceiptTotalPages(data.totalPages || 1);
          setReceiptPage(data.page || 1);
          setReceiptStats(data.stats || { totalValidCount: 0, totalAmount: 0 });
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách phiếu thu:", err);
      } finally {
        setLoadingReceipts(false);
      }
    },
    [getDateQueryParams, receiptLimit, receiptStatusFilter, receiptSearchTerm]
  );

  const fetchTodayReceipts = useCallback(() => {
    fetchReceiptsList(1);
  }, [fetchReceiptsList]);

  // Tải danh sách chờ quyết toán thu nợ
  const fetchPendingCollections = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await fetch("/api/settlements/pending");
      const data = await res.json();
      if (data.success) {
        setPendingCollections(data.pendingCollections || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  // Phím tắt bàn phím: F2 tìm kiếm, F9 thanh toán
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "F9" && selectedBill && collectAmount > 0 && !submittingPayment) {
        e.preventDefault();
        handleConfirmPayment();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Tự động tải lại phiếu thu khi thay đổi bộ lọc (debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReceiptsList(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchReceiptsList]);

  useEffect(() => {
    fetchPendingCollections();
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object") setSettings(data);
      })
      .catch((err) => console.error(err));
  }, [fetchPendingCollections]);

  // Tìm kiếm học sinh tự động (debounce)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(searchTerm.trim())}&limit=10`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else if (data.data) {
          setSearchResults(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Khi chọn một học sinh -> Tải tất cả hóa đơn của học sinh đó
  const handleSelectStudent = async (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSearchTerm("");
    setSearchResults([]);
    setLoadingBills(true);
    setSelectedBill(null);
    setCollectAmount(0);
    setCustomerPaid(0);

    // Gợi ý ghi chú nếu học sinh đã hủy ăn bán trú
    if (student.boardingStatus === "CANCELLED") {
      setNote("Thu quyết toán hủy bán trú");
    } else {
      setNote("");
    }

    try {
      const res = await fetch(`/api/billing?studentId=${student.id}&limit=50`);
      const json = await res.json();
      const rawBills = Array.isArray(json) ? json : json.data || [];

      // Cập nhật thông tin chi tiết nhất của học sinh từ hóa đơn (nếu có)
      if (rawBills.length > 0 && rawBills[0].student) {
        const bStudent = rawBills[0].student;
        setSelectedStudent((prev) => ({
          ...student,
          ...prev,
          boardingStatus: bStudent.boardingStatus || student.boardingStatus,
          boardingCancelledAt: bStudent.boardingCancelledAt || student.boardingCancelledAt,
          settlementRecords: bStudent.settlementRecords?.length
            ? bStudent.settlementRecords
            : student.settlementRecords || [],
        }));
      }

      // Sắp xếp: Ưu tiên tháng còn nợ lên trước, năm giảm dần, tháng giảm dần
      const formattedBills: BillItem[] = rawBills.map((b: any) => ({
        id: b.id,
        month: b.month,
        year: b.year,
        finalAmount: Number(b.finalAmount),
        totalAmount: Number(b.totalAmount || b.finalAmount),
        scheduleMealDays: b.scheduleMealDays || 0,
        canceledDays: b.canceledDays || 0,
        scheduleReducedDays: b.scheduleReducedDays || 0,
        extraMealDays: b.extraMealDays || 0,
        previousDeduction: Number(b.previousDeduction || 0),
        previousAddition: Number(b.previousAddition || 0),
        unitPrice: Number(b.unitPrice || 0),
        paymentStatus: b.paymentStatus,
        transactions: b.transactions || [],
        student: b.student,
      }));

      setStudentBills(formattedBills);

      // Tự động chọn hóa đơn nợ gần nhất
      const firstUnpaid = formattedBills.find(
        (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
      );
      if (firstUnpaid) {
        selectBillToPay(firstUnpaid);
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải danh sách hóa đơn của học sinh", "error");
    } finally {
      setLoadingBills(false);
    }
  };

  // Chọn hóa đơn để thu tiền
  const selectBillToPay = (bill: BillItem) => {
    setSelectedBill(bill);
    const paid = (bill.transactions || [])
      .filter((t) => !t.isVoided)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const remaining = Math.max(0, bill.finalAmount - paid);
    setCollectAmount(remaining);
    setCustomerPaid(remaining);
  };

  // Tính số tiền còn nợ của một hóa đơn
  const getBillRemainingDebt = (bill: BillItem) => {
    const paid = (bill.transactions || [])
      .filter((t) => !t.isVoided)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return Math.max(0, bill.finalAmount - paid);
  };

  // Mở popup In Phiếu Thanh Toán / Biên Nhận Thu Tiền
  const handleOpenPrintBill = async (bill: BillItem) => {
    if (!selectedStudent) return;
    const isPaid = bill.paymentStatus === "PAID";
    const debt = getBillRemainingDebt(bill);
    const code = selectedStudent.boardingCode || selectedStudent.studentCode;

    const paid = (bill.transactions || [])
      .filter((t) => !t.isVoided)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const actualPaid = isPaid ? Number(bill.finalAmount) : paid;
    const actualRemaining = isPaid ? 0 : Math.max(0, Number(bill.finalAmount) - actualPaid);

    let dataUrl = "";
    // Chỉ tạo mã QR khi còn nợ tiền
    if (!isPaid && actualRemaining > 0) {
      const bankBin = settings.BANK_BIN || "970418";
      const accountNo = settings.BANK_ACCOUNT_NO || "96247BANTRUTLM08";
      const accountName = settings.BANK_ACCOUNT_NAME || "HOANG KIM";
      const bankName = settings.BANK_NAME || "BIDV";

      const emvcoPayload = generateMealPaymentEMVCo(code, bill.month, bill.year, actualRemaining, {
        bankBin,
        accountNo,
        accountName,
        bankName,
      });

      try {
        dataUrl = await QRCode.toDataURL(emvcoPayload, {
          margin: 1,
          width: 360,
          errorCorrectionLevel: "M",
        });
      } catch (err) {
        console.error(err);
      }
    }

    const mm = String(bill.month).padStart(2, "0");
    const yy = String(bill.year).slice(-2);
    const content = `BSTLM ${code} T${mm}${yy}`;

    setPrintBillData({
      schoolName: settings.SCHOOL_NAME || "TRƯỜNG BÁN TRÚ TIỂU HỌC & THCS THĂNG LONG",
      schoolAddress: settings.SCHOOL_ADDRESS || "Hà Nội",
      schoolPhone: settings.SCHOOL_PHONE || "(024) 3888.xxxx",
      student: {
        fullName: selectedStudent.user?.fullName || "Học sinh",
        studentCode: selectedStudent.studentCode,
        boardingCode: selectedStudent.boardingCode,
        className: selectedStudent.class?.name || selectedStudent.classId,
        mealType: bill.student?.mealType,
      },
      bill: {
        id: bill.id,
        month: bill.month,
        year: bill.year,
        finalAmount: bill.finalAmount,
        paidAmount: actualPaid,
        remainingDebt: actualRemaining,
        paymentStatus: bill.paymentStatus,
        scheduleMealDays: bill.scheduleMealDays,
        canceledDays: bill.canceledDays,
        scheduleReducedDays: bill.scheduleReducedDays,
        extraMealDays: bill.extraMealDays,
        unitPrice: bill.unitPrice,
        previousDeduction: bill.previousDeduction,
        previousAddition: bill.previousAddition,
      },
      bankInfo: {
        bankName: settings.BANK_NAME || "BIDV",
        accountNo: settings.BANK_ACCOUNT_NO || "96247BANTRUTLM08",
        accountName: settings.BANK_ACCOUNT_NAME || "HOANG KIM",
      },
      qrCodeDataUrl: dataUrl,
      transferContent: content,
    });

    setOpenPrintBillModal(true);
  };

  // Xác nhận thu tiền mặt
  const handleConfirmPayment = async () => {
    if (!selectedStudent || !selectedBill) {
      Swal.fire("Thông báo", "Vui lòng chọn học sinh và hóa đơn cần thanh toán", "warning");
      return;
    }

    if (collectAmount <= 0) {
      Swal.fire("Thông báo", "Số tiền thu phải lớn hơn 0", "warning");
      return;
    }

    if (customerPaid < collectAmount) {
      const confirmUnder = await Swal.fire({
        title: "Cảnh báo thiếu tiền",
        text: `Tiền khách đưa (${formatCurrency(customerPaid)}) nhỏ hơn số tiền muốn thu (${formatCurrency(collectAmount)}). Bạn có muốn tiếp tục không?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Vẫn tiếp tục",
        cancelButtonText: "Hủy",
      });
      if (!confirmUnder.isConfirmed) return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/billing/cash-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          billId: selectedBill.id,
          amount: collectAmount,
          customerPaid,
          note,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Mở popup in phiếu thu ngay lập tức
        setPrintReceiptData({
          ...data.receipt,
          schoolName: data.receipt?.schoolName || settings.SCHOOL_NAME || "",
          schoolAddress: data.receipt?.schoolAddress || settings.SCHOOL_ADDRESS || "",
          schoolPhone: data.receipt?.schoolPhone || settings.SCHOOL_PHONE || "",
        });
        setOpenPrintModal(true);

        // Tải lại dữ liệu hóa đơn của học sinh, danh sách phiếu thu hôm nay và danh sách chờ quyết toán
        handleSelectStudent(selectedStudent);
        fetchTodayReceipts();
        fetchPendingCollections();
        setNote("");

        Swal.fire({
          icon: "success",
          title: "Thu tiền thành công!",
          text: `Đã thu ${formatCurrency(collectAmount)} từ học sinh ${selectedStudent.user?.fullName}`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xử lý thu tiền mặt", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // In lại phiếu thu từ bảng lịch sử
  const handleReprintReceipt = (receiptItem: any) => {
    setPrintReceiptData({
      receiptNumber: receiptItem.receiptNumber,
      transDate: receiptItem.transDate,
      amount: receiptItem.amount,
      note: receiptItem.note,
      cashierName: receiptItem.cashierName,
      schoolName: receiptItem.schoolName || settings.SCHOOL_NAME || "",
      schoolAddress: receiptItem.schoolAddress || settings.SCHOOL_ADDRESS || "",
      schoolPhone: receiptItem.schoolPhone || settings.SCHOOL_PHONE || "",
      student: {
        fullName: receiptItem.student?.fullName || "",
        studentCode: receiptItem.student?.studentCode || "", // Đã che CCCD 4 số cuối
        boardingCode: receiptItem.student?.boardingCode || "",
        className: receiptItem.student?.className || "",
      },
      bill: receiptItem.bill,
    });
    setOpenPrintModal(true);
  };

  // Xuất file Excel bảng kê danh sách phiếu thu tiền mặt
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const dateParams = getDateQueryParams();
      let exportApiUrl = `/api/billing/cash-payment?all=true&status=${receiptStatusFilter}`;
      if (dateParams) exportApiUrl += `&${dateParams}`;
      if (receiptSearchTerm.trim()) exportApiUrl += `&search=${encodeURIComponent(receiptSearchTerm.trim())}`;

      const res = await fetch(exportApiUrl);
      const data = await res.json();
      const exportList: any[] = data.data || [];

      if (exportList.length === 0) {
        Swal.fire("Thông báo", "Không có dữ liệu phiếu thu nào để xuất file!", "info");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Phiếu Thu Tiền Mặt");

      // Tiêu đề
      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "BẢNG KÊ DANH SÁCH PHIẾU THU TIỀN MẶT";
      titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 30;

      // Phụ đề thời gian & ngày xuất
      worksheet.mergeCells("A2:K2");
      const subtitleCell = worksheet.getCell("A2");
      let timeLabel = "Tất cả thời gian";
      if (receiptDatePreset === "today") timeLabel = `Hôm nay (${getVietnamTodayString()})`;
      else if (receiptDatePreset === "yesterday") timeLabel = "Hôm qua";
      else if (receiptDatePreset === "7days") timeLabel = "7 ngày gần nhất";
      else if (receiptDatePreset === "this_month") timeLabel = `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
      else if (receiptDatePreset === "custom") timeLabel = `Từ ${receiptCustomStart || "..."} đến ${receiptCustomEnd || "..."}`;

      subtitleCell.value = `Bộ lọc: ${timeLabel} • Ngày xuất: ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN")}`;
      subtitleCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).height = 20;

      // Header bảng
      const headers = [
        "STT",
        "Mã phiếu thu",
        "Thời gian thu",
        "Họ và tên học sinh",
        "Lớp",
        "Mã Bán Trú",
        "Mã HS (CCCD)",
        "Số tiền thu (VNĐ)",
        "Thu ngân lập",
        "Trạng thái",
        "Ghi chú",
      ];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      });

      // Rows dữ liệu
      let sumAmount = 0;
      exportList.forEach((rc, index) => {
        const amount = Number(rc.amount) || 0;
        if (!rc.isVoided) sumAmount += amount;

        let statusText = "Hợp lệ";
        if (rc.isVoided) statusText = "Đã bị hủy";
        else if (rc.closingSessionCode) statusText = `Đã chốt (${rc.closingSessionCode})`;

        const row = worksheet.addRow([
          index + 1,
          rc.receiptNumber,
          formatDate(rc.transDate),
          rc.student?.fullName || "—",
          rc.student?.className || "—",
          rc.student?.boardingCode || "—",
          rc.student?.studentCode || "—",
          amount,
          rc.cashierName || "Thu ngân",
          statusText,
          rc.note || (rc.isVoided ? `Lý do hủy: ${rc.voidReason || ""}` : ""),
        ]);

        row.height = 22;
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).font = { bold: true, color: { argb: "FF1D4ED8" } };
        row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
        row.getCell(8).numFmt = '#,##0" đ"';
        row.getCell(8).font = { bold: true, color: rc.isVoided ? { argb: "FF94A3B8" } : { argb: "FFE11D48" } };
        row.getCell(9).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };

        if (rc.isVoided) {
          row.eachCell((c) => {
            c.font = { ...c.font, strike: true, color: { argb: "FF94A3B8" } };
          });
        }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      // Dòng TỔNG CỘNG
      const totalRow = worksheet.addRow([
        "TỔNG CỘNG",
        "",
        "",
        `${exportList.length} phiếu (${exportList.filter((r) => !r.isVoided).length} hợp lệ)`,
        "",
        "",
        "",
        sumAmount,
        "",
        "",
        "",
      ]);
      totalRow.height = 25;
      totalRow.font = { name: "Arial", size: 10, bold: true };
      totalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      totalRow.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
      totalRow.getCell(8).numFmt = '#,##0" đ"';
      totalRow.getCell(8).font = { bold: true, color: { argb: "FFE11D48" } };

      worksheet.columns = [
        { width: 6 },
        { width: 22 },
        { width: 14 },
        { width: 26 },
        { width: 10 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 16 },
        { width: 28 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Bang_Ke_Phieu_Thu_Tien_Mat_${getVietnamTodayString().replace(/-/g, "")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      Swal.fire("Thành công", "Đã xuất file Excel bảng kê phiếu thu thành công!", "success");
    } catch (err: any) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể xuất file Excel: " + (err.message || ""), "error");
    } finally {
      setExportingExcel(false);
    }
  };

  // Kế toán / Admin thực hiện hủy phiếu thu tiền mặt
  const handleVoidReceipt = async (rc: any) => {
    if (!isAccountantOrAdmin) {
      Swal.fire("Thông báo", "Bạn không có quyền hủy phiếu thu. Chỉ Kế toán hoặc Quản trị viên mới được phép hủy!", "warning");
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: `HỦY PHIẾU THU ${rc.receiptNumber}`,
      html: `
        <div class="text-left text-xs space-y-2 text-slate-700">
          <div class="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">
            <b>CẢNH BÁO QUAN TRỌNG:</b> Thao tác này sẽ trừ số tiền <b>${formatCurrency(rc.amount)}</b> khỏi doanh thu và đưa công nợ của học sinh <b>${rc.student?.fullName || "học sinh"}</b> quay lại trạng thái chưa thanh toán.
          </div>
          <div class="pt-1">
            <label class="font-bold block mb-1">Xác nhận đã thu hồi phiếu in giấy gốc: <span class="text-rose-600">*</span></label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="swal-recovered-check-pos" class="rounded text-rose-600" />
              <span>Đã thu hồi lại phiếu thu giấy từ phụ huynh / học sinh</span>
            </label>
          </div>
          <div class="pt-2">
            <label class="font-bold block mb-1">Lý do hủy chi tiết (bắt buộc lưu vết): <span class="text-rose-600">*</span></label>
            <textarea id="swal-void-reason-pos" class="swal2-textarea w-full text-xs p-2 m-0 border rounded" placeholder="VD: Nhập nhầm số tiền, học sinh xin chuyển sang tháng sau..."></textarea>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận Hủy Phiếu",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Đóng",
      focusConfirm: false,
      preConfirm: () => {
        const recovered = (document.getElementById("swal-recovered-check-pos") as HTMLInputElement)?.checked;
        const reason = (document.getElementById("swal-void-reason-pos") as HTMLTextAreaElement)?.value;
        if (!recovered) {
          Swal.showValidationMessage("Bạn phải xác nhận đã thu hồi phiếu giấy gốc!");
          return false;
        }
        if (!reason || reason.trim().length < 5) {
          Swal.showValidationMessage("Vui lòng nhập lý do hủy chi tiết (tối thiểu 5 ký tự)!");
          return false;
        }
        return { reason: reason.trim() };
      },
    });

    if (!formValues) return;

    try {
      const res = await fetch("/api/billing/cash-payment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: rc.id,
          voidReason: formValues.reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire("Đã hủy phiếu thu thành công", data.message, "success");
        fetchReceiptsList(receiptPage);
        if (selectedStudent) {
          handleSelectStudent(selectedStudent);
        }
      } else {
        Swal.fire("Lỗi", data.error || "Không thể hủy phiếu thu", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối", "error");
    }
  };

  const changeAmount = Math.max(0, customerPaid - collectAmount);

  return (
    <div className="space-y-6">
      {/* KHUNG TÌM KIẾM HỌC SINH TẠI QUẦY */}
      <Card className="border-blue-200 shadow-sm bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Gõ Họ tên, Lớp, Mã Bán Trú, hoặc 4 số cuối CCCD (Phím tắt: F2)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-16 py-6 text-base rounded-xl border-blue-300 focus:border-blue-500 bg-white shadow-xs font-medium"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSearchResults([]);
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Xóa tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {isSearching && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2 whitespace-nowrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchPendingCollections();
                  setShowPendingModal(true);
                }}
                className="h-8 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 font-semibold text-xs shadow-2xs flex items-center gap-1.5"
                title="Xem danh sách học sinh đã hủy ăn nhưng còn nợ tiền chờ quyết toán"
              >
                <FileText className="h-3.5 w-3.5 text-rose-600" />
                <span>DS Chờ Quyết Toán</span>
                {pendingCollections.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-bold">
                    {pendingCollections.length}
                  </span>
                )}
              </Button>
              <kbd className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-mono font-bold">F2</kbd> Tìm kiếm
              <kbd className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-mono font-bold ml-2">F9</kbd> Thu tiền
            </div>
          </div>

          {/* KẾT QUẢ GỢI Ý TÌM KIẾM DROPDOWN */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {searchResults.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleSelectStudent(st)}
                  className="p-3.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {st.user?.fullName?.charAt(0) || "H"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-slate-900 text-sm sm:text-base">
                          {st.user?.fullName}
                        </div>
                        {st.boardingStatus === "CANCELLED" && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold px-1.5 py-0.2">
                            ĐÃ HỦY BÁN TRÚ
                          </Badge>
                        )}
                        {st.boardingStatus === "SUSPENDED" && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-1.5 py-0.2">
                            TẠM DỪNG
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Lớp: <b>{st.class?.name || st.classId}</b></span>
                        <span>•</span>
                        <span>Mã BT: <b className="text-blue-700">{st.boardingCode || "—"}</b></span>
                        <span>•</span>
                        <span>CCCD: <b className="font-mono">{maskStudentCode(st.studentCode)}</b></span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-blue-600 text-xs font-semibold">
                    Chọn <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* TRƯỜNG HỢP KHÔNG TÌM THẤY KẾT QUẢ */}
          {searchResults.length === 0 && !isSearching && searchTerm.trim().length > 0 && (
            <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Không tìm thấy học sinh nào phù hợp với &quot;{searchTerm}&quot;</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                💡 <b>Gợi ý tìm nhanh:</b> Gõ <b>Tên</b> (VD: Bảo, Đạt), <b>Lớp</b> (VD: 10A1), <b>Mã Bán Trú</b> (VD: BT00001, BT00002) hoặc <b>4 số cuối CCCD</b> (VD: 0961).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NỘI DUNG CHÍNH KHI ĐÃ CHỌN HỌC SINH */}
      {selectedStudent && (
        <div className={`grid grid-cols-1 ${canCollectCash ? "lg:grid-cols-12" : "lg:grid-cols-1"} gap-6`}>
          {/* CỘT TRÁI (7 CỘT): THÔNG TIN HỌC SINH & DANH SÁCH HÓA ĐƠN */}
          <div className={`${canCollectCash ? "lg:col-span-7" : ""} space-y-6`}>
            {/* THẺ THÔNG TIN HỌC SINH (ÁP DỤNG BẢO MẬT CHE CCCD) */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b bg-slate-50/80">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <User className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Hồ Sơ Học Sinh
                    </CardTitle>
                  </div>
                  {selectedStudent.boardingStatus === "CANCELLED" ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 font-bold flex items-center gap-1.5 shadow-2xs">
                      <UserX className="h-3.5 w-3.5 text-rose-600" />
                      ĐÃ HỦY BÁN TRÚ (CHỜ QUYẾT TOÁN)
                    </Badge>
                  ) : selectedStudent.boardingStatus === "SUSPENDED" ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold flex items-center gap-1.5 shadow-2xs">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      TẠM DỪNG BÁN TRÚ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Đang ăn bán trú
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Họ tên học sinh:</span>
                    <span className="text-sm font-bold text-slate-900 uppercase">
                      {selectedStudent.user?.fullName}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Lớp:</span>
                    <span className="text-sm font-bold text-blue-700">
                      {selectedStudent.class?.name || selectedStudent.classId}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Mã Bán Trú:</span>
                    <span className="text-sm font-bold text-slate-900">
                      {selectedStudent.boardingCode || "Chưa cấp"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200">
                    <span className="text-amber-800 block text-[11px] font-medium">Mã HS (CCCD - Đã che):</span>
                    <span className="text-sm font-mono font-bold text-amber-900 tracking-wider">
                      {maskStudentCode(selectedStudent.studentCode)}
                    </span>
                  </div>
                </div>

                {selectedStudent.boardingCancelledAt && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-rose-600" />
                      Ngày bắt đầu ngừng ăn bán trú:
                    </span>
                    <span className="font-bold">
                      {formatDate(selectedStudent.boardingCancelledAt)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CẢNH BÁO QUYẾT TOÁN KHI HỌC SINH ĐÃ HỦY BÁN TRÚ */}
            {selectedStudent.boardingStatus === "CANCELLED" && (
              <Card className="border-rose-200 bg-rose-50/70 shadow-xs">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-rose-900 text-sm">
                          HỒ SƠ HỦY BÁN TRÚ & CHỜ QUYẾT TOÁN CÔNG NỢ
                        </span>
                        {selectedStudent.settlementRecords?.[0]?.settlementType === "REFUND" ? (
                          <Badge className="bg-amber-600 text-white font-bold text-xs">
                            CHỜ KẾ TOÁN HOÀN TIỀN THỪA
                          </Badge>
                        ) : selectedStudent.settlementRecords?.[0]?.settlementType === "ADDITIONAL_PAYMENT" ? (
                          <Badge className="bg-rose-600 text-white font-bold text-xs">
                            CẦN THU BỔ SUNG TIỀN ĂN THỰC TẾ
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-600 text-white font-bold text-xs">
                            ĐÃ CÂN BẰNG CÔNG NỢ
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="bg-white/90 p-2.5 rounded-lg border border-rose-100">
                          <span className="text-slate-500 block text-[11px]">Hình thức quyết toán:</span>
                          <span className="font-bold text-slate-900">
                            {selectedStudent.settlementRecords?.[0]?.settlementType === "REFUND"
                              ? "Hoàn trả tiền ăn thừa"
                              : selectedStudent.settlementRecords?.[0]?.settlementType === "ADDITIONAL_PAYMENT"
                              ? "Thu thêm tiền ăn thực tế"
                              : "Cân bằng công nợ (0đ)"}
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded-lg border border-rose-100">
                          <span className="text-slate-500 block text-[11px]">
                            {selectedStudent.settlementRecords?.[0]?.settlementType === "REFUND"
                              ? "Số tiền nhà trường cần hoàn:"
                              : "Số tiền cần thanh toán dứt điểm:"}
                          </span>
                          <span className="font-black text-rose-700 text-sm">
                            {formatCurrency(
                              selectedStudent.settlementRecords?.[0]?.refundOrDebt ||
                                studentBills.reduce((sum, b) => sum + getBillRemainingDebt(b), 0)
                            )}
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded-lg border border-rose-100">
                          <span className="text-slate-500 block text-[11px]">Ngày ngừng ăn bán trú:</span>
                          <span className="font-bold text-slate-800">
                            {selectedStudent.boardingCancelledAt
                              ? formatDate(selectedStudent.boardingCancelledAt)
                              : "Đã hủy"}
                          </span>
                        </div>
                      </div>

                      {selectedStudent.settlementRecords?.[0]?.note && (
                        <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded border border-rose-100 italic">
                          <b>Ghi chú quyết toán:</b> {selectedStudent.settlementRecords[0].note}
                        </div>
                      )}

                      {/* CẢNH BÁO PHÂN QUYỀN NẾU THUỘC DIỆN HOÀN TIỀN */}
                      {selectedStudent.settlementRecords?.[0]?.settlementType === "REFUND" && (
                        <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-700 block">
                              ⛔ THU NGÂN TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP CHI TIỀN TẠI QUẦY!
                            </span>
                            <span className="text-slate-700 text-[11px]">
                              Nghiệp vụ chi hoàn tiền do <b>Kế toán</b> phụ trách. Vui lòng hướng dẫn phụ huynh liên hệ Phòng Kế toán để làm thủ tục nhận tiền hoàn qua chuyển khoản hoặc tiền mặt.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DANH SÁCH CÁC THÁNG HÓA ĐƠN & NỢ CŨ */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    Danh Sách Hóa Đơn Tiền Ăn
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Bấm chọn hóa đơn để thu tiền mặt hoặc mở mã VietQR
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingBills ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải danh sách hóa đơn...
                  </div>
                ) : studentBills.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Chưa có hóa đơn nào được tạo cho học sinh này.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <tr className="bg-slate-50 text-[11px]">
                          <TableHead className="w-10 text-center">Chọn</TableHead>
                          <TableHead>Tháng</TableHead>
                          <TableHead className="text-right">Tổng tiền</TableHead>
                          <TableHead className="text-right">Còn nợ</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {studentBills.map((b) => {
                          const remainingDebt = getBillRemainingDebt(b);
                          const isSelected = selectedBill?.id === b.id;
                          const isPaid = b.paymentStatus === "PAID";

                          return (
                            <TableRow
                              key={b.id}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? "bg-blue-50/80 font-medium" : isPaid ? "opacity-75" : "hover:bg-slate-50"
                              }`}
                              onClick={() => !isPaid && selectBillToPay(b)}
                            >
                              <TableCell className="text-center">
                                <input
                                  type="radio"
                                  name="selected_bill"
                                  checked={isSelected}
                                  disabled={isPaid}
                                  onChange={() => selectBillToPay(b)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>Tháng {String(b.month).padStart(2, "0")}/{b.year}</span>
                                  {selectedStudent.boardingStatus === "CANCELLED" && b.paymentStatus !== "PAID" && (
                                    <Badge variant="outline" className="text-[10px] text-rose-700 border-rose-300 bg-rose-50 font-bold px-1.5 py-0">
                                      Quyết toán ngừng ăn ({b.scheduleMealDays} bữa)
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(b.finalAmount)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs">
                                {remainingDebt > 0 ? (
                                  <span className="text-rose-600">{formatCurrency(remainingDebt)}</span>
                                ) : (
                                  <span className="text-emerald-600">0 đ</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {b.paymentStatus === "PAID" ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Đã nộp đủ</Badge>
                                ) : b.paymentStatus === "PARTIAL" ? (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">Nộp 1 phần</Badge>
                                ) : b.paymentStatus === "SETTLED" ? (
                                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">Đã quyết toán</Badge>
                                ) : (
                                  <Badge className="bg-rose-100 text-rose-800 text-[10px]">Còn nợ</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPrintBill(b);
                                  }}
                                  className="h-7 px-2.5 text-[11px] font-semibold text-blue-700 border-blue-300 hover:bg-blue-50 hover:text-blue-800 shadow-2xs"
                                  title={b.paymentStatus === "PAID" ? "In biên nhận thu tiền ăn (K80 hoặc A5)" : "In phiếu thanh toán kèm mã QR (Khổ K80 hoặc A5)"}
                                >
                                  <Printer className="h-3.5 w-3.5 mr-1 text-blue-600" />
                                  {b.paymentStatus === "PAID" ? "In biên nhận" : "In phiếu"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CỘT PHẢI (5 CỘT): FORM THU TIỀN MẶT POS */}
          {canCollectCash && (
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-blue-300 shadow-md bg-white">
              <CardHeader className="bg-blue-600 text-white rounded-t-xl pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    <CardTitle className="text-base font-bold">
                      {selectedStudent.boardingStatus === "CANCELLED" ? "Thu Tiền Quyết Toán" : "Thao Tác Thu Tiền Mặt"}
                    </CardTitle>
                  </div>
                  {selectedBill && (
                    <Badge className="bg-blue-500 text-white border-blue-400 text-xs">
                      T{String(selectedBill.month).padStart(2, "0")}/{selectedBill.year}
                      {selectedStudent.boardingStatus === "CANCELLED" ? " (Q.Toán)" : ""}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {selectedStudent.boardingStatus === "CANCELLED" &&
                selectedStudent.settlementRecords?.[0]?.settlementType === "REFUND" &&
                !selectedStudent.settlementRecords[0]?.isRefunded ? (
                  /* NẾU HỌC SINH THUỘC DIỆN HOÀN TIỀN THỪA -> KHÓA THU VÀ CẢNH BÁO */
                  <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">
                        HỒ SƠ CHỜ KẾ TOÁN HOÀN TIỀN THỪA
                      </h3>
                      <p className="text-xs text-amber-800 mt-1">
                        Số tiền nhà trường cần hoàn trả lại cho phụ huynh:
                      </p>
                      <p className="text-xl font-black text-amber-900 mt-0.5">
                        {formatCurrency(selectedStudent.settlementRecords?.[0]?.refundOrDebt || 0)}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-amber-200 text-left text-xs space-y-1.5 text-slate-700">
                      <p className="font-bold text-rose-700 flex items-center gap-1.5">
                        <UserX className="h-4 w-4 shrink-0" />
                        Thu ngân tuyệt đối không được phép chi tiền tại quầy!
                      </p>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Theo quy định phân quyền, việc chi trả tiền hoàn do <b>Kế toán</b> phụ trách thực hiện (chuyển khoản hoặc xuất quỹ tiền mặt phòng kế toán). Vui lòng hướng dẫn phụ huynh liên hệ Phòng Kế toán để nhận tiền.
                      </p>
                    </div>

                    <Button disabled className="w-full bg-slate-200 text-slate-500 font-bold py-4 text-xs cursor-not-allowed">
                      Khóa chức năng thu tiền (Học sinh được hoàn tiền)
                    </Button>
                  </div>
                ) : selectedBill ? (
                  <>
                    {/* Số tiền cần thu */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between text-slate-500 text-xs mb-1">
                        <span>Số tiền nợ của tháng:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(getBillRemainingDebt(selectedBill))}
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <Label htmlFor="collectAmount" className="font-bold text-slate-800 text-xs">
                          Số tiền thu thực tế (đ) <span className="text-rose-600">*</span>
                        </Label>
                        <Input
                          id="collectAmount"
                          type="number"
                          step="1000"
                          value={collectAmount || ""}
                          onChange={(e) => setCollectAmount(Number(e.target.value))}
                          className="text-lg font-black text-blue-700 text-right bg-white py-5"
                        />
                        <div className="text-[11px] text-slate-500 text-right italic">
                          ({numberToVietnameseWords(collectAmount)})
                        </div>
                      </div>

                      {/* Các nút chọn nhanh số tiền */}
                      <div className="flex gap-2 mt-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const debt = getBillRemainingDebt(selectedBill);
                            setCollectAmount(debt);
                            setCustomerPaid(debt);
                          }}
                          className="flex-1 text-[11px] h-7 bg-white"
                        >
                          Thu đủ nợ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const half = Math.round(getBillRemainingDebt(selectedBill) / 2);
                            setCollectAmount(half);
                            setCustomerPaid(half);
                          }}
                          className="flex-1 text-[11px] h-7 bg-white"
                        >
                          Thu 50%
                        </Button>
                      </div>
                    </div>

                    {/* Tiền khách đưa & Tiền thối lại */}
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                      <div>
                        <Label htmlFor="customerPaid" className="font-semibold text-amber-900 text-xs">
                          Tiền khách đưa (đ):
                        </Label>
                        <Input
                          id="customerPaid"
                          type="number"
                          step="1000"
                          value={customerPaid || ""}
                          onChange={(e) => setCustomerPaid(Number(e.target.value))}
                          className="text-base font-bold text-amber-900 text-right bg-white mt-1 py-4"
                        />
                      </div>

                      {/* Nút bấm nhanh mệnh giá tiền khách đưa */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[200000, 500000, 1000000, 2000000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomerPaid(val)}
                            className="px-2 py-1 text-[10px] font-semibold bg-white border border-amber-300 rounded hover:bg-amber-100 text-amber-900 transition-colors"
                          >
                            {val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-between items-baseline pt-2 border-t border-amber-200">
                        <span className="font-semibold text-slate-700">Tiền thừa trả lại:</span>
                        <span className="text-base font-black text-emerald-700">
                          {formatCurrency(changeAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <Label htmlFor="note" className="text-slate-600 text-xs">Ghi chú (nếu có):</Label>
                      <Input
                        id="note"
                        placeholder="VD: Phụ huynh nộp trước một phần..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="text-xs mt-1"
                      />
                    </div>

                    {/* NÚT BẤM XÁC NHẬN THU TIỀN F9 */}
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={submittingPayment || collectAmount <= 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Printer className="h-5 w-5" />
                      )}
                      <span>[F9] XÁC NHẬN THU & IN PHIẾU</span>
                    </Button>
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Receipt className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="text-xs">Vui lòng chọn 1 hóa đơn còn nợ ở bảng bên trái để thực hiện thu tiền.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      )}

      {/* SỔ NHẬT KÝ & BẢNG KÊ DANH SÁCH PHIẾU THU TIỀN MẶT (TOÀN THỜI GIAN) */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b bg-slate-50/70">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                Sổ Nhật Ký & Danh Sách Phiếu Thu Tiền Mặt
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Tra cứu, tìm kiếm mọi phiếu thu trong hệ thống, xem theo khoảng thời gian, in lại và xuất file Excel
              </CardDescription>
            </div>

            {/* Thống kê nhanh và Nút Xuất Excel */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs flex items-center gap-2">
                <span className="text-slate-500">Số phiếu hợp lệ:</span>
                <span className="font-bold text-slate-800">{receiptStats.totalValidCount}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Tổng thực thu:</span>
                <span className="font-black text-rose-600 text-sm">{formatCurrency(receiptStats.totalAmount)}</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exportingExcel || receiptTotalRecords === 0}
                className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 font-semibold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Xuất dữ liệu danh sách phiếu thu ra file Excel (.xlsx)"
              >
                {exportingExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                )}
                <span>Xuất Excel</span>
              </Button>
            </div>
          </div>

          {/* THANH CÔNG CỤ BỘ LỌC THỜI GIAN, TÌM KIẾM & TRẠNG THÁI */}
          <div className="pt-3 border-t border-slate-200/80 mt-3 space-y-2.5">
            {/* Hàng 1: Nút lọc nhanh thời gian (Presets) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Thời gian:
              </span>
              {[
                { id: "today", label: "Hôm nay" },
                { id: "yesterday", label: "Hôm qua" },
                { id: "7days", label: "7 ngày qua" },
                { id: "this_month", label: "Tháng này" },
                { id: "all", label: "Tất cả thời gian" },
                { id: "custom", label: "Tùy chọn ngày" },
              ].map((p) => {
                const isActive = receiptDatePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setReceiptDatePreset(p.id as any);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}

              {/* Ô chọn ngày tùy chọn khi chọn preset custom */}
              {receiptDatePreset === "custom" && (
                <div className="flex items-center gap-1.5 ml-1 bg-white p-1 rounded-lg border border-slate-200">
                  <Input
                    type="date"
                    value={receiptCustomStart}
                    onChange={(e) => setReceiptCustomStart(e.target.value)}
                    className="h-7 text-xs w-32 border-slate-200"
                    placeholder="Từ ngày"
                  />
                  <span className="text-xs text-slate-400">→</span>
                  <Input
                    type="date"
                    value={receiptCustomEnd}
                    onChange={(e) => setReceiptCustomEnd(e.target.value)}
                    className="h-7 text-xs w-32 border-slate-200"
                    placeholder="Đến ngày"
                  />
                </div>
              )}
            </div>

            {/* Hàng 2: Ô tìm kiếm & Lọc trạng thái */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo mã phiếu (PT-...), họ tên học sinh, lớp, mã bán trú..."
                  value={receiptSearchTerm}
                  onChange={(e) => setReceiptSearchTerm(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 rounded-lg w-full"
                />
                {receiptSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setReceiptSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Xóa tìm kiếm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={receiptStatusFilter}
                  onChange={(e) => setReceiptStatusFilter(e.target.value as any)}
                  className="w-full h-8 text-xs bg-white border border-slate-200 rounded-lg px-2 text-slate-700 font-medium focus:border-blue-400 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="VALID">Hợp lệ (chưa chốt ca)</option>
                  <option value="CLOSED">Đã chốt ca bàn giao</option>
                  <option value="VOIDED">Đã bị hủy</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingReceipts ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
              Đang tải danh sách phiếu thu...
            </div>
          ) : receiptsList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1">
              <Receipt className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Không tìm thấy phiếu thu tiền mặt nào phù hợp.</p>
              <p className="text-slate-400">Hãy thử đổi khoảng thời gian hoặc điều chỉnh từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr className="bg-slate-50 text-[11px]">
                    <TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead>Mã phiếu thu</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Mã Bán Trú</TableHead>
                    <TableHead>Mã HS (CCCD)</TableHead>
                    <TableHead className="text-right">Số tiền thu</TableHead>
                    <TableHead>Thu ngân</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {receiptsList.map((rc, idx) => (
                    <TableRow key={rc.id} className={rc.isVoided ? "bg-rose-50/40 opacity-70 line-through" : "hover:bg-slate-50/80"}>
                      <TableCell className="text-center text-xs text-slate-500">
                        {(receiptPage - 1) * receiptLimit + idx + 1}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs text-blue-700">
                        {rc.receiptNumber}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600 whitespace-nowrap">
                        {formatDate(rc.transDate)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs uppercase">
                        {rc.student?.fullName || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-blue-800">
                        {rc.student?.className || "—"}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-slate-700">
                        {rc.student?.boardingCode || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {rc.student?.studentCode || "—"}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-xs text-rose-600 whitespace-nowrap">
                        {formatCurrency(rc.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {rc.cashierName || "Thu ngân"}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {rc.isVoided ? (
                          <Badge variant="destructive" className="text-[10px]" title={`Lý do: ${rc.voidReason || "Sai sót"}`}>
                            Đã bị hủy
                          </Badge>
                        ) : rc.closingSessionCode ? (
                          <Badge className="bg-slate-200 text-slate-800 text-[10px]" title={`Biên bản: ${rc.closingSessionCode}`}>
                            Đã chốt ca
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                            Hợp lệ
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReprintReceipt(rc)}
                          className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-100 font-medium"
                          title="Xem trước và in lại phiếu thu phụ huynh"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          In lại
                        </Button>

                        {/* Nút Hủy phiếu: Chỉ hiển thị cho Kế toán hoặc Admin khi phiếu chưa hủy và chưa khóa sổ */}
                        {isAccountantOrAdmin && !rc.isVoided && rc.closingSessionStatus !== "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleVoidReceipt(rc)}
                            className="h-7 px-2 text-[11px] font-medium"
                            title="Hủy phiếu thu sai sót (Yêu cầu quyền Kế toán / Admin)"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Hủy phiếu
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* PHÂN TRANG */}
          {receiptTotalRecords > 0 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
              <div>
                Hiển thị <b>{(receiptPage - 1) * receiptLimit + 1}</b> – <b>{Math.min(receiptPage * receiptLimit, receiptTotalRecords)}</b> trên tổng số <b>{receiptTotalRecords}</b> phiếu thu
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchReceiptsList(receiptPage - 1)}
                  disabled={receiptPage <= 1 || loadingReceipts}
                  className="h-7 px-2.5 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Trước
                </Button>
                <span className="font-semibold text-slate-800">
                  Trang {receiptPage} / {receiptTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchReceiptsList(receiptPage + 1)}
                  disabled={receiptPage >= receiptTotalPages || loadingReceipts}
                  className="h-7 px-2.5 text-xs"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG XEM TRƯỚC VÀ IN PHIẾU THU TIỀN MẶT */}
      <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {printReceiptData && (
            <CashReceiptPrint
              data={printReceiptData}
              onClose={() => setOpenPrintModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG XEM TRƯỚC VÀ IN PHIẾU THANH TOÁN (KÈM MÃ QR) HỖ TRỢ K80 VÀ A5 */}
      <Dialog open={openPrintBillModal} onOpenChange={setOpenPrintBillModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {printBillData && (
            <PaymentBillPrint
              data={printBillData}
              onClose={() => setOpenPrintBillModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG DANH SÁCH CHỜ QUYẾT TOÁN THU NỢ DÀNH CHO THU NGÂN */}
      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <FileText className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Danh Sách Học Sinh Hủy Bán Trú Chờ Quyết Toán Thu Nợ
              </DialogTitle>
            </div>
            <p className="text-xs text-slate-500">
              Các học sinh đã làm thủ tục ngừng ăn bán trú nhưng còn nợ tiền ăn theo ngày thực tế. Bấm &quot;Chọn thu&quot; để nạp học sinh lên quầy thu tiền ngay.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingPending ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-rose-600" />
                Đang tải danh sách chờ thu nợ...
              </div>
            ) : pendingCollections.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-700">Không có học sinh nào nợ tiền quyết toán.</p>
                <p className="text-slate-400">Tất cả các học sinh đã hủy ăn đều đã thanh toán đủ tiền.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <tr className="bg-slate-50 text-[11px]">
                      <TableHead className="w-10 text-center">STT</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="text-center">Lớp</TableHead>
                      <TableHead>Mã BT</TableHead>
                      <TableHead className="text-right">Tiền còn nợ</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {pendingCollections.map((item, index) => (
                      <TableRow key={item.studentId} className="hover:bg-slate-50 text-xs">
                        <TableCell className="text-center font-medium text-slate-500">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900 uppercase">
                          {item.fullName}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-700">
                          {item.className}
                        </TableCell>
                        <TableCell className="font-mono text-slate-800">
                          {item.boardingCode || "—"}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-rose-600">
                          {formatCurrency(item.totalRemainingDebt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setShowPendingModal(false);
                              handleSelectStudent({
                                id: item.studentId,
                                studentCode: item.studentCode,
                                boardingCode: item.boardingCode,
                                classId: item.className,
                                class: { name: item.className },
                                user: { fullName: item.fullName },
                                boardingStatus: "CANCELLED",
                                boardingCancelledAt: item.boardingCancelledAt,
                                settlementRecords: item.settlementRecord ? [item.settlementRecord] : [],
                              });
                            }}
                            className="h-7 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            Chọn thu
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPendingModal(false)} className="text-xs">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
