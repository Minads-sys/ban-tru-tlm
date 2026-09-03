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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Receipt,
  Printer,
  FileDown,
  Loader2,
  Calculator,
  CreditCard,
  Layers,
  Settings,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Copy,
  Send,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

interface BillData {
  id: string;
  studentId: string;
  month: number;
  year: number;
  scheduleMealDays: number;
  canceledDays: number;
  netPayableDays: number;
  unitPrice: string;
  totalAmount: string;
  previousDeduction: string;
  finalAmount: string;
  paymentStatus: string;
  qrCodeUrl: string | null;
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
    unitPrice: 0,
    previousDeduction: 0,
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

  // ================= TAB 3: SANDBOX TEST STATE =================
  const [testCode, setTestCode] = useState("BT00001");
  const [testMonth, setTestMonth] = useState(new Date().getMonth() + 1);
  const [testAmount, setTestAmount] = useState(700000);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
    if (activeTab === "bills") {
      fetchBills(currentPage);
    } else if (activeTab === "transactions") {
      fetchTransactions(txPage);
    }
  }, [activeTab, fetchBills, fetchTransactions, currentPage, txPage]);

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

  // Test Webhook Simulation
  const handleSimulateWebhook = async () => {
    setTestingWebhook(true);
    try {
      const simulatedPayload = {
        id: Math.floor(Math.random() * 900000) + 100000,
        gateway: "BIDV",
        transactionDate: new Date().toISOString(),
        accountNumber: settings.BANK_ACCOUNT_NO || "96247BANTRUTLM08",
        transferType: "in",
        transferAmount: testAmount,
        content: `BSTLM ${testCode.trim()} T${String(testMonth).padStart(2, "0")}${String(year).slice(-2)}`,
        description: `Chuyen khoan test BSTLM ${testCode.trim()} T${String(testMonth).padStart(2, "0")}${String(year).slice(-2)}`,
      };

      const res = await fetch("/api/sepay/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulatedPayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.matched) {
          Swal.fire({
            title: "Gạch nợ tự động thành công!",
            html: `
              <div class="text-left text-sm space-y-1">
                <p><b>Học sinh:</b> ${data.studentName} (${testCode})</p>
                <p><b>Hóa đơn:</b> Tháng ${data.month}/${data.year}</p>
                <p><b>Số tiền:</b> ${new Intl.NumberFormat("vi-VN").format(data.amount)}đ</p>
                <p><b>Tổng đã đóng:</b> ${new Intl.NumberFormat("vi-VN").format(data.totalPaid)} / ${new Intl.NumberFormat("vi-VN").format(data.finalAmount)}đ</p>
                <p><b>Trạng thái:</b> <span class="text-green-600 font-bold">${data.paymentStatus}</span></p>
              </div>
            `,
            icon: "success",
          });
        } else {
          Swal.fire({
            title: "Webhook đã nhận (Chưa khớp)",
            html: `
              <div class="text-left text-sm space-y-1">
                <p><b>Thông báo:</b> ${data.message}</p>
                <p class="text-xs text-gray-500">Giao dịch đã được lưu vào danh sách chờ đối soát thủ công.</p>
              </div>
            `,
            icon: "warning",
          });
        }
        fetchBills(currentPage);
        fetchTransactions(1);
      } else {
        Swal.fire("Lỗi xử lý", data.error || data.message || "Lỗi webhook", "error");
      }
    } catch (e) {
      Swal.fire("Lỗi", "Lỗi gửi webhook thử nghiệm", "error");
    } finally {
      setTestingWebhook(false);
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

  const openEditModal = (bill: BillData) => {
    setEditingBill(bill);
    setEditForm({
      scheduleMealDays: bill.scheduleMealDays,
      canceledDays: bill.canceledDays,
      unitPrice: parseInt(bill.unitPrice),
      previousDeduction: parseInt(bill.previousDeduction),
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

  const txStatusBadge = (status: string) => {
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
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-300 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Chưa khớp
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const webhookFullUrl = typeof window !== "undefined" ? `${window.location.origin}/api/sepay/webhook` : "/api/sepay/webhook";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Receipt className="h-7 w-7 text-blue-600" />
            Hóa đơn & Thanh toán Tự gạch nợ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tạo hóa đơn, in phiếu thu A5, tự động gạch nợ qua SePay (VietQR) và đối soát ngân hàng
          </p>
        </div>

        {/* Cụm thông tin tài khoản BIDV */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 px-4 flex items-center gap-3 text-xs text-blue-900">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            BIDV
          </div>
          <div>
            <p className="font-semibold text-[13px]">STK: {settings.BANK_ACCOUNT_NO || "96247BANTRUTLM08"}</p>
            <p className="text-slate-600">Chủ TK: {settings.BANK_ACCOUNT_NAME || "HOANG KIM"} (SePay)</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="no-print">
        <TabsList className="grid grid-cols-3 max-w-xl">
          <TabsTrigger value="bills" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Hóa đơn học sinh
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Đối soát SePay
            {txStats && txStats.unmatchedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white rounded-full font-bold">
                {txStats.unmatchedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Cấu hình & Test
          </TabsTrigger>
        </TabsList>

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
                variant="default"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
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
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}
              Tạo tất cả ({classes.length} lớp)
            </Button>

            <Button onClick={printBills} variant="outline" disabled={bills.length === 0}>
              <Printer className="h-4 w-4 mr-2" />
              In phiếu trang hiện tại
            </Button>
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
                    <TableHead>STT</TableHead>
                    <TableHead>Mã Bán Trú</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-center">Ngày ăn</TableHead>
                    <TableHead className="text-center">Ngày cắt</TableHead>
                    <TableHead className="text-right">Trừ T.trước</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill, idx) => (
                    <TableRow key={bill.id}>
                      <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">
                        {bill.student.boardingCode || bill.student.studentCode}
                      </TableCell>
                      <TableCell>{bill.student.user.fullName}</TableCell>
                      <TableCell>{bill.student.class.name}</TableCell>
                      <TableCell className="text-center">{bill.netPayableDays}</TableCell>
                      <TableCell className="text-center">{bill.canceledDays}</TableCell>
                      <TableCell className="text-right">{formatVND(bill.previousDeduction)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatVND(bill.finalAmount)}</TableCell>
                      <TableCell>{statusBadge(bill.paymentStatus)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => printSingleBill(bill.id)}>
                            In phiếu
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
                      <TableCell colSpan={10} className="text-center text-gray-400 py-8">
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
                    onClick={handleSyncSepay}
                    disabled={isSyncing}
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Đồng bộ từ SePay
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bảng giao dịch SePay */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Lịch sử biến động số dư SePay
                {txTotalRecords > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {txTotalRecords} giao dịch
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Mọi giao dịch chuyển khoản vào tài khoản trường đều được tự động lưu lại và gạch nợ tức thì.
              </CardDescription>
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
                    <TableRow key={tx.id} className={tx.status === "UNMATCHED" ? "bg-amber-50/40" : ""}>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                        {new Date(tx.transDate).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="font-bold text-green-700 whitespace-nowrap">
                        +{formatVND(tx.amount)}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="text-xs font-mono break-words">{tx.content}</p>
                        {tx.unmatchedReason && (
                          <p className="text-[11px] text-amber-700 italic mt-0.5">
                            Lý do: {tx.unmatchedReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.bill ? (
                          <div className="text-xs">
                            <p className="font-medium text-slate-800">
                              {tx.bill.student.user.fullName} ({tx.bill.student.class.name})
                            </p>
                            <p className="text-slate-500">
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
                      <TableCell>{txStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-center">
                        {tx.status === "UNMATCHED" ? (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                            onClick={() => openManualMatchModal(tx)}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Gạch nợ tay
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-gray-400 border-gray-200">
                            Đã hoàn tất
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Chưa có giao dịch SePay nào được ghi nhận. Bấm &quot;Đồng bộ từ SePay&quot; để tải giao dịch.
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

        {/* ================= TAB 3: CẤU HÌNH & TEST ================= */}
        <TabsContent value="config" className="space-y-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card thông tin Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <ArrowUpRight className="h-5 w-5 text-blue-600" />
                  Thông tin Webhook SePay
                </CardTitle>
                <CardDescription>
                  Sao chép URL này và dán vào mục <b>Webhook</b> trên trang quản trị SePay (my.sepay.vn).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase">Webhook Endpoint URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input readOnly value={webhookFullUrl} className="font-mono text-xs bg-slate-50" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookFullUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                    >
                      {copiedUrl ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Phương thức: <b>POST</b> • Định dạng: <b>JSON</b>
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs space-y-2 text-blue-900">
                  <p className="font-semibold flex items-center gap-1">
                    <HelpCircle className="h-4 w-4 text-blue-600" /> Cú pháp nội dung chuyển khoản hợp lệ:
                  </p>
                  <div className="font-mono bg-white p-2 rounded border border-blue-200 text-blue-800 text-center font-bold text-sm">
                    BSTLM [Mã Bán Trú] T[MM][YY]
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Ví dụ: <code className="font-bold">BSTLM BT00001 T0926</code> hoặc <code className="font-bold">BSTLM HS24001 T0926</code>.
                    Hệ thống tự động nhận diện cả tháng và năm (09 = Tháng 9, 26 = Năm 2026), loại bỏ hoàn toàn nguy cơ nhầm lẫn giữa các niên khóa.
                  </p>
                </div>

                <div className="pt-2 border-t text-xs text-slate-600 space-y-1">
                  <p><b>Ngân hàng liên kết:</b> BIDV</p>
                  <p><b>Số tài khoản:</b> {settings.BANK_ACCOUNT_NO || "96247BANTRUTLM08"}</p>
                  <p><b>Chủ tài khoản:</b> {settings.BANK_ACCOUNT_NAME || "HOANG KIM"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Card Giả lập Test Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Send className="h-5 w-5 text-green-600" />
                  Giả lập Gạch nợ Webhook (Sandbox)
                </CardTitle>
                <CardDescription>
                  Gửi dữ liệu thanh toán mô phỏng từ SePay để kiểm tra luồng tự gạch nợ ngay lập tức mà không cần chuyển tiền thật.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mã học sinh / Bán trú</Label>
                    <Input
                      placeholder="VD: BT00001"
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Tháng thanh toán</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={testMonth}
                      onChange={(e) => setTestMonth(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Số tiền chuyển khoản (VNĐ)</Label>
                  <Input
                    type="number"
                    step={10000}
                    value={testAmount}
                    onChange={(e) => setTestAmount(parseInt(e.target.value))}
                  />
                </div>

                <div className="p-2.5 bg-slate-100 rounded text-xs">
                  <span className="text-gray-500">Nội dung giả lập: </span>
                  <span className="font-mono font-bold text-blue-700">
                    BSTLM {testCode.trim().toUpperCase()} T{String(testMonth).padStart(2, "0")}{String(year).slice(-2)}
                  </span>
                </div>

                <Button
                  onClick={handleSimulateWebhook}
                  disabled={testingWebhook || !testCode.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {testingWebhook ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Gửi Webhook Thử Nghiệm
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL GẠCH NỢ THỦ CÔNG ================= */}
      <Dialog open={!!selectedTxForMatch} onOpenChange={(open) => !open && setSelectedTxForMatch(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-600" />
              Gạch nợ thủ công giao dịch SePay
            </DialogTitle>
          </DialogHeader>

          {selectedTxForMatch && (
            <div className="space-y-4 py-2 text-sm">
              {/* Chi tiết GD */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <p>
                  <span className="font-medium text-slate-500">Số tiền:</span>{" "}
                  <span className="font-bold text-green-700 text-sm">{formatVND(selectedTxForMatch.amount)}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-500">Nội dung:</span>{" "}
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border">{selectedTxForMatch.content}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-500">Thời gian:</span>{" "}
                  {new Date(selectedTxForMatch.transDate).toLocaleString("vi-VN")}
                </p>
                {selectedTxForMatch.unmatchedReason && (
                  <p className="text-amber-700 italic">
                    Lý do chưa khớp: {selectedTxForMatch.unmatchedReason}
                  </p>
                )}
              </div>

              {/* Chọn học sinh với ô tìm kiếm gõ trực tiếp */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-slate-900">1. Chọn học sinh cần gạch nợ:</Label>
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
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-50 border-emerald-300">
                        <div className="space-y-0.5">
                          <div className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                            {st?.user?.fullName || "Học sinh"}
                            <span className="text-xs font-normal text-emerald-800">
                              (Lớp {st?.class?.name || st?.classId})
                            </span>
                          </div>
                          <div className="text-xs text-emerald-700 flex gap-3">
                            <span>Mã bán trú: <strong className="font-mono">{st?.boardingCode || "Chưa có"}</strong></span>
                            {st?.studentCode && <span>Mã HS: <strong className="font-mono">{st.studentCode}</strong></span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300">
                          Đã chọn
                        </Badge>
                      </div>
                    );
                  })()
                ) : (
                  /* Nếu chưa chọn -> Hiện ô tìm kiếm và danh sách lọc trực tiếp */
                  <div className="space-y-2">
                    {/* Gợi ý tự động nếu phát hiện mã trong nội dung */}
                    {autoDetectedStudent && (
                      <div
                        onClick={() => handleStudentSelectForMatch(autoDetectedStudent.id)}
                        className="p-2.5 rounded-lg border border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors flex items-center justify-between"
                      >
                        <div className="text-xs text-amber-900">
                          <div className="font-semibold flex items-center gap-1">
                            ✨ Phát hiện mã trong nội dung chuyển khoản:
                          </div>
                          <div>
                            {autoDetectedStudent.user?.fullName} (Lớp {autoDetectedStudent.class?.name || autoDetectedStudent.classId}) — Mã: <span className="font-mono font-bold text-amber-950">{autoDetectedStudent.boardingCode}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-amber-800 border-amber-300 hover:bg-amber-200">
                          Chọn ngay
                        </Button>
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="🔍 Gõ tên học sinh, lớp (VD: 10A1) hoặc mã BT..."
                        value={matchSearchTerm}
                        onChange={(e) => setMatchSearchTerm(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                        autoFocus
                      />
                      {matchSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setMatchSearchTerm("")}
                          className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Danh sách cuộn kết quả tìm kiếm */}
                    <div className="max-h-48 overflow-y-auto rounded-md border divide-y bg-white shadow-inner">
                      {filteredMatchStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Không tìm thấy học sinh nào phù hợp với "{matchSearchTerm}"
                        </div>
                      ) : (
                        filteredMatchStudents.slice(0, 50).map((st) => (
                          <div
                            key={st.id}
                            onClick={() => handleStudentSelectForMatch(st.id)}
                            className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                          >
                            <div>
                              <span className="font-semibold text-slate-900 group-hover:text-blue-700">
                                {st.user?.fullName}
                              </span>
                              <span className="text-slate-500 ml-1.5 font-normal">
                                (Lớp {st.class?.name || st.classId})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {st.boardingCode && (
                                <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {st.boardingCode}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                      <span>Hiển thị {Math.min(filteredMatchStudents.length, 50)} / {filteredMatchStudents.length} học sinh</span>
                      <span>💡 Gõ tên không dấu hoặc có dấu đều được</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chọn hóa đơn */}
              {selectedStudentId && (
                <div>
                  <Label className="font-medium">2. Chọn hóa đơn cần thanh toán:</Label>
                  {studentUnpaidBills.length > 0 ? (
                    <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="-- Chọn hóa đơn --" />
                      </SelectTrigger>
                      <SelectContent>
                        {studentUnpaidBills.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            Tháng {b.month}/{b.year} — Cần nộp: {formatVND(b.finalAmount)} ({b.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      Học sinh này chưa có hóa đơn nào. Vui lòng tạo hóa đơn trước.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTxForMatch(null)}>
              Hủy
            </Button>
            <Button
              onClick={executeManualMatch}
              disabled={matchingInProgress || !selectedBillId}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {matchingInProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
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
                <Label className="text-right">Trừ T.trước</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={editForm.previousDeduction}
                  onChange={(e) => setEditForm({ ...editForm, previousDeduction: parseInt(e.target.value) || 0 })}
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

      {/* =============== PHIẾU IN A5 (CHỈ RENDER KHI PRINT) =============== */}
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
          .map((bill, idx, arr) => (
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
                <h2 className="text-[16px] font-bold mb-0.5">PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ</h2>
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
                    <span>{bill.canceledDays} ngày</span>
                  </p>
                  <div className="flex">
                    <span className="font-bold w-36 shrink-0">Trừ tiền tháng trước:</span>
                    <div className="flex flex-col">
                      <span>{formatVND(bill.previousDeduction)}</span>
                      <span className="text-[11px] italic text-gray-700">
                        (Hủy suất ăn của tháng {bill.month === 1 ? 12 : bill.month - 1}/
                        {bill.month === 1 ? bill.year - 1 : bill.year})
                      </span>
                    </div>
                  </div>
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

              <div className="border-[1.5px] border-black py-1 my-1 text-center">
                <p className="text-[16px] font-bold mb-0">
                  SỐ TIỀN CẦN NỘP: {formatVND(bill.finalAmount)}
                </p>
                <p className="text-[11px] italic">
                  (Bằng chữ: {numberToVietnameseWords(Number(bill.finalAmount))})
                </p>
              </div>

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
            </div>
          ))}
      </div>
    </div>
  );
}
