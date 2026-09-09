"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/hooks/use-realtime";
import Swal from "sweetalert2";
import {
  Calendar,
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  School,
  Utensils,
  Phone,
  RotateCcw,
  Loader2,
  RefreshCw,
  Receipt,
  Copy,
  Check,
  CreditCard,
  History,
} from "lucide-react";
import { generateMealPaymentQR } from "@/lib/vietqr";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SettlementRecordItem {
  id: string;
  studentId?: string;
  settlementDate: string | Date;
  totalPaid: string | number;
  actualUsedAmount: string | number;
  refundOrDebt: string | number;
  settlementType: "REFUND" | "ADDITIONAL_PAYMENT" | "BALANCED";
  note?: string | null;
  isRefunded?: boolean;
}

interface StudentData {
  id: string;
  studentCode: string;
  boardingCode?: string | null;
  userId: string;
  classId: string;
  mealType: "MAN" | "CHAY" | "CHAO";
  boardingStatus: "ACTIVE" | "CANCELLED" | "SUSPENDED";
  boardingCancelledAt?: string | Date | null;
  mealStartDate?: string | Date | null;
  parentPhone?: string | null;
  birthDate?: string | Date | null;
  gender?: "MALE" | "FEMALE" | null;
  user?: {
    fullName: string;
    username: string;
    isActive: boolean;
  };
  class?: {
    name: string;
  };
  settlementRecords?: SettlementRecordItem[];
}

interface MealCancellation {
  id: string;
  studentId: string;
  cancelDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt?: string | null;
}

interface MealOverride {
  id: string;
  studentId: string;
  date: string;
  mealType: "MAN" | "CHAY" | "CHAO";
  createdAt: string;
}

interface StudentBill {
  id: string;
  month: number;
  year: number;
  scheduleMealDays: number;
  canceledDays: number;
  scheduleReducedDays?: number;
  extraMealDays?: number;
  netPayableDays: number;
  unitPrice: string | number;
  totalAmount: string | number;
  previousDeduction: string | number;
  previousAddition?: string | number;
  finalAmount: string | number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "SETTLED";
  qrCodeUrl: string | null;
  isPublished?: boolean;
  publishedAt?: string | Date | null;
  transactions?: Array<{
    id: string;
    amount: string | number;
    transDate: string;
    content?: string;
    gateway?: string | null;
    status: string;
  }>;
  student?: {
    id?: string;
    boardingStatus?: "ACTIVE" | "CANCELLED" | "SUSPENDED";
    boardingCancelledAt?: string | Date | null;
    settlementRecords?: SettlementRecordItem[];
  };
}

export function StudentPortal({ forceStudentId, readOnly = false }: { forceStudentId?: string, readOnly?: boolean }) {
  const { data: session, status } = useSession();
  const studentId = forceStudentId || session?.user?.studentId;

  const [studentInfo, setStudentInfo] = useState<StudentData | null>(null);
  const [loadingStudent, setLoadingStudent] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const [cancellations, setCancellations] = useState<MealCancellation[]>([]);
  const [loadingCancellations, setLoadingCancellations] = useState<boolean>(true);

  const [overrides, setOverrides] = useState<MealOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState<boolean>(true);

  const [bills, setBills] = useState<StudentBill[]>([]);
  const [loadingBills, setLoadingBills] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Tab và Lịch sử thanh toán
  const [activeTab, setActiveTab] = useState<string>("cancel");
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number>(new Date().getFullYear());
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<number | null>(null);

  // Cài đặt hiển thị tab theo cấu hình Quản trị viên Admin
  const [showDebtTab, setShowDebtTab] = useState<boolean>(false);
  const [showHistoryTab, setShowHistoryTab] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  const formatMoney = (val: number | string) =>
    new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(Number(val || 0)))) + "đ";

  // Trạng thái đã ngừng/hủy ăn bán trú
  const isCancelled = studentInfo?.boardingStatus === "CANCELLED";

  // Khi học sinh đã hủy bán trú: luôn mở tab Công nợ & Quyết toán để phụ huynh xem và thanh toán
  const effectiveShowDebtTab = showDebtTab || isCancelled;
  const effectiveShowHistoryTab = showHistoryTab || isCancelled;

  // Danh sách các phiếu còn nợ (UNPAID hoặc PARTIAL)
  const debtBills = bills.filter(
    (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
  );

  // Danh sách các năm có hóa đơn
  const availableYears = Array.from(
    new Set([new Date().getFullYear(), ...bills.map((b) => b.year)])
  ).sort((a, b) => b - a);

  // Hóa đơn lịch sử theo năm đã chọn (sắp xếp giảm dần theo tháng)
  const historyBills = bills
    .filter((b) => b.year === selectedHistoryYear)
    .sort((a, b) => b.month - a.month);

  // Helper: Lấy thông tin bản ghi quyết toán cho hóa đơn (nếu có)
  const getBillSettlement = (b: StudentBill): SettlementRecordItem | null => {
    const sRecords = b.student?.settlementRecords || studentInfo?.settlementRecords;
    if (!sRecords || sRecords.length === 0) return null;
    const latestSettlement = sRecords[0];

    const sDate = new Date(latestSettlement.settlementDate);
    const sMonth = sDate.getMonth() + 1;

    const isStudentCancelled = b.student?.boardingStatus === "CANCELLED" || isCancelled;
    if (isStudentCancelled && (b.month === sMonth || isCancelled)) {
      return latestSettlement;
    }
    return null;
  };

  // States for Cancel Form
  const [cancelDate, setCancelDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submittingCancel, setSubmittingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [isConfirmedLeave, setIsConfirmedLeave] = useState<boolean>(false);

  // States for Override Form
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideMealType, setOverrideMealType] = useState<string>("MAN");
  const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Nếu ngày mai là Chủ nhật (0), chuyển sang Thứ Hai vì Chủ nhật không có suất ăn
    if (tomorrow.getDay() === 0) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getEndOfWeekDateString = () => {
    const today = new Date();
    const day = today.getDay();
    let diff = day === 0 ? 0 : 7 - day;
    
    // Mở tuần kế tiếp vào Thứ Bảy và Chủ Nhật
    if (day === 6 || day === 0) {
      diff += 7;
    }
    
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + diff);
    const yyyy = endOfWeek.getFullYear();
    const mm = String(endOfWeek.getMonth() + 1).padStart(2, "0");
    const dd = String(endOfWeek.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const minDate = getTomorrowDateString();
  const maxDate = getEndOfWeekDateString();

  const isSunday = (dateStr: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return false;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).getDay() === 0;
  };

  const isDateCancelled = (dateStr: string) => {
    if (!dateStr) return false;
    return cancellations.some((c) => {
      if (c.status === "REJECTED") return false;
      const cd = new Date(c.cancelDate);
      const cdStr = `${cd.getUTCFullYear()}-${String(cd.getUTCMonth() + 1).padStart(2, "0")}-${String(cd.getUTCDate()).padStart(2, "0")}`;
      return cdStr === dateStr;
    });
  };

  const fetchStudentInfo = useCallback(async (id: string) => {
    try {
      setLoadingStudent(true);
      const res = await fetch(`/api/students?studentId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Không thể tải thông tin học sinh");
      const data = await res.json();
      if (data && data.length > 0) {
        setStudentInfo(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudent(false);
    }
  }, []);

  const fetchCancellations = useCallback(async (id: string) => {
    try {
      setLoadingCancellations(true);
      const res = await fetch(`/api/meal-cancel?studentId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setCancellations(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCancellations(false);
    }
  }, []);

  const fetchOverrides = useCallback(async (id: string) => {
    try {
      setLoadingOverrides(true);
      const res = await fetch(`/api/meal-override?studentId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setOverrides(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOverrides(false);
    }
  }, []);

  const fetchBills = useCallback(async (id: string) => {
    try {
      setLoadingBills(true);
      const res = await fetch(`/api/billing?studentId=${encodeURIComponent(id)}&publishedOnly=true`);
      if (res.ok) {
        const data = await res.json();
        const rawBills: StudentBill[] = data.data || [];
        setBills(rawBills.filter((b) => b.isPublished !== false));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setShowDebtTab(data.STUDENT_SHOW_DEBT_TAB === 'true');
        setShowHistoryTab(data.STUDENT_SHOW_HISTORY_TAB === 'true');
      }
    } catch (err) {
      console.error('Lỗi khi tải cài đặt hệ thống cho học sinh:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (studentId) {
      fetchStudentInfo(studentId);
      fetchCancellations(studentId);
      fetchOverrides(studentId);
      if (effectiveShowDebtTab || effectiveShowHistoryTab) {
        fetchBills(studentId);
      }
    } else if (status !== "loading") {
      setLoadingStudent(false);
      setLoadingCancellations(false);
      setLoadingOverrides(false);
      setLoadingBills(false);
    }
  }, [studentId, status, effectiveShowDebtTab, effectiveShowHistoryTab, fetchStudentInfo, fetchCancellations, fetchOverrides, fetchBills]);

  // Realtime: tự động cập nhật khi admin bật/tắt tab trong cài đặt hệ thống
  useRealtime({
    table: 'system_settings',
    event: '*',
    onChanged: () => {
      fetchSettings();
    },
  });

  // Tự động chuyển tab:
  // Nếu học sinh đã hủy bán trú: luôn chuyển sang tab "debt" (Công nợ & Quyết toán)
  // Nếu học sinh bình thường: chuyển về "cancel" nếu tab hiện tại bị admin ẩn đi
  useEffect(() => {
    if (isCancelled) {
      if (activeTab === "cancel" || activeTab === "override") {
        setActiveTab("debt");
      }
    } else {
      if (activeTab === "debt" && !showDebtTab) {
        setActiveTab("cancel");
      } else if (activeTab === "history" && !showHistoryTab) {
        setActiveTab("cancel");
      }
    }
  }, [activeTab, showDebtTab, showHistoryTab, isCancelled]);

  // Realtime: tự cập nhật khi trạng thái học sinh, cắt suất, đổi món hoặc hóa đơn thay đổi
  useRealtime({
    table: 'students',
    event: '*',
    onChanged: () => { 
      if (studentId) {
        fetchStudentInfo(studentId);
        fetchBills(studentId);
      }
    },
  });

  useRealtime({
    table: 'meal_cancellations',
    event: '*',
    onChanged: () => { if (studentId) fetchCancellations(studentId); },
  });

  useRealtime({
    table: 'meal_overrides',
    event: '*',
    onChanged: () => { if (studentId) fetchOverrides(studentId); },
  });

  useRealtime({
    table: 'monthly_bills',
    event: '*',
    onChanged: () => { if (studentId && (effectiveShowDebtTab || effectiveShowHistoryTab)) fetchBills(studentId); },
  });

  const handleCancelDateChange = async (newDate: string) => {
    setCancelDate(newDate);
    setIsConfirmedLeave(false);
    setCancelError(null);
    setCancelSuccess(null);

    if (!newDate) return;

    if (isSunday(newDate)) {
      setCancelError("Chủ nhật không có lịch ăn bán trú. Vui lòng chọn ngày từ Thứ 2 đến Thứ 6.");
      return;
    }

    if (newDate < minDate) {
      setCancelError("Không thể cắt suất cho ngày trong quá khứ hoặc đã qua giờ khóa sổ.");
      return;
    }

    if (newDate > maxDate) {
      setCancelError("Chỉ được cắt suất trong tuần hiện tại (hoặc tuần kế tiếp từ Thứ Bảy).");
      return;
    }

    if (isDateCancelled(newDate)) {
      setCancelError("Học sinh đang có yêu cầu cắt suất vào ngày này (chưa bị từ chối).");
      return;
    }

    // Ngày hợp lệ: Hiển thị popup buộc học sinh xác nhận đã nộp đơn xin nghỉ phép và được duyệt
    const result = await Swal.fire({
      title: "Xác nhận xin nghỉ phép",
      text: "Bạn xác nhận rằng đã nộp đơn xin nghỉ phép cho nhà trường và được duyệt",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Tôi xác nhận",
      cancelButtonText: "Hủy bỏ",
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (result.isConfirmed) {
      setIsConfirmedLeave(true);
    } else {
      setCancelDate("");
      setIsConfirmedLeave(false);
      setCancelError("Bạn cần nộp đơn xin nghỉ phép cho nhà trường và được duyệt trước khi yêu cầu cắt suất.");
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !cancelDate || !reason.trim()) {
      setCancelError("Vui lòng chọn ngày cắt suất và nhập lý do.");
      return;
    }

    if (isSunday(cancelDate)) {
      setCancelError("Chủ nhật không có lịch ăn bán trú. Vui lòng chọn ngày từ Thứ 2 đến Thứ 6.");
      return;
    }

    if (cancelDate < minDate) {
      setCancelError("Không thể cắt suất cho ngày trong quá khứ hoặc đã qua giờ khóa sổ.");
      return;
    }

    if (cancelDate > maxDate) {
      setCancelError("Chỉ được cắt suất trong tuần hiện tại (hoặc tuần kế tiếp từ Thứ Bảy).");
      return;
    }

    if (isDateCancelled(cancelDate)) {
      setCancelError("Học sinh đang có yêu cầu cắt suất vào ngày này (chưa bị từ chối).");
      return;
    }

    if (!isConfirmedLeave) {
      const result = await Swal.fire({
        title: "Xác nhận xin nghỉ phép",
        text: "Bạn xác nhận rằng đã nộp đơn xin nghỉ phép cho nhà trường và được duyệt",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#16a34a",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Tôi xác nhận",
        cancelButtonText: "Hủy bỏ",
        reverseButtons: true,
        allowOutsideClick: false,
      });

      if (!result.isConfirmed) {
        setCancelError("Bạn cần nộp đơn xin nghỉ phép cho nhà trường và được duyệt trước khi yêu cầu cắt suất.");
        return;
      }
      setIsConfirmedLeave(true);
    }

    setSubmittingCancel(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const res = await fetch("/api/meal-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          cancelDate,
          reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCancelSuccess(data.message || "Gửi yêu cầu thành công");
        setCancelDate("");
        setReason("");
        setIsConfirmedLeave(false);
        Swal.fire({
          title: "Thành công!",
          text: data.message || "Đã gửi yêu cầu cắt suất thành công. Vui lòng chờ duyệt.",
          icon: "success",
          confirmButtonColor: "#16a34a",
        });
        fetchCancellations(studentId);
      } else {
        setCancelError(data.error || "Có lỗi xảy ra, vui lòng thử lại");
        Swal.fire({
          title: "Không thể gửi yêu cầu",
          text: data.error || "Có lỗi xảy ra, vui lòng thử lại",
          icon: "error",
          confirmButtonColor: "#dc2626",
        });
      }
    } catch (err) {
      setCancelError("Lỗi kết nối mạng");
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !overrideDate || !overrideMealType) return;

    if (isSunday(overrideDate)) {
      setOverrideError("Chủ nhật không có lịch ăn bán trú. Vui lòng chọn ngày từ Thứ 2 đến Thứ 6.");
      return;
    }

    if (isDateCancelled(overrideDate)) {
      setOverrideError("Học sinh đang có yêu cầu cắt suất vào ngày này (chưa bị từ chối), không thể đổi món.");
      return;
    }

    setSubmittingOverride(true);
    setOverrideError(null);
    setOverrideSuccess(null);

    try {
      const res = await fetch("/api/meal-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          date: overrideDate,
          mealType: overrideMealType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setOverrideSuccess(data.message || "Đã đổi món thành công");
        setOverrideDate("");
        fetchOverrides(studentId);
      } else {
        setOverrideError(data.error || "Có lỗi xảy ra, vui lòng thử lại");
      }
    } catch (err) {
      setOverrideError("Lỗi kết nối mạng");
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleCancelOverride = async (id: string) => {
    if (!confirm("Bạn có chắc muốn hủy yêu cầu đổi món này? (Trở về mặc định)")) return;
    try {
      const res = await fetch(`/api/meal-override?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchOverrides(studentId!);
      } else {
        alert("Có lỗi xảy ra khi hủy");
      }
    } catch (err) {
      alert("Lỗi kết nối");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("T")[0].split("-");
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(2);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m} ${dd}/${mm}/${yy}`;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Chờ duyệt</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Đã duyệt</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">Từ chối</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMealTypeName = (type: string | undefined) => {
    if (type === "MAN") return "Cơm mặn";
    if (type === "CHAY") return "Cơm chay";
    if (type === "CHAO") return "Cháo";
    return type || "—";
  };

  if (!studentId && !loadingStudent && status !== "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Không tìm thấy tài khoản học sinh</h2>
        <p className="text-slate-500 max-w-md">Tài khoản này chưa được liên kết với bất kỳ hồ sơ học sinh nào. Vui lòng liên hệ nhà trường để được hỗ trợ.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md py-2.5 px-3.5 -mt-3 mb-2 -mx-4 sm:mx-0 sm:px-4 sm:py-3.5 sm:-mt-4 sm:mb-4 sm:rounded-lg border-b sm:border border-slate-200 shadow-xs">
        <h1 className="text-[15px] sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
          TRANG THÔNG TIN SUẤT ĂN BÁN TRÚ
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          <span className="font-semibold text-blue-600">{studentInfo?.user?.fullName || session?.user?.name}</span> {studentInfo?.class?.name ? `- Lớp: ${studentInfo.class.name}` : studentInfo?.classId ? `- Lớp: ${studentInfo.classId}` : ''}
        </p>
      </div>

      {/* Banner thông báo dành cho học sinh đã ngừng bán trú */}
      {isCancelled && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 shadow-xs flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 text-xs sm:text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-amber-950 text-sm sm:text-base">
                Học sinh đã ngừng đăng ký ăn bán trú
              </span>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold">
                Không bán trú
              </Badge>
            </div>
            <p className="text-amber-900 text-xs sm:text-[13px] leading-relaxed">
              {debtBills.length > 0 ? (
                <>
                  Nhà trường đã thực hiện thủ tục hủy bán trú và <strong>Quyết toán công nợ</strong>. Quý phụ huynh vui lòng kiểm tra thông tin chi tiết và hoàn tất nộp số tiền nợ quyết toán tại tab <strong>Công nợ & Quyết toán</strong> bên dưới.
                </>
              ) : (
                <>
                  Học sinh đã hoàn tất toàn bộ các khoản quyết toán tiền ăn bán trú. Cảm ơn quý phụ huynh và học sinh đã đồng hành cùng nhà trường!
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div>
            <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2 text-slate-800">
              <User className="h-5 w-5 text-blue-600" />
              Thông tin học sinh
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-slate-500">
              Hồ sơ học sinh đăng ký dịch vụ bán trú
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50/50 shrink-0 shadow-sm"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          >
            {isExpanded ? "Thu gọn" : "Xem chi tiết"}
          </Button>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-4">
            {loadingStudent ? (
              <div className="flex items-center justify-center py-6 text-slate-500 gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span>Đang tải thông tin...</span>
              </div>
            ) : !studentInfo ? (
              <div className="text-sm text-slate-500 py-2">Không tìm thấy thông tin chi tiết.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Họ và tên</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {studentInfo.user?.fullName || session?.user?.name || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Số CCCD</span>
                    <span className="font-semibold text-slate-900 truncate block">{studentInfo.studentCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Ngày sinh</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {studentInfo.birthDate ? new Date(studentInfo.birthDate).toLocaleDateString("vi-VN", { timeZone: "UTC" }) : "Chưa cập nhật"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Giới tính</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {studentInfo.gender === "FEMALE" ? "Nữ" : studentInfo.gender === "MALE" ? "Nam" : "Chưa cập nhật"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <School className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Lớp học</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {studentInfo.class?.name || studentInfo.classId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Utensils className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Chế độ suất ăn mặc định</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {getMealTypeName(studentInfo.mealType)}
                    </span>
                  </div>
                </div>

                {studentInfo.parentPhone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-slate-500 block">SĐT Phụ huynh</span>
                      <span className="font-semibold text-slate-900 truncate block">{studentInfo.parentPhone}</span>
                    </div>
                  </div>
                )}

                {studentInfo.mealStartDate && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-slate-500 block">Ngày bắt đầu ăn</span>
                      <span className="font-semibold text-slate-900 truncate block">
                        {new Date(studentInfo.mealStartDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500 block">Trạng thái bán trú</span>
                    <span className={`font-semibold truncate block ${studentInfo.boardingStatus === "ACTIVE" ? "text-teal-600" : "text-rose-600"}`}>
                      {studentInfo.boardingStatus === "ACTIVE" ? "Đang ăn bán trú" : "Không bán trú"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${
          isCancelled
            ? effectiveShowHistoryTab
              ? "grid-cols-2"
              : "grid-cols-1"
            : effectiveShowDebtTab && effectiveShowHistoryTab
            ? "grid-cols-2 sm:grid-cols-4"
            : effectiveShowDebtTab || effectiveShowHistoryTab
            ? "grid-cols-3"
            : "grid-cols-2"
        } mb-6 p-1.5 bg-slate-200 rounded-xl gap-1.5 h-auto border border-slate-300 shadow-2xs`}>
          {!isCancelled && (
            <>
              <TabsTrigger
                value="cancel"
                className="cursor-pointer transition-all duration-150 text-slate-700 hover:text-red-900 hover:bg-red-100/70 data-[state=active]:bg-red-600 data-[state=active]:text-white font-semibold data-[state=active]:shadow-sm py-2 text-xs sm:text-sm group"
              >
                <Calendar className="h-4 w-4 mr-1.5 shrink-0 text-slate-600 group-data-[state=active]:text-white" />
                {readOnly ? 'Lịch sử Cắt suất' : 'Cắt suất ăn'}
              </TabsTrigger>
              <TabsTrigger
                value="override"
                className="cursor-pointer transition-all duration-150 text-slate-700 hover:text-green-900 hover:bg-green-100/70 data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold data-[state=active]:shadow-sm py-2 text-xs sm:text-sm group"
              >
                <RefreshCw className="h-4 w-4 mr-1.5 shrink-0 text-slate-600 group-data-[state=active]:text-white" />
                {readOnly ? 'Lịch sử Đổi món' : 'Đổi món ăn'}
              </TabsTrigger>
            </>
          )}
          {effectiveShowDebtTab && (
            <TabsTrigger
              value="debt"
              className="cursor-pointer transition-all duration-150 text-slate-700 hover:text-amber-900 hover:bg-amber-100/70 data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold data-[state=active]:shadow-sm py-2 text-xs sm:text-sm flex items-center justify-center gap-1 group"
            >
              <AlertCircle className="h-4 w-4 mr-1 shrink-0 text-slate-600 group-data-[state=active]:text-white" />
              <span>{isCancelled ? "Công nợ & Quyết toán" : "DS công nợ"}</span>
              {debtBills.length > 0 && (
                <Badge className="bg-rose-600 group-data-[state=active]:bg-white group-data-[state=active]:text-amber-700 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center rounded-full ml-1 font-bold transition-colors">
                  {debtBills.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {effectiveShowHistoryTab && (
            <TabsTrigger
              value="history"
              className="cursor-pointer transition-all duration-150 text-slate-700 hover:text-blue-900 hover:bg-blue-100/70 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold data-[state=active]:shadow-sm py-2 text-xs sm:text-sm group"
            >
              <History className="h-4 w-4 mr-1.5 shrink-0 text-slate-600 group-data-[state=active]:text-white" />
              Lịch sử thanh toán
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="cancel">
          <div className={`grid grid-cols-1 gap-6 ${!readOnly ? "md:grid-cols-2" : ""}`}>
            {!readOnly && (
              <Card className="border-slate-200 shadow-xs h-fit">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-base sm:text-lg font-semibold text-slate-800">
                    Gửi yêu cầu Cắt suất ăn
                  </CardTitle>
                  <CardDescription>
                    Chọn ngày muốn cắt suất/đổi món ăn. Học sinh phải có lịch ăn bán trú vào ngày này và chỉ được cắt suất/đổi món trong tuần hiện tại, hệ thống sẽ mở tuần kế tiếp vào thứ Bảy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleCancelSubmit} className="space-y-4">
                    {cancelSuccess && (
                      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                        <div>{cancelSuccess}</div>
                      </div>
                    )}
                    {cancelError && (
                      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                        <div>{cancelError}</div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="cancelDate">Ngày cắt suất <span className="text-rose-500">*</span></Label>
                      <Input
                        id="cancelDate"
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={cancelDate}
                        onChange={(e) => handleCancelDateChange(e.target.value)}
                        required
                        className="bg-white"
                      />
                      {isSunday(cancelDate) && (
                        <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1.5 bg-rose-50 p-2 rounded border border-rose-200">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                          <span>Chủ nhật không có lịch ăn bán trú. Vui lòng chọn ngày khác (Thứ 2 đến Thứ 6).</span>
                        </p>
                      )}
                      {cancelDate && isConfirmedLeave && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium mt-1.5">
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>Đã xác nhận nộp đơn xin nghỉ phép cho nhà trường và được duyệt.</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Lý do <span className="text-rose-500">*</span></Label>
                      <Textarea
                        id="reason"
                        rows={3}
                        placeholder="VD: Nghỉ ốm, gia đình có việc bận..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingCancel || !cancelDate || !reason.trim() || isSunday(cancelDate) || !isConfirmedLeave}
                      className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:text-black disabled:opacity-100 font-medium"
                    >
                      {submittingCancel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Gửi yêu cầu
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

              <Card className="border-slate-200 shadow-xs h-fit">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-800">
                      Lịch sử Cắt suất
                    </CardTitle>
                    <CardDescription>Các yêu cầu gần đây</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {cancellations.length === 0 ? (
                    <div className="text-center py-8 px-4 text-slate-500 text-sm">Chưa có yêu cầu nào.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[350px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cancellations.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium whitespace-nowrap">{formatDate(item.cancelDate)}</TableCell>
                              <TableCell>{renderStatusBadge(item.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="override">
            <div className={`grid grid-cols-1 gap-6 ${!readOnly ? "md:grid-cols-2" : ""}`}>
              {!readOnly && (
                <Card className="border-slate-200 shadow-xs h-fit">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-800">
                      Đăng ký Đổi món
                    </CardTitle>
                    <CardDescription>
                      Chọn ngày muốn cắt suất/đổi món ăn. Học sinh phải có lịch ăn bán trú vào ngày này và chỉ được cắt suất/đổi món trong tuần hiện tại, hệ thống sẽ mở tuần kế tiếp vào thứ Bảy.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={handleOverrideSubmit} className="space-y-4">
                    {overrideSuccess && (
                      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                        <div>{overrideSuccess}</div>
                      </div>
                    )}
                    {overrideError && (
                      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                        <div>{overrideError}</div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="overrideDate">Ngày đổi món <span className="text-rose-500">*</span></Label>
                      <Input
                        id="overrideDate"
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={overrideDate}
                        onChange={(e) => {
                          setOverrideDate(e.target.value);
                          if (overrideError) setOverrideError(null);
                        }}
                        required
                        className="bg-white"
                      />
                      {isSunday(overrideDate) && (
                        <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5 mt-1.5 bg-rose-50 p-2 rounded border border-rose-200">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                          <span>Chủ nhật không có lịch ăn bán trú. Vui lòng chọn ngày khác (Thứ 2 đến Thứ 6).</span>
                        </p>
                      )}
                      {isDateCancelled(overrideDate) && !isSunday(overrideDate) && (
                        <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5 mt-1.5 bg-amber-50 p-2 rounded border border-amber-200">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>Học sinh đang có yêu cầu cắt suất vào ngày này (chưa bị từ chối), không thể đổi món.</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Món ăn muốn đổi <span className="text-rose-500">*</span></Label>
                      <Select value={overrideMealType} onValueChange={setOverrideMealType}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Chọn món ăn" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MAN">Cơm mặn</SelectItem>
                          <SelectItem value="CHAY">Cơm chay</SelectItem>
                          <SelectItem value="CHAO">Cháo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      disabled={submittingOverride || !overrideDate || isSunday(overrideDate) || isDateCancelled(overrideDate)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:text-black disabled:opacity-100 font-medium"
                    >
                      {submittingOverride ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Gửi yêu cầu
                    </Button>
                  </form>
                </CardContent>
              </Card>
              )}

              <Card className="border-slate-200 shadow-xs h-fit">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-slate-800">
                      Lịch sử Đổi món
                    </CardTitle>
                    <CardDescription>Các ngày đã đăng ký đổi món</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {overrides.length === 0 ? (
                    <div className="text-center py-8 px-4 text-slate-500 text-sm">Chưa có yêu cầu nào.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[350px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Món ăn mới</TableHead>
                            {!readOnly && <TableHead className="text-right">Hành động</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overrides.map((item) => {
                             // Check if it's past
                             const itemDate = new Date(item.date);
                             const today = new Date();
                             today.setHours(0, 0, 0, 0);
                             itemDate.setHours(0, 0, 0, 0);
                             const canCancel = itemDate > today;
                             
                             return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  {getMealTypeName(item.mealType)}
                                </Badge>
                              </TableCell>
                              {!readOnly && (
                                <TableCell className="text-right">
                                  {canCancel ? (
                                    <Button variant="ghost" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleCancelOverride(item.id)}>
                                      Hủy đổi
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-slate-400">Đã khóa</span>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          )})}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: DANH SÁCH CÔNG NỢ & QUYẾT TOÁN */}
          {effectiveShowDebtTab && (
            <TabsContent value="debt">
            <div className="space-y-6">
              {loadingBills ? (
                <Card className="p-8 text-center text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                  Đang tải thông tin công nợ & quyết toán...
                </Card>
              ) : debtBills.length === 0 ? (
                <Card className="p-8 text-center bg-emerald-50/40 border border-emerald-200 shadow-xs">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    {isCancelled ? "Đã hoàn tất quyết toán tiền ăn" : "Không có công nợ tiền ăn"}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                    {isCancelled ? (
                      `Học sinh ${studentInfo?.user?.fullName || ""} đã ngừng ăn bán trú và đã hoàn tất thanh toán toàn bộ các khoản quyết toán tiền ăn. Dịch vụ bán trú đã kết thúc. Cảm ơn quý phụ huynh đã đồng hành cùng nhà trường!`
                    ) : (
                      `Học sinh ${studentInfo?.user?.fullName || ""} hiện không có phiếu báo tiền ăn nào còn nợ. Cảm ơn quý phụ huynh đã hoàn thành đầy đủ các khoản tiền ăn bán trú!`
                    )}
                  </p>
                  {effectiveShowHistoryTab && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("history")}
                        className="text-xs text-blue-700 border-blue-200 bg-white hover:bg-blue-50"
                      >
                        <History className="h-3.5 w-3.5 mr-1.5" />
                        Xem lại Lịch sử thanh toán trong năm
                      </Button>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Banner cảnh báo tiền dư nếu có hóa đơn nào bị nộp thừa */}
                  {bills.some(b => {
                    const p = (b.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
                    return p > Number(b.finalAmount) && Number(b.finalAmount) > 0;
                  }) && (
                    <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold text-amber-900">Phát hiện giao dịch chuyển thừa tiền</p>
                        <p className="text-amber-800 mt-0.5">
                          Có hóa đơn đã được thanh toán vượt mức. Vui lòng liên hệ nhà trường để được hoàn tiền phần dư.
                        </p>
                      </div>
                    </div>
                  )}
                  {debtBills.map((bill, index) => {
                    const isLatest = index === 0;
                    const isPartial = bill.paymentStatus === "PARTIAL";
                    const billTotal = Number(bill.finalAmount);
                    const paidAmount = (bill.transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
                    const remainingAmount = Math.max(0, billTotal - paidAmount);
                    const settlement = getBillSettlement(bill);

                    // Sinh QR Code động với số tiền CÒN NỢ thực tế
                    const qrUrl = generateMealPaymentQR(
                      studentInfo?.boardingCode || studentInfo?.studentCode || "",
                      bill.month,
                      bill.year,
                      remainingAmount
                    );

                    return (
                      <Card
                        key={bill.id}
                        className={`overflow-hidden border-2 transition-all ${
                          isPartial ? "border-amber-300 bg-white shadow-md" : "border-rose-300 bg-white shadow-md"
                        }`}
                      >
                        <CardHeader className={`border-b pb-3 ${isPartial ? "bg-amber-50/70" : "bg-rose-50/50"}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                                  Hóa đơn tiền ăn Tháng {bill.month}/{bill.year}
                                </CardTitle>
                                {isLatest && (
                                  <Badge className="bg-blue-600 text-white text-[10px]">Mới nhất</Badge>
                                )}
                                {settlement && (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] sm:text-xs px-2 py-0.5 flex items-center gap-1 shadow-2xs">
                                    ⚖️ ĐÃ QUYẾT TOÁN HỦY BÁN TRÚ
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="text-xs mt-0.5">
                                Học sinh: <b>{studentInfo?.user?.fullName}</b> — Lớp: <b>{studentInfo?.class?.name}</b>
                              </CardDescription>
                            </div>
                            <div>
                              {isPartial ? (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold px-2.5 py-1 text-xs flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                  Đã thanh toán một phần
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 border-rose-300 font-semibold px-2.5 py-1 text-xs flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Chưa thanh toán
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-4 space-y-4 text-xs">
                          {/* Khung chi tiết Quyết toán khi Hủy bán trú */}
                          {settlement && (
                            <div className="p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-2.5 shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-200/80 pb-2 gap-1.5">
                                <span className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                                  Thông tin Quyết toán khi Hủy ăn Bán trú
                                </span>
                                <span className="text-[11px] text-amber-900 font-semibold bg-amber-100/90 px-2.5 py-0.5 rounded border border-amber-200 w-fit">
                                  Ngày quyết toán: {new Date(settlement.settlementDate).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                              <div className="text-xs text-amber-950 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200">
                                    <span className="text-slate-500 block text-[11px]">Trạng thái dịch vụ:</span>
                                    <span className="font-bold text-rose-700">
                                      Đã ngừng ăn bán trú
                                    </span>
                                  </div>
                                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200">
                                    <span className="text-slate-500 block text-[11px]">Số ngày ăn thực tế:</span>
                                    <span className="font-bold text-slate-900">
                                      {bill.scheduleMealDays} ngày (Tổng tiền: {formatMoney(bill.finalAmount)})
                                    </span>
                                  </div>
                                </div>
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-center justify-between">
                                  <span className="font-semibold text-rose-900">
                                    Số tiền nợ quyết toán thực tế cần nộp:
                                  </span>
                                  <span className="font-extrabold text-rose-700 text-sm sm:text-base">
                                    {formatMoney(remainingAmount)}
                                  </span>
                                </div>
                                {settlement.note && (
                                  <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded-lg border border-amber-100">
                                    <strong>Ghi chú từ nhà trường:</strong> {settlement.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bảng tóm tắt thông số */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block text-[11px]">{settlement ? "Số ngày ăn thực tế:" : "Số ngày ăn dự kiến:"}</span>
                              <span className="text-sm font-bold text-slate-800">{bill.scheduleMealDays} ngày</span>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block text-[11px]">Số ngày cắt/hủy:</span>
                              <span className="text-sm font-bold text-rose-600">
                                {bill.canceledDays} ngày
                                {(bill.scheduleReducedDays ?? 0) > 0 && (
                                  <span className="block text-[10px] text-slate-500 font-normal">
                                    ({bill.canceledDays - (bill.scheduleReducedDays ?? 0)} cắt + {bill.scheduleReducedDays} hủy)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block text-[11px]">{settlement ? "Tổng tiền quyết toán:" : "Tổng tiền hóa đơn:"}</span>
                              <span className="text-sm font-bold text-slate-800">{formatMoney(billTotal)}</span>
                            </div>
                            <div className={`p-2.5 rounded-lg border ${isPartial ? "bg-amber-50/80 border-amber-200" : "bg-rose-50/80 border-rose-200"}`}>
                              <span className={`block text-[11px] font-medium ${isPartial ? "text-amber-800" : "text-rose-700"}`}>
                                {settlement ? "Nợ Quyết toán CÒN LẠI:" : "Số tiền CÒN NỢ:"}
                              </span>
                              <span className={`text-base font-extrabold ${isPartial ? "text-amber-900" : "text-rose-700"}`}>
                                {formatMoney(remainingAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Chi tiết bù trừ tháng trước (nếu có) */}
                          {(Number(bill.previousDeduction) > 0 || Number(bill.previousAddition || 0) > 0) && (
                            <div className="p-2 bg-blue-50/70 border border-blue-200/70 rounded-lg text-[11px] text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span className="font-semibold text-blue-900">Bù trừ tháng trước:</span>
                              {Number(bill.previousDeduction) > 0 && (
                                <span className="text-rose-700 font-medium">
                                  Giảm trừ: -{formatMoney(bill.previousDeduction)} ({bill.canceledDays} ngày)
                                </span>
                              )}
                              {Number(bill.previousAddition || 0) > 0 && (
                                <span className="text-emerald-700 font-medium">
                                  Ăn thêm lịch phát sinh: +{formatMoney(bill.previousAddition || 0)} ({bill.extraMealDays || 0} ngày)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Nếu là thanh toán 1 phần: Hiển thị phân tích công nợ & lịch sử đã nộp */}
                          {isPartial && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                              <div className="font-semibold text-amber-950 flex items-center justify-between text-xs border-b border-amber-200/60 pb-1.5">
                                <span className="flex items-center gap-1.5">
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                  Chi tiết công nợ đã trả & còn lại:
                                </span>
                                <span className="text-amber-800 font-normal">
                                  Đã nộp: <strong className="text-emerald-700 font-bold">{formatMoney(paidAmount)}</strong> / {formatMoney(billTotal)}
                                </span>
                              </div>

                              {/* Danh sách các lần chuyển khoản đã ghi nhận của phiếu này */}
                              {bill.transactions && bill.transactions.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[11px] text-slate-500 font-medium block">
                                    Lịch sử các lần đã chuyển khoản cho phiếu Tháng {bill.month}/{bill.year}:
                                  </span>
                                  <div className="space-y-1">
                                    {bill.transactions.map((tx, txIdx) => (
                                      <div
                                        key={tx.id || txIdx}
                                        className="flex items-center justify-between p-2 rounded bg-white border border-amber-100 text-[11px]"
                                      >
                                        <div>
                                          <div className="font-medium text-slate-800">
                                            Lần {bill.transactions!.length - txIdx}:{" "}
                                            <span className="font-bold text-emerald-700">+{formatMoney(tx.amount)}</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-mono">
                                            {new Date(tx.transDate).toLocaleString("vi-VN")}
                                            {tx.content && ` — ${tx.content}`}
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] shrink-0">
                                          Đã ghi nhận
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Khung quét mã VietQR để nộp phần tiền CÒN LẠI */}
                          <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center gap-4 sm:gap-6">
                            {/* QR Code */}
                            <div className="shrink-0 flex flex-col items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-xs">
                              <img
                                src={qrUrl}
                                alt="QR Thanh toán Tiền ăn"
                                className="w-40 h-40 object-contain"
                                loading="eager"
                              />
                              <span className="text-[11px] text-blue-600 font-bold mt-1">
                                {settlement ? `Nộp quyết toán: ${formatMoney(remainingAmount)}` : `Quét để nộp: ${formatMoney(remainingAmount)}`}
                              </span>
                            </div>

                            {/* Hướng dẫn và thông tin chuyển khoản */}
                            <div className="flex-1 space-y-2.5 w-full text-xs">
                              <div className="space-y-0.5">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-800 uppercase flex items-center gap-1.5">
                                  <CreditCard className="h-4 w-4 text-blue-600" />
                                  {settlement
                                    ? "Quét mã để nộp tiền nợ Quyết toán Bán trú"
                                    : isPartial
                                    ? "Quét mã để nộp tiếp phần nợ còn lại"
                                    : "Hướng dẫn Chuyển khoản Tự động gạch nợ"}
                                </h4>
                                <p className="text-slate-600 text-[11px]">
                                  {settlement
                                    ? <>Mở app ngân hàng quét mã QR trên (đã kèm sẵn số tiền quyết toán nợ <b>{formatMoney(remainingAmount)}</b>) để hệ thống tự động gạch nợ trong vòng <b>1-3 giây</b>.</>
                                    : <>Mở app ngân hàng quét mã QR trên (đã kèm sẵn số tiền <b>{formatMoney(remainingAmount)}</b>) để hệ thống tự động gạch nợ trong vòng <b>1-3 giây</b>.</>}
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Ngân hàng nhận:</span>
                                    <span className="font-semibold text-slate-800">BIDV</span>
                                  </div>
                                  <span className="text-slate-400 text-[10px]">Chủ TK: <strong>HOANG KIM</strong></span>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Số tài khoản:</span>
                                    <span className="font-mono font-bold text-slate-900 text-sm">96247BANTRUTLM08</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => {
                                      navigator.clipboard.writeText("96247BANTRUTLM08");
                                      setCopiedField(`stk-${bill.id}`);
                                      setTimeout(() => setCopiedField(null), 2000);
                                    }}
                                  >
                                    {copiedField === `stk-${bill.id}` ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                    <span className="ml-1 text-[11px]">Sao chép</span>
                                  </Button>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
                                  <div>
                                    <span className="text-amber-800 block text-[10px] font-bold">
                                      NỘI DUNG CHUYỂN KHOẢN BẮT BUỘC:
                                    </span>
                                    <span className="font-mono font-extrabold text-blue-700 text-xs sm:text-sm">
                                      BSTLM {studentInfo?.boardingCode || studentInfo?.studentCode} T{String(bill.month).padStart(2, '0')}{String(bill.year).slice(-2)}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-blue-700 hover:bg-blue-100"
                                    onClick={() => {
                                      const codeStr = `BSTLM ${studentInfo?.boardingCode || studentInfo?.studentCode} T${String(bill.month).padStart(2, '0')}{String(bill.year).slice(-2)}`;
                                      navigator.clipboard.writeText(codeStr);
                                      setCopiedField(`content-${bill.id}`);
                                      setTimeout(() => setCopiedField(null), 2000);
                                    }}
                                  >
                                    {copiedField === `content-${bill.id}` ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-blue-600" />
                                    )}
                                    <span className="ml-1 text-[11px]">Sao chép</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
          )}

          {/* TAB 4: LỊCH SỬ THANH TOÁN (BẬT/TẮT THEO QUẢN TRỊ VIÊN) */}
          {effectiveShowHistoryTab && (
            <TabsContent value="history">
            <div className="space-y-4">
              {/* Header Lọc năm & Menu xổ xuống chọn tháng */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-blue-600" />
                    Lịch sử thanh toán tiền ăn
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-slate-500 shrink-0">Năm:</Label>
                    <Select
                      value={String(selectedHistoryYear)}
                      onValueChange={(val) => {
                        setSelectedHistoryYear(Number(val));
                        setSelectedHistoryMonth(null);
                      }}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((yr) => (
                          <SelectItem key={yr} value={String(yr)} className="text-xs">
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Menu xổ xuống chọn tháng xem hóa đơn */}
                <div className="pt-2 border-t border-slate-100">
                  <Label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    Chọn tháng cần xem hóa đơn:
                  </Label>
                  <Select
                    value={selectedHistoryMonth !== null ? String(selectedHistoryMonth) : "none"}
                    onValueChange={(val) => setSelectedHistoryMonth(val === "none" ? null : Number(val))}
                  >
                    <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-slate-50 border-slate-300 font-medium">
                      <SelectValue placeholder="-- Bấm vào đây để chọn tháng --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-slate-400 italic text-xs">
                        -- Chọn tháng xem chi tiết --
                      </SelectItem>
                      {historyBills.map((b) => (
                        <SelectItem key={b.id} value={String(b.month)} className="text-xs sm:text-sm py-2">
                          Tháng {b.month}/{b.year} — {b.paymentStatus === "PAID" ? "✅ Đã thanh toán đủ" : b.paymentStatus === "PARTIAL" ? "⚠️ Đã nộp 1 phần" : "❌ Chưa thanh toán"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Thống kê nhanh năm */}
              {(() => {
                const totalPaidInSelectedYear = historyBills.reduce((acc, b) => {
                  const billPaid = (b.transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
                  return acc + (b.paymentStatus === "PAID" ? Number(b.finalAmount) : billPaid);
                }, 0);
                const paidBillsCount = historyBills.filter((b) => b.paymentStatus === "PAID").length;

                return (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-emerald-700 block text-[10px] sm:text-[11px]">Đã thanh toán năm {selectedHistoryYear}:</span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-900">{formatMoney(totalPaidInSelectedYear)}</span>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-blue-700 block text-[10px] sm:text-[11px]">Hóa đơn hoàn tất:</span>
                      <span className="text-sm sm:text-base font-extrabold text-blue-900">{paidBillsCount} / {historyBills.length} tháng</span>
                    </div>
                  </div>
                );
              })()}

              {/* Chi tiết hóa đơn tháng được chọn */}
              {loadingBills ? (
                <Card className="p-8 text-center text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                  Đang tải lịch sử thanh toán...
                </Card>
              ) : historyBills.length === 0 ? (
                <Card className="p-8 text-center text-slate-400">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50 text-slate-400" />
                  <p className="font-medium text-slate-600">Không có hóa đơn nào trong năm {selectedHistoryYear}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Vui lòng chọn năm khác từ danh sách phía trên.
                  </p>
                </Card>
              ) : selectedHistoryMonth === null ? (
                <Card className="p-6 text-center bg-slate-50 border border-dashed border-slate-200">
                  <Receipt className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" />
                  <p className="font-semibold text-xs sm:text-sm text-slate-700">
                    Vui lòng chọn tháng ở menu xổ xuống phía trên
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống sẽ hiển thị chi tiết hóa đơn và các lần thanh toán tương ứng với tháng bạn chọn.
                  </p>
                </Card>
              ) : (() => {
                const bill = historyBills.find((b) => b.month === selectedHistoryMonth);
                if (!bill) {
                  return (
                    <Card className="p-6 text-center text-slate-400">
                      <p className="text-xs">Không tìm thấy hóa đơn của Tháng {selectedHistoryMonth}/{selectedHistoryYear}</p>
                    </Card>
                  );
                }

                const billTotal = Number(bill.finalAmount);
                const paidAmount = (bill.transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
                const isPaid = bill.paymentStatus === "PAID";
                const isPartial = bill.paymentStatus === "PARTIAL";
                const settlement = getBillSettlement(bill);

                return (
                  <Card key={bill.id} className="border border-slate-200 shadow-xs overflow-hidden">
                    <CardHeader className="py-2.5 px-3.5 bg-slate-50 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            Hóa đơn Tháng {bill.month}/{bill.year}
                          </span>
                          {settlement && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] px-2 py-0.5 flex items-center gap-1 shadow-2xs">
                              ⚖️ Đã quyết toán hủy bán trú
                            </Badge>
                          )}
                        </div>
                        <div>
                          {isPaid ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-[11px] flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Đã thanh toán đủ
                            </Badge>
                          ) : isPartial ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Đã nộp 1 phần
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[11px] flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Chưa thanh toán
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 space-y-2.5 text-xs">
                      {settlement && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
                          <div className="flex items-center justify-between font-bold text-[11px] border-b border-amber-200/60 pb-1">
                            <span>Chi tiết quyết toán khi ngừng bán trú:</span>
                            <span>Ngày quyết toán: {new Date(settlement.settlementDate).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <p className="text-[11px]">
                            Học sinh đã ngừng bán trú. Số ngày ăn thực tế đã quyết toán: <strong>{bill.scheduleMealDays} ngày</strong> (Tổng tiền thực tế: {formatMoney(bill.finalAmount)}).
                          </p>
                          {settlement.note && (
                            <p className="text-[10px] italic text-slate-600">Ghi chú: {settlement.note}</p>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Số ngày ăn:</span>
                          <span className="font-semibold text-slate-800">
                            {bill.scheduleMealDays} ngày (Cắt {bill.canceledDays} ngày)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Tổng tiền:</span>
                          <span className="font-semibold text-slate-800">{formatMoney(billTotal)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Đã thanh toán:</span>
                          <span className="font-bold text-emerald-700">
                            {formatMoney(paidAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{paidAmount > billTotal ? 'Tiền dư:' : 'Còn nợ:'}</span>
                          {paidAmount > billTotal ? (
                            <span className="font-bold text-amber-600">
                              {formatMoney(paidAmount - billTotal)} (Chờ hoàn tiền)
                            </span>
                          ) : (
                            <span className={`font-bold ${isPaid ? "text-slate-400" : "text-rose-600"}`}>
                              {formatMoney(Math.max(0, billTotal - paidAmount))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lịch sử các giao dịch SePay nếu có */}
                      {bill.transactions && bill.transactions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                          <span className="text-[11px] font-medium text-slate-500 block">
                            Giao dịch thanh toán được ghi nhận:
                          </span>
                          <div className="space-y-1">
                            {bill.transactions.map((tx, idx) => (
                              <div
                                key={tx.id || idx}
                                className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-[11px]"
                              >
                                <div>
                                  <span className="font-bold text-emerald-700">+{formatMoney(tx.amount)}</span>
                                  <span className="text-slate-500 ml-2 font-mono text-[10px]">
                                    {new Date(tx.transDate).toLocaleString("vi-VN")}
                                  </span>
                                  {tx.content && (
                                    <p className="text-[10px] text-slate-600 font-mono truncate max-w-xs sm:max-w-md mt-0.5">
                                      {tx.content}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-[10px] shrink-0">
                                  Đã ghi nhận
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </TabsContent>
          )}
    </Tabs>
    </div>
  );
}
