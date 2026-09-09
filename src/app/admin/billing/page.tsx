"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Swal from "sweetalert2";

import { numberToVietnameseWords } from "@/lib/utils";
import Barcode from "react-barcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  Receipt,
  Printer,
  FileDown,
  Loader2,
  Calculator,
  CreditCard,
  Layers,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Banknote,
  FileCheck2,
  UtensilsCrossed,
  Trash2,
  RotateCcw,
  Scale,
  ChevronDown,
  Archive,
  Files,
  FileText,
  BellRing,
} from "lucide-react";
import { DebtNotificationPrint } from "@/components/admin/debt-notification-print";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/hooks/use-realtime";
import { CashPos } from "@/components/admin/cash-pos";
import { CashClosingManager } from "@/components/admin/cash-closing-manager";
import { SettlementManager } from "@/components/admin/settlement-manager";

interface BillData {
  id: string;
  studentId: string;
  month: number;
  year: number;
  scheduleMealDays: number;
  canceledDays: number;
  scheduleReducedDays?: number;
  extraMealDays?: number;
  netPayableDays: number;
  unitPrice: string;
  totalAmount: string;
  previousDeduction: string;
  previousAddition?: string;
  finalAmount: string;
  paymentStatus: string;
  qrCodeUrl: string | null;
  transactions?: Array<{ id: string; amount: string | number; transDate: string }>;
  student: {
    id: string;
    studentCode: string;
    boardingCode: string;
    mealType: string;
    user: { fullName: string };
    class: { id: string; name: string };
    mealCancellations?: { cancelDate: string }[];
  };
}

interface BillStats {
  totalBills: number;
  totalAmount: string;
  paidCount: number;
  unpaidCount: number;
}

interface SepayTransaction {
  id: string;
  billId?: string | null;
  studentId?: string | null;
  sepayTransId?: string | null;
  amount: string | number;
  content: string;
  transDate: string;
  gateway?: string | null;
  accountNumber?: string | null;
  status: "MATCHED" | "UNMATCHED" | "MANUAL" | "IGNORED";
  unmatchedReason?: string | null;
  bill?: {
    id: string;
    month: number;
    year: number;
    finalAmount: string | number;
    paymentStatus: string;
    student: {
      boardingCode?: string | null;
      studentCode: string;
      user: { fullName: string };
      class: { name: string };
    };
  } | null;
  student?: {
    id: string;
    boardingCode?: string | null;
    studentCode: string;
    user: { fullName: string };
    class: { name: string };
  } | null;
}

export default function BillingPage() {
  const { data: session } = useSession();
  const isCashier = session?.user?.role === "CASHIER";
  const [activeTab, setActiveTab] = useState("bills");

  // ================= TAB 1: BILLS STATE =================
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bills, setBills] = useState<BillData[]>([]);
  const [stats, setStats] = useState<BillStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [printBillId, setPrintBillId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<BillData | null>(null);
  const [editForm, setEditForm] = useState({
    scheduleMealDays: 0,
    canceledDays: 0,
    scheduleReducedDays: 0,
    extraMealDays: 0,
    unitPrice: 0,
    previousDeduction: 0,
    previousAddition: 0,
    paymentStatus: "UNPAID",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Phân trang Bills server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const ITEMS_PER_PAGE = 30;

  // Progress bar cho tạo hàng loạt
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentClass: string;
  } | null>(null);

  // State for PDF Export Modal
  const [openPdfZipModal, setOpenPdfZipModal] = useState(false);
  const [pdfZipMonth, setPdfZipMonth] = useState<number>(month);
  const [pdfZipYear, setPdfZipYear] = useState<number>(year);
  const [pdfZipClassId, setPdfZipClassId] = useState<string>("ALL");
  const [pdfZipStatus, setPdfZipStatus] = useState<string>("ALL");
  const [pdfExportMode, setPdfExportMode] = useState<"SEPARATE_ZIP" | "CLASS_MERGED" | "ALL_IN_ONE">("SEPARATE_ZIP");
  const [downloadingPdfZip, setDownloadingPdfZip] = useState(false);

  // State cho In thông báo nợ gửi phụ huynh
  const [openDebtModal, setOpenDebtModal] = useState(false);
  const [debtMonth, setDebtMonth] = useState<number>(month);
  const [debtYear, setDebtYear] = useState<number>(year);
  const [debtClassId, setDebtClassId] = useState<string>("ALL");
  const [debtLayout, setDebtLayout] = useState<"A5_LANDSCAPE_2UP" | "A4_PORTRAIT_4UP">("A5_LANDSCAPE_2UP");
  const [loadingDebtBills, setLoadingDebtBills] = useState(false);
  const [debtPrintBills, setDebtPrintBills] = useState<any[] | null>(null);

  const handleOpenDebtModal = () => {
    setDebtMonth(month);
    setDebtYear(year);
    setDebtClassId(classFilter === "all" ? "ALL" : classFilter);
    setDebtLayout("A5_LANDSCAPE_2UP");
    setOpenDebtModal(true);
  };

  const handleStartDebtPrint = async () => {
    setLoadingDebtBills(true);
    try {
      let url = `/api/billing?month=${debtMonth}&year=${debtYear}&unpaidOnly=true&all=true`;
      if (debtClassId !== "ALL" && debtClassId !== "all") {
        url += `&classId=${debtClassId}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      const billsData = json.data || [];
      if (billsData.length === 0) {
        Swal.fire({
          title: "Không có công nợ",
          text: `Tuyệt vời! Không có học sinh nào còn nợ tiền ăn ${
            debtClassId !== "ALL" ? `lớp ${classes.find((c) => c.id === debtClassId)?.name || debtClassId}` : "toàn trường"
          } trong tháng ${debtMonth}/${debtYear}.`,
          icon: "info",
        });
        return;
      }
      setDebtPrintBills(billsData);
      setOpenDebtModal(false);
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải danh sách học sinh còn nợ", "error");
    } finally {
      setLoadingDebtBills(false);
    }
  };

  const handleOpenExportModal = (mode: "SEPARATE_ZIP" | "CLASS_MERGED" | "ALL_IN_ONE") => {
    setPdfZipMonth(month);
    setPdfZipYear(year);
    setPdfZipClassId(classFilter === "all" ? "ALL" : classFilter);
    setPdfZipStatus("ALL");
    setPdfExportMode(mode);
    setOpenPdfZipModal(true);
  };

  // ================= TAB 2: SEPAY TRANSACTIONS STATE =================
  const [transactions, setTransactions] = useState<SepayTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotalRecords, setTxTotalRecords] = useState(0);
  const [txStats, setTxStats] = useState<{
    totalTransactions: number;
    totalAmount: string;
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Manual Match Dialog State
  const [selectedTxForMatch, setSelectedTxForMatch] = useState<SepayTransaction | null>(null);
  const [matchStudents, setMatchStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentUnpaidBills, setStudentUnpaidBills] = useState<any[]>([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [matchSearchTerm, setMatchSearchTerm] = useState("");
  const [autoDetectedStudent, setAutoDetectedStudent] = useState<any | null>(null);

  // Bộ lọc tìm kiếm học sinh theo tên, lớp, mã bán trú (tính toán tức thời)
  const filteredMatchStudents = useMemo(() => {
    if (!matchSearchTerm.trim()) return matchStudents;
    const term = matchSearchTerm.toLowerCase().trim();
    return matchStudents.filter((st) => {
      const name = st.user?.fullName?.toLowerCase() || "";
      const className = st.class?.name?.toLowerCase() || st.classId?.toLowerCase() || "";
      const boardingCode = st.boardingCode?.toLowerCase() || "";
      const studentCode = st.studentCode?.toLowerCase() || "";
      return name.includes(term) || className.includes(term) || boardingCode.includes(term) || studentCode.includes(term);
    });
  }, [matchStudents, matchSearchTerm]);


  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (Array.isArray(data)) {
        setClasses(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch {
      try {
        const res = await fetch("/api/students?status=ACTIVE");
        const data = await res.json();
        const uniqueClasses = new Map<string, string>();
        data.forEach((s: { classId: string; class: { name: string } }) => {
          uniqueClasses.set(s.classId, s.class.name);
        });
        setClasses(Array.from(uniqueClasses.entries()).map(([id, name]) => ({ id, name })));
      } catch {
        // ignore
      }
    }
  };

  // Fetch Bills
  const fetchBills = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      try {
        if (classes.length === 0) await fetchClasses();
        if (Object.keys(settings).length === 0) await fetchSettings();

        let url = `/api/billing?month=${month}&year=${year}&page=${page}&limit=${ITEMS_PER_PAGE}`;
        if (classFilter !== "all") url += `&classId=${classFilter}`;
        if (statusFilter !== "all") url += `&paymentStatus=${statusFilter}`;
        const res = await fetch(url);
        const result = await res.json();

        if (result.data) {
          setBills(result.data);
          setTotalPages(result.totalPages || 1);
          setTotalRecords(result.total || 0);
          setStats(result.stats || null);
          setCurrentPage(page);
        } else {
          setBills(Array.isArray(result) ? result : []);
        }
      } catch {
        Swal.fire("Lỗi", "Lỗi khi tải danh sách hóa đơn", "error");
      } finally {
        setLoading(false);
      }
    },
    [month, year, classFilter, statusFilter, classes.length, settings]
  );

  // Fetch SePay Transactions
  const fetchTransactions = useCallback(
    async (page: number = 1) => {
      setTxLoading(true);
      try {
        let url = `/api/sepay/transactions?page=${page}&limit=20`;
        if (txStatusFilter !== "all") url += `&status=${txStatusFilter}`;
        if (txSearch.trim()) url += `&search=${encodeURIComponent(txSearch.trim())}`;

        const res = await fetch(url);
        const result = await res.json();

        if (result.data) {
          setTransactions(result.data);
          setTxTotalPages(result.totalPages || 1);
          setTxTotalRecords(result.total || 0);
          setTxStats(result.stats || null);
          setTxPage(page);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setTxLoading(false);
      }
    },
    [txStatusFilter, txSearch]
  );

  // Realtime updates
  useRealtime({
    table: "monthly_bills",
    event: "*",
    onChanged: () => {
      fetchBills(currentPage);
    },
  });

  useRealtime({
    table: "payment_transactions",
    event: "*",
    onChanged: () => {
      fetchTransactions(txPage);
      fetchBills(currentPage);
    },
  });

  useEffect(() => {
    fetchClasses();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isCashier && activeTab !== "pos" && activeTab !== "cash-closing") {
      setActiveTab("pos");
    }
  }, [isCashier, activeTab]);

  useEffect(() => {
    if (isCashier) return;
    if (activeTab === "bills") {
      fetchBills(currentPage);
    } else if (activeTab === "transactions") {
      fetchTransactions(txPage);
    }
  }, [activeTab, fetchBills, fetchTransactions, currentPage, txPage, isCashier]);

  // Handle Sync SePay API
  const handleSyncSepay = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sepay/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Đồng bộ thành công", data.message, "success");
        fetchTransactions(1);
        fetchBills(currentPage);
      } else {
        Swal.fire("Lỗi đồng bộ", data.error || "Không thể đồng bộ từ SePay API", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối khi đồng bộ SePay", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Dọn dẹp tất cả giao dịch chưa khớp (bao gồm 0đ và giao dịch nhầm tài khoản)
  const handleCleanZeroTxs = async () => {
    const confirm = await Swal.fire({
      title: "Dọn dẹp giao dịch chưa khớp?",
      html: `<p class="text-sm text-left">Hệ thống sẽ <b class="text-rose-600">xóa tất cả</b> các giao dịch đang ở trạng thái <b>"Chưa khớp"</b> trong danh sách.</p>
             <p class="text-xs text-left mt-2 text-gray-500">Bao gồm: giao dịch 0đ do đồng bộ lỗi, giao dịch nhầm tài khoản, giao dịch không đúng cú pháp BSTLM...</p>
             <p class="text-xs text-left mt-1 text-amber-700 font-semibold">⚠️ Các giao dịch đã gạch nợ thành công (Đã khớp / Gạch tay) sẽ KHÔNG bị ảnh hưởng.</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa tất cả chưa khớp",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#e11d48",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch("/api/sepay/transactions?cleanAllUnmatched=true", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchTransactions(1);
      } else {
        Swal.fire("Lỗi", data.error || "Không thể dọn dẹp giao dịch", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối khi dọn dẹp giao dịch", "error");
    }
  };

  // Xóa 1 giao dịch chưa khớp
  const handleDeleteTx = async (txId: string) => {
    const confirm = await Swal.fire({
      title: "Xóa giao dịch này?",
      text: "Giao dịch chưa khớp này sẽ bị xóa khỏi danh sách. Bạn có chắc chắn?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#e11d48",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/sepay/transactions?id=${txId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Đã xóa", data.message, "success");
        fetchTransactions(txPage);
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xóa giao dịch", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối khi xóa giao dịch", "error");
    }
  };

  // Hủy gạch nợ (Void) - Hoàn tác giao dịch đã khớp nhầm (như các giao dịch demo/test)
  const handleVoidTransaction = async (txId: string, studentName?: string) => {
    const confirm = await Swal.fire({
      title: "Hủy gạch nợ giao dịch này?",
      html: `
        <div class="text-sm text-left space-y-3">
          <p>Giao dịch đã gạch cho học sinh <b class="text-blue-700">${studentName || "này"}</b> sẽ bị hoàn tác.</p>
          <p class="text-amber-700 font-medium">⚠️ Số tiền sẽ được trừ ra khỏi hóa đơn. Hóa đơn sẽ được cập nhật lại về trạng thái <b>Chưa thanh toán</b> (nếu không còn khoản đóng nào khác).</p>
          <div class="pt-2 border-t border-gray-200">
            <label class="flex items-center gap-2 cursor-pointer text-slate-800 text-xs font-semibold">
              <input type="checkbox" id="swal-delete-tx" class="rounded text-rose-600 h-4 w-4" checked />
              <span>Đồng thời xóa hẳn giao dịch test này khỏi hệ thống</span>
            </label>
            <p class="text-[11px] text-gray-500 mt-1 pl-6">Nếu bỏ chọn, giao dịch sẽ chuyển về trạng thái &quot;Chưa khớp&quot; để gạch tay lại.</p>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận hủy gạch nợ",
      cancelButtonText: "Không hủy",
      confirmButtonColor: "#e11d48",
      preConfirm: () => {
        const checkbox = document.getElementById("swal-delete-tx") as HTMLInputElement;
        return { deleteTx: checkbox ? checkbox.checked : true };
      },
    });

    if (!confirm.isConfirmed) return;

    const deleteTx = confirm.value?.deleteTx ?? true;

    try {
      const res = await fetch("/api/sepay/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          reason: "Hủy gạch nợ giao dịch demo/test",
          deleteTx,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchTransactions(txPage);
        fetchBills(currentPage);
      } else {
        Swal.fire("Lỗi", data.error || "Không thể hủy gạch nợ", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối khi hủy gạch nợ", "error");
    }
  };

  // Open Manual Match Modal
  const openManualMatchModal = async (tx: SepayTransaction) => {
    setSelectedTxForMatch(tx);
    setSelectedStudentId("");
    setSelectedBillId("");
    setStudentUnpaidBills([]);
    setMatchSearchTerm("");
    setAutoDetectedStudent(null);

    // Fetch active students for selector
    try {
      const res = await fetch("/api/students?status=ACTIVE");
      const data = await res.json();
      const studentsList: any[] = Array.isArray(data) ? data : [];
      setMatchStudents(studentsList);

      // Tự động quét nội dung giao dịch để tìm mã học sinh (VD: BT00864, HS001...)
      const rawText = tx.content || '';
      const codeMatch = rawText.match(/(BT\d+|HS\d+)/i);
      if (codeMatch) {
        const detectedCode = codeMatch[1].toUpperCase();
        const found = studentsList.find((st) =>
          st.boardingCode?.toUpperCase() === detectedCode ||
          st.studentCode?.toUpperCase() === detectedCode
        );
        if (found) {
          setAutoDetectedStudent(found);
          handleStudentSelectForMatch(found.id, tx);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // When student is selected in Manual Match Modal, load their bills
  const handleStudentSelectForMatch = async (stId: string, currentTx?: SepayTransaction | null) => {
    setSelectedStudentId(stId);
    setSelectedBillId("");
    if (!stId) {
      setStudentUnpaidBills([]);
      return;
    }

    try {
      const res = await fetch(`/api/billing?studentId=${stId}`);
      const data = await res.json();
      if (data.data) {
        const bills: any[] = data.data;
        setStudentUnpaidBills(bills);

        // Tự động chọn hóa đơn chưa thanh toán phù hợp nhất
        const targetTx = currentTx || selectedTxForMatch;
        const rawText = targetTx?.content || '';
        const monthMatch = rawText.match(/T(?:HÁNG|HANG)?\s*(0[1-9]|1[0-2]|[1-9])/i) || rawText.match(/[-_](\d{2})(0[1-9]|1[0-2])(\d{2})/);
        let detectedMonth = monthMatch ? parseInt(monthMatch[monthMatch.length - 1], 10) : undefined;
        
        let matchingBill = detectedMonth ? bills.find(b => b.month === detectedMonth && b.paymentStatus !== "PAID") : null;
        if (!matchingBill) {
          matchingBill = bills.find(b => b.paymentStatus !== "PAID") || bills[0];
        }
        if (matchingBill) {
          setSelectedBillId(matchingBill.id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Execute Manual Match
  const executeManualMatch = async () => {
    if (!selectedTxForMatch || !selectedBillId) {
      Swal.fire("Thiếu thông tin", "Vui lòng chọn hóa đơn cần gạch nợ", "warning");
      return;
    }

    setMatchingInProgress(true);
    try {
      const res = await fetch("/api/sepay/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTxForMatch.id,
          billId: selectedBillId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        setSelectedTxForMatch(null);
        fetchTransactions(txPage);
        fetchBills(currentPage);
      } else {
        Swal.fire("Lỗi", data.error || "Gạch nợ thất bại", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Không thể kết nối máy chủ", "error");
    } finally {
      setMatchingInProgress(false);
    }
  };


  // Tạo hóa đơn cho 1 lớp
  const generateBillsForClass = async (targetClassId: string, className: string) => {
    const result = await Swal.fire({
      title: "Xác nhận",
      html: `Tạo hóa đơn tháng <b>${month}/${year}</b> cho lớp <b>${className}</b>?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Tạo hóa đơn",
      cancelButtonText: "Hủy",
    });
    if (!result.isConfirmed) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, classId: targetClassId }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchBills(1);
      } else {
        Swal.fire("Lỗi", data.error || "Lỗi khi tạo hóa đơn", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tạo hóa đơn", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Tạo hóa đơn TẤT CẢ
  const generateBillsAll = async () => {
    if (classes.length === 0) await fetchClasses();
    if (classes.length === 0) {
      Swal.fire("Lỗi", "Không tìm thấy danh sách lớp", "error");
      return;
    }

    const result = await Swal.fire({
      title: "Xác nhận tạo hóa đơn tất cả",
      html: `Tạo hóa đơn tháng <b>${month}/${year}</b> cho <b>${classes.length} lớp</b>.<br/><br/>Hệ thống sẽ xử lý <b>tuần tự từng lớp</b> để tránh quá tải.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Bắt đầu tạo",
      cancelButtonText: "Hủy",
    });
    if (!result.isConfirmed) return;

    setGenerating(true);
    setBatchProgress({ current: 0, total: classes.length, currentClass: "" });

    let successCount = 0;
    let totalStudents = 0;
    const errors: string[] = [];

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      setBatchProgress({ current: i + 1, total: classes.length, currentClass: cls.name });

      try {
        const res = await fetch("/api/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, year, classId: cls.id }),
        });
        const data = await res.json();
        if (res.ok) {
          successCount++;
          totalStudents += data.count || 0;
        } else {
          errors.push(`${cls.name}: ${data.error}`);
        }
      } catch {
        errors.push(`${cls.name}: Lỗi kết nối`);
      }
    }

    setBatchProgress(null);
    setGenerating(false);

    if (errors.length > 0) {
      Swal.fire({
        title: "Hoàn tất (có lỗi)",
        html: `Đã tạo <b>${totalStudents}</b> hóa đơn cho <b>${successCount}/${classes.length}</b> lớp.<br/><br/><b>Lỗi:</b><br/>${errors.join("<br/>")}`,
        icon: "warning",
      });
    } else {
      Swal.fire(
        "Thành công",
        `Đã tạo/cập nhật ${totalStudents} hóa đơn cho tất cả ${successCount} lớp tháng ${month}/${year}`,
        "success"
      );
    }

    fetchBills(1);
  };

  // In phiếu
  const printBills = () => {
    setPrintBillId("ALL");
    setTimeout(() => window.print(), 800);
  };

  const printSingleBill = (id: string) => {
    setPrintBillId(id);
    setTimeout(() => window.print(), 800);
  };

  // Tải trọn bộ PDF (theo lớp hoặc gộp)
  const handleDownloadPdfZip = async () => {
    setDownloadingPdfZip(true);
    try {
      const url = `/api/billing/export-pdf-zip?month=${pdfZipMonth}&year=${pdfZipYear}&classId=${pdfZipClassId}&status=${pdfZipStatus}&mode=${pdfExportMode}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi tải file" }));
        throw new Error(err.error || "Không thể tải file");
      }

      // Đọc tên file từ header Content-Disposition nếu có
      const disposition = res.headers.get("content-disposition");
      let filename = "";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      if (!filename) {
        const mm = String(pdfZipMonth).padStart(2, "0");
        const selectedClassObj = classes.find((c) => c.id === pdfZipClassId);
        const classNamePart = selectedClassObj ? `_Lop_${selectedClassObj.name.replace(/\s+/g, "_")}` : "_Toan_Truong";
        const isZip = res.headers.get("content-type")?.includes("zip");
        filename = isZip
          ? `Phieu_Tien_An${classNamePart}_T${mm}_${pdfZipYear}.zip`
          : `Phieu_Tien_An${classNamePart}_T${mm}_${pdfZipYear}.pdf`;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      const successMsg =
        pdfExportMode === "SEPARATE_ZIP"
          ? "Đã tải về trọn bộ PDF phân theo thư mục lớp (ZIP)!"
          : pdfExportMode === "CLASS_MERGED"
          ? "Đã tải về file PDF theo lớp (tất cả bill của lớp trong 1 file)!"
          : "Đã tải về toàn bộ hóa đơn gộp trong 1 file PDF!";
      Swal.fire("Thành công", successMsg, "success");
      setOpenPdfZipModal(false);
    } catch (err: any) {
      console.error(err);
      Swal.fire("Lỗi", err.message || "Lỗi khi tải file", "error");
    } finally {
      setDownloadingPdfZip(false);
    }
  };

  const openEditModal = (bill: BillData) => {
    setEditingBill(bill);
    setEditForm({
      scheduleMealDays: bill.scheduleMealDays,
      canceledDays: bill.canceledDays,
      scheduleReducedDays: bill.scheduleReducedDays || 0,
      extraMealDays: bill.extraMealDays || 0,
      unitPrice: parseInt(bill.unitPrice),
      previousDeduction: parseInt(bill.previousDeduction),
      previousAddition: parseInt(bill.previousAddition || "0"),
      paymentStatus: bill.paymentStatus,
    });
  };

  const saveEditBill = async () => {
    if (!editingBill) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBill.id,
          ...editForm,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", "Đã cập nhật hóa đơn", "success");
        setEditingBill(null);
        fetchBills(currentPage);
      } else {
        Swal.fire("Lỗi", data.error, "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi lưu hóa đơn", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const formatVND = (amount: string | number) => {
    const num = typeof amount === "string" ? parseInt(amount) : amount;
    return new Intl.NumberFormat("vi-VN").format(num || 0) + "đ";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-100 text-green-700 border-green-300">Đã thanh toán</Badge>;
      case "PARTIAL":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Thanh toán 1 phần</Badge>;
      case "SETTLED":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Đã quyết toán</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700 border-red-300">Chưa thanh toán</Badge>;
    }
  };

  const txStatusBadge = (status: string, unmatchedReason?: string | null) => {
    switch (status) {
      case "MATCHED":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Tự động khớp
          </Badge>
        );
      case "MANUAL":
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-300 flex items-center gap-1">
            <UserCheck className="h-3 w-3" /> Gạch nợ thủ công
          </Badge>
        );
      case "UNMATCHED":
        if (unmatchedReason && unmatchedReason.toUpperCase().includes('HOÀN TIỀN')) {
          return (
            <Badge className="bg-red-100 text-red-700 border-red-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Cần hoàn tiền
            </Badge>
          );
        }
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-300 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Chưa khớp
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          {isCashier ? (
            <>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                <Banknote className="h-7 w-7 text-emerald-600" />
                Quầy Thu Ngân & Bàn Giao Tiền Mặt
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Thu tiền mặt tại quầy, in phiếu thu phụ huynh và lập báo cáo bàn giao tiền mặt cuối ngày
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                <Receipt className="h-7 w-7 text-blue-600" />
                Hóa đơn & Thanh toán Tự gạch nợ
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Tạo hóa đơn, in phiếu thu A5, tự động gạch nợ qua SePay (VietQR) và đối soát ngân hàng
              </p>
            </>
          )}
        </div>

        {/* Nút chuyển nhanh cho Thu Ngân */}
        {isCashier && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/daily-meals?tab=dining-areas">
              <Button
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 cursor-pointer shadow-2xs font-semibold"
              >
                <UtensilsCrossed className="h-4 w-4 text-blue-600" />
                Chia Sân & Xuất PDF
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="no-print">
        <TabsList
          className={`grid ${
            isCashier ? "grid-cols-2 max-w-md" : "grid-cols-2 sm:grid-cols-5 max-w-4xl"
          } w-full h-auto p-1.5 gap-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs`}
        >
          {isCashier ? (
            <>
              <TabsTrigger
                value="pos"
                className="flex items-center justify-center gap-2 py-2.5 font-bold cursor-pointer transition-all duration-150 text-slate-700 hover:text-emerald-900 hover:bg-emerald-100/70 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <Banknote className="h-4 w-4 text-emerald-600 group-data-[state=active]:text-white" />
                💵 Quầy Thu Tiền
              </TabsTrigger>
              <TabsTrigger
                value="cash-closing"
                className="flex items-center justify-center gap-2 py-2.5 font-bold cursor-pointer transition-all duration-150 text-slate-700 hover:text-blue-900 hover:bg-blue-100/70 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <FileCheck2 className="h-4 w-4 text-blue-600 group-data-[state=active]:text-white" />
                📄 Chốt Ca & Báo Cáo
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger
                value="bills"
                className="flex items-center justify-center gap-2 py-2.5 font-semibold cursor-pointer transition-all duration-150 text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <Receipt className="h-4 w-4 text-slate-600 group-data-[state=active]:text-white" />
                Hóa đơn
              </TabsTrigger>
              <TabsTrigger
                value="pos"
                className="flex items-center justify-center gap-2 py-2.5 font-semibold cursor-pointer transition-all duration-150 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/80 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <Banknote className="h-4 w-4 text-emerald-600 group-data-[state=active]:text-white" />
                Quầy Thu Tiền
              </TabsTrigger>
              <TabsTrigger
                value="settlements"
                className="flex items-center justify-center gap-2 py-2.5 font-semibold cursor-pointer transition-all duration-150 text-rose-700 hover:text-rose-900 hover:bg-rose-100/80 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <Scale className="h-4 w-4 text-rose-600 group-data-[state=active]:text-white" />
                Quyết Toán Hủy Ăn
              </TabsTrigger>
              <TabsTrigger
                value="cash-closing"
                className="flex items-center justify-center gap-2 py-2.5 font-semibold cursor-pointer transition-all duration-150 text-blue-700 hover:text-blue-900 hover:bg-blue-100/80 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <FileCheck2 className="h-4 w-4 text-blue-600 group-data-[state=active]:text-white" />
                Chốt Ca & Báo Cáo
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="flex items-center justify-center gap-2 py-2.5 font-semibold cursor-pointer transition-all duration-150 text-slate-700 hover:text-indigo-900 hover:bg-indigo-100/80 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
              >
                <CreditCard className="h-4 w-4 text-indigo-600 group-data-[state=active]:text-white" />
                Đối soát SePay
                {txStats && txStats.unmatchedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500 group-data-[state=active]:bg-white group-data-[state=active]:text-indigo-700 text-white rounded-full font-bold transition-colors">
                    {txStats.unmatchedCount}
                  </span>
                )}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ================= TAB: QUẦY THU TIỀN ================= */}
        <TabsContent value="pos" className="space-y-4 pt-2">
          <CashPos currentUser={session?.user} />
        </TabsContent>

        {/* ================= TAB: CHỐT CA & BÁO CÁO BÀN GIAO ================= */}
        <TabsContent value="cash-closing" className="space-y-4 pt-2">
          <CashClosingManager currentUser={session?.user} />
        </TabsContent>

        {!isCashier && (
          <>
            {/* ================= TAB: QUYẾT TOÁN HỦY BÁN TRÚ (KẾ TOÁN & ADMIN) ================= */}
            <TabsContent value="settlements" className="space-y-4 pt-2">
              <SettlementManager
                currentUser={session?.user}
                onSelectStudentToCollect={() => {
                  setActiveTab("pos");
                }}
              />
            </TabsContent>

            {/* ================= TAB 1: DANH SÁCH HÓA ĐƠN ================= */}
            <TabsContent value="bills" className="space-y-4 pt-2">
          {/* Bộ lọc */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div>
                  <Label>Tháng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Năm</Label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Lớp</Label>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trạng thái</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="UNPAID">Chưa TT</SelectItem>
                      <SelectItem value="PAID">Đã TT</SelectItem>
                      <SelectItem value="PARTIAL">TT 1 phần</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => fetchBills(1)} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải dữ liệu"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nút hành động */}
          <div className="flex flex-wrap gap-3">
            {classFilter !== "all" ? (
              <Button
                onClick={() => {
                  const cls = classes.find((c) => c.id === classFilter);
                  if (cls) generateBillsForClass(cls.id, cls.name);
                }}
                disabled={generating}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2 text-white" /> : <Calculator className="h-4 w-4 mr-2 text-white" />}
                Tạo hóa đơn lớp {classes.find((c) => c.id === classFilter)?.name} — T{month}/{year}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Select
                  onValueChange={(val) => {
                    const cls = classes.find((c) => c.id === val);
                    if (cls) generateBillsForClass(cls.id, cls.name);
                  }}
                  disabled={generating}
                >
                  <SelectTrigger className="w-[250px]">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      <span>Tạo hóa đơn theo lớp...</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={generateBillsAll}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2 text-white" /> : <Layers className="h-4 w-4 mr-2 text-white" />}
              Tạo tất cả ({classes.length} lớp)
            </Button>

            <Button
              onClick={printBills}
              disabled={bills.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <Printer className="h-4 w-4 mr-2 text-white" />
              In phiếu trang hiện tại
            </Button>

            <Button
              onClick={handleOpenDebtModal}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <BellRing className="h-4 w-4 text-white" />
              <span>In thông báo nợ</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                >
                  <FileDown className="h-4 w-4 text-white" />
                  <span>Tải PDF theo lớp</span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/90 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96 p-1.5 shadow-xl bg-white border border-slate-200">
                <DropdownMenuItem
                  onClick={() => handleOpenExportModal("SEPARATE_ZIP")}
                  className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md hover:bg-emerald-50 focus:bg-emerald-50 text-slate-800 transition-colors"
                >
                  <Archive className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900">
                      Tải PDF theo lớp như logic hiện tại (ZIP)
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Mỗi học sinh 1 file riêng, nén ZIP phân theo thư mục từng lớp.
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => handleOpenExportModal("CLASS_MERGED")}
                  className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md hover:bg-emerald-50 focus:bg-emerald-50 text-slate-800 transition-colors"
                >
                  <Files className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900">
                      Tải PDF theo lớp (tất cả bill của lớp trong 1 file PDF)
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Mỗi lớp gom thành 1 file PDF gồm nhiều trang (thuận tiện in theo từng lớp).
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => handleOpenExportModal("ALL_IN_ONE")}
                  className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md hover:bg-emerald-50 focus:bg-emerald-50 text-slate-800 transition-colors"
                >
                  <FileText className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900">
                      Gộp chung tất cả phiếu trong 1 file (không phân lớp)
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Toàn bộ phiếu thu gộp vào đúng 1 file PDF duy nhất (thuận tiện gửi lệnh in toàn trường).
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress bar */}
          {batchProgress && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    Đang tạo hóa đơn: Lớp {batchProgress.currentClass}
                  </span>
                  <span className="text-sm font-semibold text-blue-700">
                    {batchProgress.current}/{batchProgress.total} lớp
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Thống kê Bills */}
          {stats && stats.totalBills > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-500">Tổng hóa đơn</p>
                  <p className="text-2xl font-bold">{stats.totalBills}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-500">Đã thanh toán</p>
                  <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-500">Chưa thanh toán</p>
                  <p className="text-2xl font-bold text-red-600">{stats.unpaidCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-500">Tổng tiền</p>
                  <p className="text-xl font-bold text-blue-600">{formatVND(stats.totalAmount)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Bảng Bills */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Danh sách hóa đơn tháng {month}/{year}
                {totalRecords > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {totalRecords} hóa đơn
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table wrapperClassName="max-h-[60vh]">
                <TableHeader className="sticky top-0 z-10 bg-white shadow-sm shadow-slate-200">
                  <TableRow>
                    <TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead>Mã Bán Trú</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-center">Ngày ăn</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-center">Ngày cắt/hủy</TableHead>
                    <TableHead className="text-right">Trừ T.trước</TableHead>
                    <TableHead className="text-right">Ăn thêm (+)</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill, idx) => (
                    <TableRow key={bill.id}>
                      <TableCell className="text-center text-slate-500 font-medium">
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">
                        {bill.student.boardingCode || bill.student.studentCode}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {bill.student.user.fullName}
                      </TableCell>
                      <TableCell>{bill.student.class.name}</TableCell>
                      <TableCell className="text-center font-medium">{bill.netPayableDays}</TableCell>
                      <TableCell className="text-right text-xs text-slate-600">
                        {formatVND(bill.unitPrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        {bill.canceledDays > 0 ? (
                          <div>
                            <span className="text-rose-600 font-semibold">{bill.canceledDays}</span>
                            {(bill.scheduleReducedDays ?? 0) > 0 && (
                              <span className="block text-[10px] text-slate-500 font-normal">
                                ({bill.canceledDays - (bill.scheduleReducedDays ?? 0)} cắt + {bill.scheduleReducedDays} hủy)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {parseInt(bill.previousDeduction) > 0 ? (
                          <span className="text-rose-600 font-medium">-{formatVND(bill.previousDeduction)}</span>
                        ) : (
                          <span className="text-slate-400">0đ</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {parseInt(bill.previousAddition || "0") > 0 || (bill.extraMealDays ?? 0) > 0 ? (
                          <div>
                            <span className="text-emerald-700 font-medium">+{formatVND(bill.previousAddition || 0)}</span>
                            {(bill.extraMealDays ?? 0) > 0 && (
                              <span className="block text-[10px] text-slate-500 font-normal">
                                ({bill.extraMealDays} ngày)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">0đ</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        <div>{formatVND(bill.finalAmount)}</div>
                        {(() => {
                          const paid = (bill.transactions || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
                          const remaining = Math.max(0, Number(bill.finalAmount) - paid);
                          if (paid > 0 && bill.paymentStatus !== "PAID") {
                            return (
                              <div className="text-[11px] font-normal mt-0.5 space-y-0.5">
                                <span className="text-emerald-700 bg-emerald-50 px-1 rounded block">Đã nộp: {formatVND(paid)}</span>
                                <span className="text-amber-800 bg-amber-50 px-1 rounded font-bold block">Còn nợ: {formatVND(remaining)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {statusBadge(bill.paymentStatus)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => printSingleBill(bill.id)}>
                            {bill.paymentStatus === "PAID" ? "In biên nhận" : "In phiếu"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(bill)}>
                            Sửa
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bills.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-gray-400 py-8">
                        <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Chưa có dữ liệu hóa đơn. Bấm &quot;Tải dữ liệu&quot; hoặc &quot;Tạo hóa đơn&quot; để bắt đầu.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-600">
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalRecords)} / {totalRecords} hóa đơn
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBills(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                    >
                      Trước
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBills(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: ĐỐI SOÁT SEPAY ================= */}
        <TabsContent value="transactions" className="space-y-4 pt-2">
          {/* Thống kê SePay */}
          {txStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Tổng tiền nhận SePay</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{formatVND(txStats.totalAmount)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Tổng giao dịch ghi nhận</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{txStats.totalTransactions}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-green-700 font-medium">Đã gạch nợ thành công</p>
                  <p className="text-xl font-bold text-green-600 mt-1">{txStats.matchedCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-amber-700 font-medium">Chưa khớp (Cần gạch tay)</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{txStats.unmatchedCount}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Thanh công cụ và bộ lọc */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Tìm theo nội dung, mã HS, mã GD..."
                      className="pl-8"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchTransactions(1)}
                    />
                  </div>

                  <Select value={txStatusFilter} onValueChange={setTxStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      <SelectItem value="MATCHED">Tự động khớp</SelectItem>
                      <SelectItem value="UNMATCHED">Chưa khớp hóa đơn</SelectItem>
                      <SelectItem value="MANUAL">Đã gạch tay</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="secondary" onClick={() => fetchTransactions(1)} disabled={txLoading}>
                    {txLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tìm kiếm"}
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <Button
                    onClick={() => fetchTransactions(txPage)}
                    disabled={txLoading}
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${txLoading ? "animate-spin" : ""}`} />
                    Làm mới danh sách
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bảng giao dịch SePay */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <span>Lịch sử biến động số dư SePay</span>
                  {txTotalRecords > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {txTotalRecords} giao dịch
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Mọi giao dịch chuyển khoản vào tài khoản trường đều được tự động lưu lại và gạch nợ tức thì.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table wrapperClassName="max-h-[60vh]">
                <TableHeader className="sticky top-0 z-10 bg-white shadow-sm shadow-slate-200">
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Nội dung chuyển khoản</TableHead>
                    <TableHead>Học sinh / Hóa đơn</TableHead>
                    <TableHead>Mã GD SePay</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/80">
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {new Date(tx.transDate).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600 whitespace-nowrap">
                        +{Number(tx.amount).toLocaleString("vi-VN")}đ
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="font-mono text-xs text-slate-700 truncate" title={tx.content}>
                          {tx.content}
                        </p>
                        {tx.unmatchedReason && tx.status === "UNMATCHED" && (
                          <>
                            <p className="text-[11px] text-amber-600 mt-0.5 line-clamp-1 italic">
                              Lý do: {tx.unmatchedReason}
                            </p>
                            {tx.unmatchedReason.toUpperCase().includes('HOÀN TIỀN') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 text-[10px] font-bold mt-1">
                                ⚠️ Cần hoàn tiền cho phụ huynh
                              </span>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.bill?.student ? (
                          <div className="text-xs">
                            <p className="font-medium text-slate-800">
                              {tx.bill.student.user.fullName} ({tx.bill.student.class.name})
                            </p>
                            <p className="text-gray-500">
                              Hóa đơn T{tx.bill.month}/{tx.bill.year} • Mã:{" "}
                              <span className="font-mono text-blue-600">
                                {tx.bill.student.boardingCode || tx.bill.student.studentCode}
                              </span>
                            </p>
                          </div>
                        ) : tx.student ? (
                          <div className="text-xs">
                            <p className="font-medium text-slate-800">
                              {tx.student.user.fullName} ({tx.student.class.name})
                            </p>
                            <p className="text-amber-600">Chưa gắn vào hóa đơn cụ thể</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Chưa xác định học sinh</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 whitespace-nowrap">
                        {tx.sepayTransId || tx.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{txStatusBadge(tx.status, tx.unmatchedReason)}</TableCell>
                      <TableCell className="text-center">
                        {tx.status === "UNMATCHED" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                              onClick={() => openManualMatchModal(tx)}
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Gạch nợ tay
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 h-8 w-8 p-0"
                              title="Xóa giao dịch này"
                              onClick={() => handleDeleteTx(tx.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs h-8 px-2 font-medium shadow-xs"
                              title="Hủy gạch nợ / Hoàn tác hóa đơn học sinh"
                              onClick={() =>
                                handleVoidTransaction(
                                  tx.id,
                                  tx.student?.user?.fullName || tx.bill?.student?.user?.fullName
                                )
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1 text-rose-600" />
                              Hủy gạch nợ
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Chưa có giao dịch SePay nào được ghi nhận. Hệ thống sẽ tự động gạch nợ tức thì khi phụ huynh chuyển khoản.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Phân trang SePay */}
              {txTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-600">
                    Hiển thị {(txPage - 1) * 20 + 1}–{Math.min(txPage * 20, txTotalRecords)} / {txTotalRecords} giao dịch
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(txPage - 1)}
                      disabled={txPage === 1 || txLoading}
                    >
                      Trước
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {txPage} / {txTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(txPage + 1)}
                      disabled={txPage === txTotalPages || txLoading}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </>
    )}
  </Tabs>

  {!isCashier && (
    <>
      {/* ================= MODAL GẠCH NỢ THỦ CÔNG ================= */}
      <Dialog open={!!selectedTxForMatch} onOpenChange={(open) => !open && setSelectedTxForMatch(null)}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[92vh] flex flex-col p-3.5 sm:p-5 overflow-hidden">
          <DialogHeader className="pb-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <UserCheck className="h-5 w-5 text-amber-600 shrink-0" />
              Gạch nợ thủ công SePay
            </DialogTitle>
          </DialogHeader>

          {selectedTxForMatch && (
            <div className="overflow-y-auto space-y-2.5 py-1 pr-1 text-sm flex-1">
              {/* Chi tiết GD gọn gàng */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Giao dịch SePay:</span>
                  <span className="font-extrabold text-green-700 text-sm sm:text-base">{formatVND(selectedTxForMatch.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>{new Date(selectedTxForMatch.transDate).toLocaleString("vi-VN")}</span>
                  {selectedTxForMatch.gateway && (
                    <span className="font-semibold text-slate-700 bg-slate-200/70 px-1.5 py-0.2 rounded text-[10px]">
                      {selectedTxForMatch.gateway}
                    </span>
                  )}
                </div>
                <div className="pt-1 border-t border-slate-200/60 font-mono text-[11px] bg-white px-2 py-1 rounded border break-all text-slate-700 leading-tight">
                  {selectedTxForMatch.content}
                </div>
                {selectedTxForMatch.unmatchedReason && (
                  <p className="text-amber-700 italic text-[11px] leading-tight">
                    ⚠️ {selectedTxForMatch.unmatchedReason}
                  </p>
                )}
              </div>

              {/* Chọn học sinh với ô tìm kiếm gõ trực tiếp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-xs sm:text-sm text-slate-900">1. Chọn học sinh cần gạch nợ:</Label>
                  {selectedStudentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId("");
                        setSelectedBillId("");
                        setStudentUnpaidBills([]);
                        setAutoDetectedStudent(null);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      Đổi học sinh khác
                    </button>
                  )}
                </div>

                {/* Nếu đã chọn học sinh -> Hiện thẻ thông tin học sinh được chọn */}
                {selectedStudentId ? (
                  (() => {
                    const st = matchStudents.find((s) => s.id === selectedStudentId);
                    return (
                      <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg border bg-emerald-50 border-emerald-300">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{st?.user?.fullName || "Học sinh"}</span>
                            <span className="text-xs font-normal text-emerald-800 shrink-0">
                              (Lớp {st?.class?.name || st?.classId})
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-700 flex gap-2 sm:gap-3">
                            <span>Mã BT: <strong className="font-mono font-bold text-emerald-900">{st?.boardingCode || "Chưa có"}</strong></span>
                            {st?.studentCode && <span className="hidden sm:inline">Mã HS: <strong className="font-mono">{st.studentCode}</strong></span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-[10px] shrink-0 py-0">
                          Đã chọn
                        </Badge>
                      </div>
                    );
                  })()
                ) : (
                  /* Nếu chưa chọn -> Hiện ô tìm kiếm và danh sách lọc trực tiếp */
                  <div className="space-y-1.5">
                    {/* Gợi ý tự động nếu phát hiện mã trong nội dung */}
                    {autoDetectedStudent && (
                      <div
                        onClick={() => handleStudentSelectForMatch(autoDetectedStudent.id)}
                        className="p-2 rounded-lg border border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors flex items-center justify-between"
                      >
                        <div className="text-xs text-amber-900">
                          <div className="font-semibold flex items-center gap-1">
                            ✨ Phát hiện mã trong nội dung chuyển khoản:
                          </div>
                          <div>
                            {autoDetectedStudent.user?.fullName} (Lớp {autoDetectedStudent.class?.name || autoDetectedStudent.classId}) — Mã: <span className="font-mono font-bold text-amber-950">{autoDetectedStudent.boardingCode}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="h-6 text-xs bg-white text-amber-800 border-amber-300 hover:bg-amber-200 shrink-0">
                          Chọn ngay
                        </Button>
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="🔍 Gõ tên học sinh, lớp (VD: 10A1) hoặc mã BT..."
                        value={matchSearchTerm}
                        onChange={(e) => setMatchSearchTerm(e.target.value)}
                        className="pl-8 pr-7 h-8 text-xs sm:text-sm"
                        autoFocus
                      />
                      {matchSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setMatchSearchTerm("")}
                          className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Danh sách cuộn kết quả tìm kiếm */}
                    <div className="max-h-40 sm:max-h-48 overflow-y-auto rounded-md border divide-y bg-white shadow-inner">
                      {filteredMatchStudents.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Không tìm thấy học sinh phù hợp với &quot;{matchSearchTerm}&quot;
                        </div>
                      ) : (
                        filteredMatchStudents.slice(0, 50).map((st) => (
                          <div
                            key={st.id}
                            onClick={() => handleStudentSelectForMatch(st.id)}
                            className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold text-slate-900 group-hover:text-blue-700">
                                {st.user?.fullName}
                              </span>
                              <span className="text-slate-500 ml-1 font-normal text-[11px]">
                                ({st.class?.name || st.classId})
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {st.boardingCode && (
                                <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded text-[11px]">
                                  {st.boardingCode}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 px-1">
                      <span>Hiển thị {Math.min(filteredMatchStudents.length, 50)} / {filteredMatchStudents.length} học sinh</span>
                      <span>💡 Gõ tên không dấu hoặc có dấu đều được</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chọn hóa đơn & Hiển thị công nợ chi tiết */}
              {selectedStudentId && (
                <div className="space-y-2 pt-1 border-t">
                  <Label className="font-semibold text-xs sm:text-sm text-slate-900">2. Chọn hóa đơn cần thanh toán:</Label>
                  {studentUnpaidBills.length > 0 ? (
                    <>
                      <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                        <SelectTrigger className="mt-1 h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="-- Chọn hóa đơn --" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentUnpaidBills.map((b) => {
                            const paid = (b.transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                            const remaining = Math.max(0, Number(b.finalAmount) - paid);
                            const statusText = b.paymentStatus === "PAID" ? "Đã thanh toán" : b.paymentStatus === "PARTIAL" ? "Đã nộp 1 phần" : "Chưa thanh toán";
                            return (
                              <SelectItem key={b.id} value={b.id} className="text-xs sm:text-sm">
                                Tháng {b.month}/{b.year} — Còn nợ: {formatVND(remaining)} (Tổng: {formatVND(b.finalAmount)}{paid > 0 ? ` | Đã nộp: ${formatVND(paid)}` : ""}) — {statusText}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {/* Bảng tính chi tiết công nợ hóa đơn đang chọn (Gọn gàng cho Mobile) */}
                      {(() => {
                        const activeBill = studentUnpaidBills.find((b) => b.id === selectedBillId);
                        if (!activeBill) return null;

                        const billTotal = Number(activeBill.finalAmount);
                        const billPaid = (activeBill.transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                        const billRemaining = Math.max(0, billTotal - billPaid);
                        const txAmount = Number(selectedTxForMatch.amount);
                        const willComplete = txAmount >= billRemaining;

                        return (
                          <div className="rounded-lg border bg-slate-50/90 p-2.5 text-xs space-y-2 border-slate-200">
                            <div className="flex justify-between items-center border-b pb-1">
                              <span className="font-semibold text-slate-800 text-[11px]">Công nợ Tháng {activeBill.month}/{activeBill.year}:</span>
                              {activeBill.paymentStatus === "PARTIAL" ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] py-0">Đã nộp 1 phần</Badge>
                              ) : activeBill.paymentStatus === "PAID" ? (
                                <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px] py-0">Đã thanh toán</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] py-0">Chưa thanh toán</Badge>
                              )}
                            </div>

                            {/* Khối 3 cột trực quan */}
                            <div className="grid grid-cols-3 gap-1 py-1 text-center bg-white rounded border border-slate-100 p-1.5 shadow-2xs">
                              <div>
                                <div className="text-[10px] text-slate-500">Tổng hóa đơn</div>
                                <div className="font-semibold text-slate-800 text-xs sm:text-sm">{formatVND(billTotal)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-emerald-600">Đã nộp</div>
                                <div className="font-semibold text-emerald-700 text-xs sm:text-sm">{formatVND(billPaid)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-red-500 font-medium">Còn nợ</div>
                                <div className="font-bold text-red-600 text-xs sm:text-sm">{formatVND(billRemaining)}</div>
                              </div>
                            </div>

                            {/* Kết quả giao dịch */}
                            <div className={`p-2 rounded border ${willComplete ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-blue-50 border-blue-300 text-blue-900"}`}>
                              <div className="flex justify-between items-center font-bold text-xs">
                                <span>Giao dịch này gạch nợ:</span>
                                <span className="text-sm font-extrabold">{formatVND(txAmount)}</span>
                              </div>
                              <div className="text-[11px] mt-1 pt-1 border-t border-emerald-200/60 flex items-center gap-1">
                                {willComplete ? (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <span>🎉 <strong>Đủ tiền!</strong> Hóa đơn sẽ cập nhật sang <strong>ĐÃ THANH TOÁN (PAID)</strong>.</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    <span>Vẫn còn nợ: <strong>{formatVND(billRemaining - txAmount)}</strong> (Tiếp tục Thanh toán 1 phần).</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      Học sinh này chưa có hóa đơn nào. Vui lòng tạo hóa đơn trước.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 border-t mt-1 flex flex-row justify-end gap-2 shrink-0 bg-white">
            <Button variant="outline" size="sm" onClick={() => setSelectedTxForMatch(null)} className="h-9 px-4">
              Hủy
            </Button>
            <Button
              onClick={executeManualMatch}
              disabled={matchingInProgress || !selectedBillId}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 font-semibold"
            >
              {matchingInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
              Xác nhận Gạch nợ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL SỬA HÓA ĐƠN ================= */}
      {editingBill && (
        <Dialog open={!!editingBill} onOpenChange={() => setEditingBill(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa hóa đơn: {editingBill.student.user.fullName}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Số ngày ăn</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.scheduleMealDays}
                  onChange={(e) => setEditForm({ ...editForm, scheduleMealDays: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Số ngày cắt</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.canceledDays}
                  onChange={(e) => setEditForm({ ...editForm, canceledDays: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Đơn giá</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm({ ...editForm, unitPrice: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Trừ T.trước (đ)</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.previousDeduction}
                  onChange={(e) => setEditForm({ ...editForm, previousDeduction: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Trường hủy (n)</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.scheduleReducedDays}
                  onChange={(e) => setEditForm({ ...editForm, scheduleReducedDays: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Ăn thêm (ngày)</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.extraMealDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 0;
                    setEditForm({
                      ...editForm,
                      extraMealDays: days,
                      previousAddition: days * editForm.unitPrice,
                    });
                  }}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Cộng thêm (đ)</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.previousAddition}
                  onChange={(e) => setEditForm({ ...editForm, previousAddition: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Trạng thái</Label>
                <Select
                  value={editForm.paymentStatus}
                  onValueChange={(val) => setEditForm({ ...editForm, paymentStatus: val })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">Chưa thanh toán</SelectItem>
                    <SelectItem value="PARTIAL">Thanh toán 1 phần</SelectItem>
                    <SelectItem value="PAID">Đã thanh toán</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBill(null)}>
                Hủy
              </Button>
              <Button onClick={saveEditBill} disabled={savingEdit}>
                {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL TẢI PDF THEO LỚP ================= */}
      <Dialog open={openPdfZipModal} onOpenChange={setOpenPdfZipModal}>
        <DialogContent className="w-[96vw] max-w-md p-4 sm:p-6">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <FileDown className="h-5 w-5 text-emerald-600 shrink-0" />
              Tải / Xuất Phiếu Thu PDF
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs sm:text-sm">
            {/* Chọn hình thức xuất */}
            <div>
              <Label className="text-xs font-semibold">Hình thức xuất PDF:</Label>
              <Select
                value={pdfExportMode}
                onValueChange={(val: "SEPARATE_ZIP" | "CLASS_MERGED" | "ALL_IN_ONE") => setPdfExportMode(val)}
              >
                <SelectTrigger className="mt-1 h-9 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEPARATE_ZIP">
                    📦 Tải PDF theo lớp (Logic hiện tại - Từng học sinh 1 file trong ZIP)
                  </SelectItem>
                  <SelectItem value="CLASS_MERGED">
                    📑 Tải PDF theo lớp (Gộp tất cả bill của lớp trong 1 file PDF)
                  </SelectItem>
                  <SelectItem value="ALL_IN_ONE">
                    📚 Gộp chung tất cả phiếu trong 1 file (Không phân lớp)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tháng:</Label>
                <Select value={String(pdfZipMonth)} onValueChange={(val) => setPdfZipMonth(Number(val))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        Tháng {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Năm:</Label>
                <Select value={String(pdfZipYear)} onValueChange={(val) => setPdfZipYear(Number(val))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
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

            <div>
              <Label className="text-xs font-semibold">Phạm vi xuất theo lớp:</Label>
              <Select value={pdfZipClassId} onValueChange={setPdfZipClassId}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">🌟 Tất cả các lớp (Toàn trường - {classes.length} lớp)</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Lớp {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Lọc trạng thái hóa đơn:</Label>
              <Select value={pdfZipStatus} onValueChange={setPdfZipStatus}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả học sinh có hóa đơn</SelectItem>
                  <SelectItem value="DEBT">Chỉ học sinh còn nợ (Chưa TT & Nộp 1 phần)</SelectItem>
                  <SelectItem value="UNPAID">Chỉ học sinh Chưa thanh toán</SelectItem>
                  <SelectItem value="PAID">Chỉ học sinh Đã thanh toán</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Khung mô tả cấu trúc file & thư mục */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <span>📁 Cấu trúc file xuất tải về:</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border space-y-1 leading-relaxed">
                {pdfExportMode === "SEPARATE_ZIP" && (
                  <>
                    <p className="text-emerald-800 font-bold">
                      📦 Phieu_Tien_An_{pdfZipClassId !== "ALL" ? `Lop_${(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}_` : 'Toan_Truong_'}T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.zip
                    </p>
                    <p className="pl-3 text-blue-700">├── 📁 Lop_{(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}/</p>
                    <p className="pl-6 text-slate-600">├── 📄 {(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}_Nguyen_Van_A_Thang_{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}_BT00863.pdf</p>
                    <p className="pl-6 text-slate-600">└── 📄 {(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}_Tran_Thi_B_Thang_{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}_BT00864.pdf</p>
                  </>
                )}
                {pdfExportMode === "CLASS_MERGED" && (
                  pdfZipClassId !== "ALL" ? (
                    <>
                      <p className="text-blue-800 font-bold">
                        📄 Phieu_Tien_An_Lop_{(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}_T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.pdf
                      </p>
                      <p className="text-slate-600 pl-3">
                        * 1 file PDF duy nhất gồm tất cả học sinh lớp {classes.find(c => c.id === pdfZipClassId)?.name || '10A1'} (mỗi học sinh 1 trang khổ A5).
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-emerald-800 font-bold">
                        📦 Phieu_Tien_An_Theo_Lop_Gop_T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.zip
                      </p>
                      <p className="pl-3 text-blue-700">├── 📄 Phieu_Tien_An_Lop_10A1_T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.pdf (tất cả HS lớp 10A1)</p>
                      <p className="pl-3 text-blue-700">├── 📄 Phieu_Tien_An_Lop_10A2_T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.pdf (tất cả HS lớp 10A2)</p>
                      <p className="pl-3 text-slate-500">└── ... (các lớp khác)</p>
                    </>
                  )
                )}
                {pdfExportMode === "ALL_IN_ONE" && (
                  <>
                    <p className="text-purple-800 font-bold">
                      📄 Phieu_Tien_An{pdfZipClassId !== "ALL" ? `_Lop_${(classes.find(c => c.id === pdfZipClassId)?.name || '10A1').replace(/\s+/g, '_')}` : '_Toan_Truong'}_Gop_Chung_T{String(pdfZipMonth).padStart(2, '0')}_{pdfZipYear}.pdf
                    </p>
                    <p className="text-slate-600 pl-3">
                      * 1 file PDF duy nhất chứa toàn bộ học sinh được nối tiếp nhau theo thứ tự từng lớp.
                    </p>
                    <p className="text-emerald-600 pl-3 italic">
                      * Rất tiện lợi để mở lên và ấn In toàn bộ trên máy in văn phòng.
                    </p>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500 italic">
                {pdfExportMode === "SEPARATE_ZIP"
                  ? "* Cấu trúc tên file: Lop_ho_tên_thang_năm_Mã ban trú.pdf"
                  : pdfExportMode === "CLASS_MERGED"
                  ? "* Mỗi lớp là 1 file PDF riêng biệt gồm tất cả học sinh của lớp đó."
                  : "* Toàn bộ học sinh xuất chung trong đúng 1 file PDF duy nhất."}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t mt-1 flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenPdfZipModal(false)} disabled={downloadingPdfZip}>
              Hủy
            </Button>
            <Button
              onClick={handleDownloadPdfZip}
              disabled={downloadingPdfZip}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {downloadingPdfZip ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Đang xử lý & tải về...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-1.5" />
                  {pdfExportMode === "SEPARATE_ZIP" || (pdfExportMode === "CLASS_MERGED" && pdfZipClassId === "ALL")
                    ? "Bắt đầu Tải về (ZIP)"
                    : "Bắt đầu Tải về (PDF)"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cấu hình & In thông báo phát hành phiếu thanh toán (Chỉ học sinh còn nợ) */}
      <Dialog open={openDebtModal} onOpenChange={setOpenDebtModal}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900 border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <BellRing className="h-5 w-5 text-amber-600" />
              In thông báo phát hành phiếu thanh toán
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chỉ in những học sinh còn công nợ chưa thanh toán đủ trong tháng. Học sinh đã thanh toán sẽ tự động được bỏ qua.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Tháng / Năm */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tháng thu tiền</Label>
                <Select value={String(debtMonth)} onValueChange={(val) => setDebtMonth(Number(val))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        Tháng {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Năm học</Label>
                <Select value={String(debtYear)} onValueChange={(val) => setDebtYear(Number(val))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
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

            {/* Chọn Lớp */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phạm vi in theo lớp</Label>
              <Select value={debtClassId} onValueChange={setDebtClassId}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="ALL" className="font-semibold text-blue-700">
                    🏢 Toàn trường (Tất cả học sinh còn nợ các lớp)
                  </SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Lớp {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chọn Định dạng khổ in */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Định dạng khổ in & Ghép trang</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDebtLayout("A5_LANDSCAPE_2UP")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    debtLayout === "A5_LANDSCAPE_2UP"
                      ? "border-amber-500 bg-amber-50/70 text-amber-950 font-medium ring-1 ring-amber-500"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-bold block text-sm mb-0.5">📄 Khổ A5 ngang (2 phiếu A6)</span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Ghép 2 phiếu A6 trên 1 trang A5 ngang (2-up), có đường nét đứt cắt đôi ở giữa.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDebtLayout("A4_PORTRAIT_4UP")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    debtLayout === "A4_PORTRAIT_4UP"
                      ? "border-amber-500 bg-amber-50/70 text-amber-950 font-medium ring-1 ring-amber-500"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-bold block text-sm mb-0.5">📑 Khổ A4 dọc (4 phiếu A6)</span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Sắp sẵn 4 phiếu A6 trên 1 trang A4 dọc (4-up: 2x2), có đường kẻ nét đứt cắt làm 4.
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 text-amber-950">
                <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Nguyên tắc in ấn bảo mật:
              </p>
              <p className="mt-0.5 text-[11.5px]">
                • Phiếu <b>không ghi số tiền nợ</b> để đảm bảo tính tế nhị.<br/>
                • Tự động sinh mã QR và hướng dẫn chi tiết phụ huynh đăng nhập vào app kiểm tra và thanh toán.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenDebtModal(false)} disabled={loadingDebtBills}>
              Hủy
            </Button>
            <Button
              onClick={handleStartDebtPrint}
              disabled={loadingDebtBills}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {loadingDebtBills ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang lọc công nợ...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Xem trước & In thông báo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Giao diện xem trước & In ấn thông báo nợ */}
      {debtPrintBills && (
        <DebtNotificationPrint
          bills={debtPrintBills}
          schoolName={settings.SCHOOL_NAME}
          month={debtMonth}
          year={debtYear}
          className={debtClassId !== "ALL" ? classes.find((c) => c.id === debtClassId)?.name : undefined}
          defaultLayout={debtLayout}
          onClose={() => setDebtPrintBills(null)}
        />
      )}
      <div
        className="absolute -z-50 opacity-0 print:static print:z-auto print:opacity-100 print:w-full print:m-0 print:p-0 print-bw"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            @page {
              size: A5 portrait;
              margin: 6mm;
            }
            .print-bw, .print-bw * {
              color: #000 !important;
              border-color: #000 !important;
              background-color: transparent !important;
            }
          }
        `,
          }}
        />
        {bills
          .filter((b) => printBillId === "ALL" || b.id === printBillId)
          .map((bill, idx, arr) => {
            const isPaid = bill.paymentStatus === "PAID";
            const paid = (bill.transactions || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
            const actualPaid = isPaid ? Number(bill.finalAmount) : paid;
            const remaining = isPaid ? 0 : Math.max(0, Number(bill.finalAmount) - actualPaid);
            const isPartial = !isPaid && actualPaid > 0 && remaining > 0;

            return (
              <div
                key={bill.id}
                className={`w-full max-w-[148mm] mx-auto p-4 print:p-0 flex flex-col ${idx < arr.length - 1 ? "print-break" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="pr-2">
                    <h1 className="text-[15px] font-bold uppercase leading-tight">
                      {settings.SCHOOL_NAME || "TRƯỜNG TIỂU HỌC BAN TRÚ"}
                    </h1>
                    {settings.SCHOOL_ADDRESS && <p className="text-[11px] mt-1">{settings.SCHOOL_ADDRESS}</p>}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <Barcode
                      value={`PT${bill.month}${bill.year}${bill.student.boardingCode || bill.student.studentCode}`}
                      height={30}
                      width={1.2}
                      fontSize={10}
                      margin={0}
                      displayValue={true}
                    />
                  </div>
                </div>

                <div className="border-t-[1.5px] border-black my-1"></div>

                <div className="text-center mb-1">
                  <div className="flex items-center justify-center gap-3">
                    <h2 className="text-[16px] font-bold mb-0.5">
                      {isPaid
                        ? "BIÊN NHẬN THU TIỀN ĂN BÁN TRÚ"
                        : isPartial
                        ? "PHIẾU BÁO TIỀN ĂN (CÒN NỢ)"
                        : "PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ"}
                    </h2>
                    {isPaid && (
                      <span className="border-2 border-black px-2 py-0.5 text-[11px] font-bold tracking-wider">
                        ĐÃ THANH TOÁN
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] italic">
                    Tháng {bill.month} / {bill.year}
                  </p>
                </div>

                <div className="border-t-[1.5px] border-black my-1"></div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[12px] mb-1 leading-relaxed">
                  <div className="space-y-1">
                    <p className="flex">
                      <span className="font-bold w-20 shrink-0">Mã Bán Trú:</span>{" "}
                      <span>{bill.student.boardingCode || "Chưa cấp"}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold w-20 shrink-0">Họ tên:</span>{" "}
                      <span>{bill.student.user.fullName}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold w-20 shrink-0">Lớp:</span>{" "}
                      <span>{bill.student.class.name}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold w-20 shrink-0">Loại suất:</span>{" "}
                      <span>
                        {bill.student.mealType === "MAN"
                          ? "Mặn"
                          : bill.student.mealType === "CHAY"
                          ? "Chay"
                          : "Cháo"}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="flex">
                      <span className="font-bold w-36 shrink-0">Số ngày ăn dự kiến:</span>{" "}
                      <span>{bill.scheduleMealDays} ngày</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold w-36 shrink-0">Số ngày cắt suất:</span>{" "}
                      <span>
                        {bill.canceledDays} ngày
                        {(bill.scheduleReducedDays ?? 0) > 0 && (
                          <span className="text-[11px] text-gray-600 ml-1">
                            (gồm {bill.canceledDays - (bill.scheduleReducedDays ?? 0)} cắt + {bill.scheduleReducedDays} trường hủy)
                          </span>
                        )}
                      </span>
                    </p>
                    <div className="flex">
                      <span className="font-bold w-36 shrink-0">Trừ tiền tháng trước:</span>
                      <div className="flex flex-col">
                        {parseInt(bill.previousDeduction || "0") > 0 ? (
                          <>
                            <span className="font-semibold text-rose-600">-{formatVND(bill.previousDeduction)}</span>
                            <span className="text-[11px] italic text-gray-700">
                              (Khấu trừ của tháng {bill.month === 1 ? 12 : bill.month - 1}/
                              {bill.month === 1 ? bill.year - 1 : bill.year})
                            </span>
                          </>
                        ) : (
                          <span>
                            {bill.month === 9 ? "0đ (Đầu năm học)" : "0đ"}
                          </span>
                        )}
                      </div>
                    </div>
                    {(parseInt(bill.previousAddition || "0") > 0 || (bill.extraMealDays ?? 0) > 0) && (
                      <div className="flex">
                        <span className="font-bold w-36 shrink-0">Ăn thêm tháng trước:</span>
                        <div className="flex flex-col">
                          <span className="text-emerald-700 font-bold">+{formatVND(bill.previousAddition || 0)}</span>
                          <span className="text-[11px] italic text-gray-700">
                            (Lịch TKB phát sinh {bill.extraMealDays} ngày tháng {bill.month === 1 ? 12 : bill.month - 1}/
                            {bill.month === 1 ? bill.year - 1 : bill.year})
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="flex">
                      <span className="font-bold w-36 shrink-0">Đơn giá:</span>{" "}
                      <span>{formatVND(bill.unitPrice)}/suất</span>
                    </p>
                  </div>
                </div>

                <div className="border-t-[1.5px] border-black my-1"></div>

                {bill.student.mealCancellations && bill.student.mealCancellations.length > 0 ? (
                  <div className="mb-1 text-[11px] border border-black p-1 rounded-sm print:rounded-none">
                    <p className="font-bold mb-0.5">Chi tiết các ngày đã duyệt cắt suất:</p>
                    <div className="flex flex-wrap gap-1">
                      {bill.student.mealCancellations.map((c, i) => (
                        <span key={i} className="px-1 py-0.5 border border-black rounded-sm print:rounded-none">
                          {new Date(c.cancelDate).toLocaleDateString("vi-VN")}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-1"></div>
                )}

                <div className="border-[1.5px] border-black py-1.5 my-1 text-center bg-gray-50/50 print:bg-transparent">
                  {isPaid ? (
                    <>
                      <p className="text-[16px] font-bold mb-0">
                        SỐ TIỀN ĐÃ THANH TOÁN: {formatVND(bill.finalAmount)}
                      </p>
                      <p className="text-[11px] italic">
                        (Bằng chữ: {numberToVietnameseWords(Number(bill.finalAmount))})
                      </p>
                      <p className="text-[12px] font-bold text-black mt-0.5">
                        SỐ TIỀN CÒN NỢ: 0đ (ĐÃ NỘP ĐỦ)
                      </p>
                    </>
                  ) : isPartial ? (
                    <>
                      <p className="text-[12px] text-gray-700 mb-0.5">
                        Tổng hóa đơn: {formatVND(bill.finalAmount)} | Đã nộp: {formatVND(actualPaid)}
                      </p>
                      <p className="text-[16px] font-bold mb-0">
                        SỐ TIỀN CÒN NỢ CẦN NỘP: {formatVND(remaining)}
                      </p>
                      <p className="text-[11px] italic">
                        (Bằng chữ: {numberToVietnameseWords(remaining)})
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[16px] font-bold mb-0">
                        SỐ TIỀN CẦN NỘP: {formatVND(bill.finalAmount)}
                      </p>
                      <p className="text-[11px] italic">
                        (Bằng chữ: {numberToVietnameseWords(Number(bill.finalAmount))})
                      </p>
                    </>
                  )}
                </div>

                {isPaid ? (
                  <div className="mt-1 pt-2 pb-2 border-2 border-dashed border-black p-2 text-center rounded-sm print:rounded-none">
                    <p className="text-[14px] font-bold uppercase mb-1">
                      XÁC NHẬN ĐÃ HOÀN TẤT THANH TOÁN TIỀN ĂN
                    </p>
                    <p className="text-[12px]">
                      Học sinh <b>{bill.student.user.fullName}</b> ({bill.student.boardingCode || bill.student.studentCode}) đã nộp đủ tiền ăn bán trú Tháng {bill.month}/{bill.year}.
                    </p>
                    <p className="text-[11px] italic mt-1">
                      Biên nhận này xác nhận học sinh đã hoàn tất nộp tiền. Chân thành cảm ơn Quý Phụ huynh và Học sinh!
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 pt-1.5 border-2 border-dashed border-black p-1.5 flex items-center shrink-0 rounded-sm print:rounded-none">
                    {bill.qrCodeUrl && (
                      <div className="shrink-0 mr-3 border border-black p-1">
                        <img
                          src={bill.qrCodeUrl}
                          alt={`QR thanh toán ${bill.student.boardingCode || bill.student.studentCode}`}
                          className="w-[115px] h-[115px] object-contain"
                          loading="eager"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-[14px] font-bold mb-1 uppercase">1. Quét mã QR để thanh toán (Khuyến khích)</p>
                      <p className="text-[11px] mb-2">
                        2. Nếu không quét được QR, vui lòng chuyển khoản thủ công và <b>BẮT BUỘC</b> nhập đúng nội dung sau:
                      </p>
                      <span className="font-bold text-[15px] inline-block px-3 py-1.5 border-[2px] border-black bg-gray-100 print:bg-transparent">
                        BSTLM {bill.student.boardingCode || bill.student.studentCode} T{String(bill.month).padStart(2, '0')}{String(bill.year).slice(-2)}
                      </span>
                      <p className="text-[11px] italic mt-1.5">
                        Hệ thống tự động gạch nợ sau 1-3 giây khi nhận được tiền.
                      </p>
                    </div>
                  </div>
                )}

                {/* Chữ ký chân trang */}
                <div className="grid grid-cols-2 text-center text-[11px] mt-4 pt-1">
                  <div>
                    <div className="font-bold">Người nộp tiền</div>
                    <div className="text-[10px] italic text-gray-500">(Ký, họ tên)</div>
                  </div>
                  <div>
                    <div className="font-bold">Người lập phiếu (Thu ngân)</div>
                    <div className="text-[10px] italic text-gray-500">(Ký, họ tên)</div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  )}
</div>
);
}
