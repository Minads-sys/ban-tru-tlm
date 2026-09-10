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
  Wallet,
  Sparkles,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Info,
  Ban,
  LayoutGrid,
  ListFilter,
} from "lucide-react";
import { generateMealPaymentQR } from "@/lib/vietqr";
import { formatDate } from "@/lib/utils";
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
  liveActualDays?: number;
  liveScheduleDelta?: number;
  liveEstimatedSurplus?: number;
  nextMonth?: number;
  nextYear?: number;
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
  const [unlinkedTransactions, setUnlinkedTransactions] = useState<Array<{
    id: string;
    amount: string | number;
    transDate: string;
    content?: string;
    gateway?: string | null;
    status: string;
  }>>([]);
  const [loadingBills, setLoadingBills] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Tab và Lịch sử thanh toán
  const [activeTab, setActiveTab] = useState<string>("schedule");
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number>(new Date().getFullYear());
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<number | null>(null);

  // States cho Lịch ăn trong tháng & Sân ăn
  const [scheduleMonth, setScheduleMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [scheduleYear, setScheduleYear] = useState<number>(() => new Date().getFullYear());
  const [monthlyScheduleData, setMonthlyScheduleData] = useState<any | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(true);
  const [scheduleViewMode, setScheduleViewMode] = useState<"calendar" | "list">("calendar");

  const fetchMonthlySchedule = useCallback(async (id: string, y: number, m: number) => {
    try {
      setLoadingSchedule(true);
      const res = await fetch(`/api/student/monthly-schedule?studentId=${encodeURIComponent(id)}&year=${y}&month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyScheduleData(data);
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch ăn tháng của học sinh:", err);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  const handlePrevMonth = () => {
    if (scheduleMonth === 1) {
      setScheduleMonth(12);
      setScheduleYear(scheduleYear - 1);
    } else {
      setScheduleMonth(scheduleMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (scheduleMonth === 12) {
      setScheduleMonth(1);
      setScheduleYear(scheduleYear + 1);
    } else {
      setScheduleMonth(scheduleMonth + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const d = new Date();
    setScheduleMonth(d.getMonth() + 1);
    setScheduleYear(d.getFullYear());
  };

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

  // CẢI TIẾN 1: Danh sách các phiếu nộp thừa / chuyển khoản 2 lần
  const overpaidBills = bills.filter((b) => {
    const paid = (b.transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
    return paid > Number(b.finalAmount) && Number(b.finalAmount) > 0;
  });

  const totalOverpaidExcess = overpaidBills.reduce((sum, b) => {
    const paid = (b.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
    return sum + (paid - Number(b.finalAmount));
  }, 0);
  const totalUnlinkedExcess = unlinkedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalTransferSurplus = totalOverpaidExcess + totalUnlinkedExcess;

  // CẢI TIẾN 2: Danh sách các phiếu đã thanh toán nhưng TKB thực tế cập nhật giảm số buổi ăn
  const scheduleSurplusBills = bills.filter((b) => {
    return (
      b.paymentStatus === "PAID" &&
      typeof b.liveScheduleDelta === "number" &&
      b.liveScheduleDelta < 0 &&
      (b.liveEstimatedSurplus || 0) > 0
    );
  });
  const totalScheduleSurplus = scheduleSurplusBills.reduce((sum, b) => {
    return sum + (b.liveEstimatedSurplus || 0);
  }, 0);

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
        setUnlinkedTransactions(data.unlinkedTransactions || []);
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
      fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      if (effectiveShowDebtTab || effectiveShowHistoryTab) {
        fetchBills(studentId);
      }
    } else if (status !== "loading") {
      setLoadingStudent(false);
      setLoadingCancellations(false);
      setLoadingOverrides(false);
      setLoadingBills(false);
      setLoadingSchedule(false);
    }
  }, [studentId, status, scheduleYear, scheduleMonth, effectiveShowDebtTab, effectiveShowHistoryTab, fetchStudentInfo, fetchCancellations, fetchOverrides, fetchBills, fetchMonthlySchedule]);

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
  // Nếu học sinh bình thường: chuyển về "schedule" nếu tab hiện tại bị admin ẩn đi
  useEffect(() => {
    if (isCancelled) {
      if (activeTab === "cancel" || activeTab === "override") {
        setActiveTab("debt");
      }
    } else {
      if (activeTab === "debt" && !showDebtTab) {
        setActiveTab("schedule");
      } else if (activeTab === "history" && !showHistoryTab) {
        setActiveTab("schedule");
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
        fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      }
    },
  });

  useRealtime({
    table: 'meal_cancellations',
    event: '*',
    onChanged: () => {
      if (studentId) {
        fetchCancellations(studentId);
        fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      }
    },
  });

  useRealtime({
    table: 'meal_overrides',
    event: '*',
    onChanged: () => {
      if (studentId) {
        fetchOverrides(studentId);
        fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      }
    },
  });

  useRealtime({
    table: 'daily_dining_courts',
    event: '*',
    onChanged: () => {
      if (studentId) {
        fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      }
    },
  });

  useRealtime({
    table: 'student_special_meals',
    event: '*',
    onChanged: () => {
      if (studentId) {
        fetchMonthlySchedule(studentId, scheduleYear, scheduleMonth);
      }
    },
  });

  useRealtime({
    table: 'monthly_bills',
    event: '*',
    onChanged: () => { if (studentId && (effectiveShowDebtTab || effectiveShowHistoryTab)) fetchBills(studentId); },
  });

  useRealtime({
    table: 'payment_transactions',
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
      {!readOnly && (
        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md py-2.5 px-3.5 -mt-3 mb-2 -mx-4 sm:mx-0 sm:px-4 sm:py-3.5 sm:-mt-4 sm:mb-4 sm:rounded-lg border-b sm:border border-slate-200 shadow-xs">
          <h1 className="text-[15px] sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            TRANG THÔNG TIN SUẤT ĂN BÁN TRÚ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-blue-600">{studentInfo?.user?.fullName || session?.user?.name}</span> {studentInfo?.class?.name ? `- Lớp: ${studentInfo.class.name}` : studentInfo?.classId ? `- Lớp: ${studentInfo.classId}` : ''}
          </p>
        </div>
      )}

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
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2"
            : effectiveShowDebtTab && effectiveShowHistoryTab
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
            : effectiveShowDebtTab || effectiveShowHistoryTab
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-3"
        } mb-6 p-1.5 bg-slate-200 rounded-xl gap-1.5 h-auto border border-slate-300 shadow-2xs`}>
          <TabsTrigger
            value="schedule"
            className="cursor-pointer transition-all duration-150 text-slate-700 hover:text-purple-900 hover:bg-purple-100/70 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold data-[state=active]:shadow-sm py-2 text-xs sm:text-sm group"
          >
            <CalendarDays className="h-4 w-4 mr-1.5 shrink-0 text-slate-600 group-data-[state=active]:text-white" />
            Lịch ăn & Sân ăn
          </TabsTrigger>
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

        <TabsContent value="schedule">
          {/* 1. Thẻ Hôm nay ăn gì & Ở sân nào? */}
          {loadingSchedule && !monthlyScheduleData ? (
            <Card className="border-slate-200 shadow-xs mb-6 p-8 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
              <p className="text-sm font-medium">Đang tải lịch ăn và vị trí sân ăn...</p>
            </Card>
          ) : (
            <>
              {monthlyScheduleData?.todayInfo && (
                <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/60 dark:from-purple-950/40 dark:via-slate-900 dark:to-indigo-950/30 shadow-xs mb-6 overflow-hidden">
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-purple-100 dark:border-purple-900/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 hover:bg-purple-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                          Hôm nay: {monthlyScheduleData.todayInfo.dowName}
                        </Badge>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatDate(monthlyScheduleData.todayInfo.dateStr)}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-purple-600" />
                        {monthlyScheduleData.todayInfo.hasMeal
                          ? "Thông Tin Suất Ăn & Sân Ăn Hôm Nay"
                          : "Hôm nay không có lịch ăn bán trú"}
                      </h3>
                    </div>

                    {/* Vị trí sân ăn hôm nay */}
                    {monthlyScheduleData.todayInfo.hasMeal && (
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 px-4 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs self-stretch md:self-auto justify-between md:justify-start">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                          <MapPin className="h-6 w-6" />
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                            Vị trí sân ăn
                          </span>
                          <span className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-300 block">
                            {monthlyScheduleData.todayInfo.court
                              ? `${monthlyScheduleData.todayInfo.court.courtName} • ${monthlyScheduleData.todayInfo.court.cartName}`
                              : "Chưa phân sân"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {monthlyScheduleData.todayInfo.hasMeal ? (
                    <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {/* Ca ăn */}
                      <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Ca ăn</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">
                          {monthlyScheduleData.todayInfo.shiftName}
                        </span>
                      </div>

                      {/* Loại lịch */}
                      <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Loại lịch học</span>
                        <span
                          className={`font-bold block truncate ${
                            monthlyScheduleData.todayInfo.mealCategory === "SPECIAL"
                              ? "text-orange-700 dark:text-orange-400"
                              : "text-blue-700 dark:text-blue-400"
                          }`}
                          title={monthlyScheduleData.todayInfo.scheduleName}
                        >
                          {monthlyScheduleData.todayInfo.scheduleName}
                        </span>
                      </div>

                      {/* Chế độ ăn */}
                      <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Chế độ món</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                          {monthlyScheduleData.todayInfo.mealTypeName}
                          {monthlyScheduleData.todayInfo.isMealOverridden && " (Đã đổi món)"}
                        </span>
                      </div>

                      {/* Trạng thái cắt suất */}
                      <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Trạng thái suất ăn</span>
                        {monthlyScheduleData.todayInfo.cancellation ? (
                          <Badge
                            variant="outline"
                            className={
                              monthlyScheduleData.todayInfo.cancellation.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px]"
                                : monthlyScheduleData.todayInfo.cancellation.status === "PENDING"
                                ? "bg-amber-50 text-amber-700 border-amber-300 font-bold text-[11px]"
                                : "bg-rose-50 text-rose-700 border-rose-300 font-bold text-[11px]"
                            }
                          >
                            {monthlyScheduleData.todayInfo.cancellation.cancellationNote}
                          </Badge>
                        ) : (
                          <span className="font-bold text-teal-700 dark:text-teal-400 block text-xs">
                            Bình thường (Có ăn)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-slate-500 italic">
                      💡 Hôm nay không có suất ăn bán trú theo thời khóa biểu hoặc lịch đặc biệt.
                    </div>
                  )}
                </Card>
              )}

              {/* 2. Lịch Ăn Cả Tháng */}
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <CalendarDays className="h-5 w-5 text-purple-600 shrink-0" />
                        <span>Lịch Ăn Tháng {scheduleMonth} / {scheduleYear}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Chi tiết lịch học thường, học đặc biệt, trạng thái suất và vị trí sân ăn của bạn.
                      </CardDescription>
                    </div>

                    {/* Bộ điều hướng tháng & Chế độ xem */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Nút Tháng trước / sau */}
                      <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePrevMonth}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 cursor-pointer"
                          title="Tháng trước"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-2 sm:px-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                          Tháng {scheduleMonth} / {scheduleYear}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleNextMonth}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 cursor-pointer"
                          title="Tháng sau"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Nút Về tháng hiện tại */}
                      {(scheduleMonth !== new Date().getMonth() + 1 || scheduleYear !== new Date().getFullYear()) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetToCurrentMonth}
                          className="h-7 sm:h-8 px-2 text-xs text-purple-700 border-purple-200 hover:bg-purple-50 cursor-pointer"
                        >
                          Về tháng này
                        </Button>
                      )}

                      {/* Toggle Lịch vs Danh sách */}
                      <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                        <Button
                          variant={scheduleViewMode === "calendar" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setScheduleViewMode("calendar")}
                          className={`h-7 px-2 sm:px-2.5 text-xs font-semibold cursor-pointer ${
                            scheduleViewMode === "calendar" ? "bg-purple-600 hover:bg-purple-700 text-white shadow-2xs" : "text-slate-600"
                          }`}
                        >
                          <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                          Lịch tháng
                        </Button>
                        <Button
                          variant={scheduleViewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setScheduleViewMode("list")}
                          className={`h-7 px-2 sm:px-2.5 text-xs font-semibold cursor-pointer ${
                            scheduleViewMode === "list" ? "bg-purple-600 hover:bg-purple-700 text-white shadow-2xs" : "text-slate-600"
                          }`}
                        >
                          <ListFilter className="h-3.5 w-3.5 mr-1" />
                          Danh sách
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Thống kê tóm tắt tháng */}
                  {monthlyScheduleData?.summary && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-3">
                      <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[11px] sm:text-xs py-0.5 px-2">
                        Dự kiến: <strong className="ml-1">{monthlyScheduleData.summary.totalScheduledDays}</strong> buổi
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[11px] sm:text-xs py-0.5 px-2">
                        Lịch đặc biệt: <strong className="ml-1">{monthlyScheduleData.summary.totalSpecialMealDays}</strong> buổi
                      </Badge>
                      {monthlyScheduleData.summary.totalCanceledDays > 0 && (
                        <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-200 text-[11px] sm:text-xs py-0.5 px-2">
                          Đã cắt suất: <strong className="ml-1">{monthlyScheduleData.summary.totalCanceledDays}</strong> buổi
                        </Badge>
                      )}
                      {monthlyScheduleData.summary.totalPendingCanceledDays > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] sm:text-xs py-0.5 px-2">
                          Chờ duyệt cắt: <strong className="ml-1">{monthlyScheduleData.summary.totalPendingCanceledDays}</strong> buổi
                        </Badge>
                      )}
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] sm:text-xs py-0.5 px-2.5 font-bold sm:ml-auto">
                        Thực tế ăn: {monthlyScheduleData.summary.totalMealDays} buổi
                      </Badge>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {loadingSchedule ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600 mb-2" />
                      <p className="text-xs">Đang tải lịch ăn...</p>
                    </div>
                  ) : scheduleViewMode === "calendar" ? (
                    /* CHẾ ĐỘ LỊCH THÁNG (GRID) */
                    <div className="space-y-2">
                      {/* Tiêu đề 7 thứ trong tuần */}
                      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"].map((dayName, idx) => (
                          <div
                            key={idx}
                            className={`py-1.5 rounded-md ${
                              idx >= 5 ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400" : "bg-slate-100/70 dark:bg-slate-800"
                            }`}
                          >
                            {dayName}
                          </div>
                        ))}
                      </div>

                      {/* Các ô ngày */}
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {(() => {
                          const days = monthlyScheduleData?.days || [];
                          if (days.length === 0) return null;

                          // Tính số ô đệm trước ngày 1
                          const firstDow = days[0].dow; // 0=CN, 1=T2..6=T7
                          const paddingCount = firstDow === 0 ? 6 : firstDow - 1;

                          const gridItems: React.ReactNode[] = [];
                          for (let p = 0; p < paddingCount; p++) {
                            gridItems.push(
                              <div
                                key={`pad-${p}`}
                                className="min-h-[85px] sm:min-h-[105px] rounded-lg bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200/60 dark:border-slate-800/40"
                              />
                            );
                          }

                          days.forEach((day: any) => {
                            gridItems.push(
                              <div
                                key={day.dateStr}
                                className={`min-h-[85px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-lg border transition-all flex flex-col justify-between ${
                                  day.isToday
                                    ? "ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-950/30 border-purple-300"
                                    : day.hasMeal
                                    ? day.mealCategory === "SPECIAL"
                                      ? "bg-orange-50/30 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"
                                      : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700"
                                    : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-400"
                                }`}
                              >
                                {/* Header ô ngày */}
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-bold ${
                                      day.isToday
                                        ? "h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px]"
                                        : day.isSunday
                                        ? "text-rose-500"
                                        : "text-slate-800 dark:text-slate-200"
                                    }`}
                                  >
                                    {day.dayNum}
                                  </span>
                                  {day.isToday && (
                                    <span className="hidden sm:inline-block text-[9px] font-bold text-purple-700 bg-purple-100 dark:bg-purple-900/60 px-1 py-0.2 rounded">
                                      Hôm nay
                                    </span>
                                  )}
                                </div>

                                {/* Body ô ngày */}
                                <div className="space-y-1 my-1">
                                  {day.hasMeal ? (
                                    <>
                                      {/* Tên lịch & ca ăn: Lớp thường xanh chữ trắng, Lớp đặc biệt cam chữ trắng */}
                                      {day.mealCategory === "SPECIAL" ? (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] sm:text-[11px] font-semibold shadow-2xs">
                                          <span className="px-1 py-0 rounded bg-black/20 text-[9px] font-bold shrink-0">
                                            {day.shift === "TIET_4" ? "T4" : "T5"}
                                          </span>
                                          <span className="truncate" title={day.scheduleName}>{day.scheduleName}</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] sm:text-[11px] font-semibold shadow-2xs">
                                          <span className="px-1 py-0 rounded bg-black/20 text-[9px] font-bold shrink-0">
                                            {day.shift === "TIET_4" ? "T4" : "T5"}
                                          </span>
                                          <span className="truncate" title={day.scheduleName}>Lớp thường</span>
                                        </div>
                                      )}

                                      {/* Sân ăn: Bỏ icon MapPin, hiển thị nhãn gọn */}
                                      {day.court ? (
                                        <div className="text-[10px] font-extrabold text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 truncate">
                                          {day.court.courtName} {day.court.cartName ? `(${day.court.cartName})` : ""}
                                        </div>
                                      ) : (
                                        <div className="text-[9px] text-slate-400 italic">
                                          Chưa phân sân
                                        </div>
                                      )}

                                      {/* Trạng thái cắt suất nếu có */}
                                      {day.cancellation && (
                                        <div>
                                          <Badge
                                            variant="outline"
                                            className={`text-[8.5px] px-1 py-0 leading-tight block truncate font-bold ${
                                              day.cancellation.status === "APPROVED"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 line-through"
                                                : day.cancellation.status === "PENDING"
                                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                                : "bg-rose-50 text-rose-700 border-rose-300"
                                            }`}
                                            title={day.cancellation.cancellationNote}
                                          >
                                            {day.cancellation.cancellationNote}
                                          </Badge>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 text-center py-1">
                                      {day.isSunday ? "Chủ Nhật" : "Không ăn"}
                                    </div>
                                  )}
                                </div>

                                {/* Footer ô ngày: Đổi món nếu có */}
                                {day.hasMeal && day.isMealOverridden && (
                                  <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                                    {day.mealTypeName}
                                  </div>
                                )}
                              </div>
                            );
                          });

                          return gridItems;
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* CHẾ ĐỘ DANH SÁCH CHI TIẾT (LIST) */
                    <div className="space-y-2">
                      {(() => {
                        const daysWithMeal = (monthlyScheduleData?.days || []).filter((d: any) => d.hasMeal);
                        if (daysWithMeal.length === 0) {
                          return (
                            <div className="py-8 text-center text-slate-400 text-xs">
                              Tháng này không có ngày nào có lịch ăn bán trú.
                            </div>
                          );
                        }

                        return (
                          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-2xs">
                            <Table className="w-full text-xs min-w-[500px]">
                              <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                                <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-slate-700">
                                  {/* Cột Ngày ăn - Cố định (Sticky) */}
                                  <TableHead className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-slate-100 w-[95px] min-w-[95px] sm:w-[110px] sm:min-w-[110px] px-2.5 py-2.5 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                                    Ngày ăn
                                  </TableHead>
                                  <TableHead className="w-[65px] min-w-[65px] sm:w-[75px] text-center font-semibold text-xs px-1.5 py-2.5">
                                    Thứ
                                  </TableHead>
                                  <TableHead className="min-w-[140px] font-semibold text-xs px-2.5 py-2.5">
                                    Lịch học & Ca ăn
                                  </TableHead>
                                  <TableHead className="min-w-[105px] text-center font-semibold text-xs px-2 py-2.5">
                                    Vị trí Sân ăn
                                  </TableHead>
                                  <TableHead className="min-w-[115px] text-center font-semibold text-xs px-2 py-2.5">
                                    Suất ăn & Món
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {daysWithMeal.map((day: any) => (
                                  <TableRow
                                    key={day.dateStr}
                                    className={`group transition-colors border-b border-slate-100 dark:border-slate-800/60 ${
                                      day.isToday
                                        ? "bg-purple-50/40 dark:bg-purple-950/20 font-semibold"
                                        : "hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                                    }`}
                                  >
                                    {/* Cột Ngày ăn - Cố định (Sticky) */}
                                    <TableCell
                                      className={`sticky left-0 z-10 px-2.5 py-2 font-mono border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${
                                        day.isToday
                                          ? "bg-purple-50 dark:bg-purple-950/70"
                                          : "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80"
                                      }`}
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                          {formatDate(day.dateStr)}
                                        </span>
                                        {day.isToday && (
                                          <span className="inline-block mt-0.5 w-fit bg-purple-600 text-white text-[9px] font-bold px-1 py-0 rounded">
                                            Hôm nay
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>

                                    {/* Thứ */}
                                    <TableCell className="text-center text-xs font-medium text-slate-700 dark:text-slate-300 px-1.5 py-2 whitespace-nowrap">
                                      {day.dowName}
                                    </TableCell>

                                    {/* Lịch học & Ca ăn: Lớp thường màu xanh chữ trắng, Lớp đặc biệt màu cam chữ trắng, bỏ icon */}
                                    <TableCell className="text-xs px-2.5 py-2">
                                      {day.mealCategory === "SPECIAL" ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-600 text-white text-[11px] sm:text-xs font-semibold shadow-2xs whitespace-nowrap">
                                          <span className="px-1 py-0.2 rounded bg-black/20 text-[10px] font-bold shrink-0">
                                            {day.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                                          </span>
                                          <span className="truncate max-w-[130px] sm:max-w-none">{day.scheduleName}</span>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-600 text-white text-[11px] sm:text-xs font-semibold shadow-2xs whitespace-nowrap">
                                          <span className="px-1 py-0.2 rounded bg-black/20 text-[10px] font-bold shrink-0">
                                            {day.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                                          </span>
                                          <span className="truncate max-w-[130px] sm:max-w-none">{day.scheduleName}</span>
                                        </div>
                                      )}
                                    </TableCell>

                                    {/* Vị trí Sân ăn: Bỏ icon MapPin, hiển thị nhãn gọn */}
                                    <TableCell className="text-center text-xs px-2 py-2 whitespace-nowrap">
                                      {day.court ? (
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 font-bold text-xs border border-purple-200 dark:border-purple-800">
                                          {day.court.courtName} {day.court.cartName ? `(${day.court.cartName})` : ""}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-xs italic">Chưa phân sân</span>
                                      )}
                                    </TableCell>

                                    {/* Suất ăn & Món (Gộp 2 cột): "Có ăn" + Món, hoặc Badge Cắt suất */}
                                    <TableCell className="text-center text-xs px-2 py-2 whitespace-nowrap">
                                      {day.cancellation ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] font-bold px-1.5 py-0.5 ${
                                              day.cancellation.status === "APPROVED"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 line-through"
                                                : day.cancellation.status === "PENDING"
                                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                                : "bg-rose-50 text-rose-700 border-rose-300"
                                            }`}
                                          >
                                            {day.cancellation.cancellationNote}
                                          </Badge>
                                          <span className="text-[11px] text-slate-400">
                                            {day.mealTypeName}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center leading-tight">
                                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                                            Có ăn
                                          </span>
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {day.mealTypeName}
                                            {day.isMealOverridden && (
                                              <span className="text-amber-600 font-semibold ml-1">(Đã đổi)</span>
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

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
              ) : (
                <>
                  {/* CẢI TIẾN 1: Thẻ thông báo Tiền thanh toán thừa / Chuyển khoản 2 lần */}
                  {totalTransferSurplus > 0 && (
                    <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50/70 border-2 border-emerald-400/80 rounded-2xl shadow-sm space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Wallet className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-emerald-950 text-sm sm:text-base flex items-center gap-2">
                              Ghi nhận khoản thanh toán thừa / chuyển khoản 2 lần
                            </h4>
                            <p className="text-[11px] text-emerald-800">
                              Hệ thống kế toán và cổng thanh toán đã ghi nhận khoản tiền nộp vượt mức
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 self-start sm:self-center">
                          <span className="text-xs text-emerald-800 font-medium">Tổng tiền dư:</span>
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-3 py-1 shadow-xs">
                            +{formatMoney(totalTransferSurplus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-3 bg-white/90 border border-emerald-200/80 rounded-xl text-xs space-y-2 text-slate-800">
                        <p className="text-[11px] text-emerald-900 leading-relaxed">
                          Quý phụ huynh đã thực hiện chuyển khoản vượt số tiền cần đóng (hoặc quét mã QR thanh toán lặp lại). Toàn bộ số tiền thừa <strong>+{formatMoney(totalTransferSurplus)}</strong> đã được ghi nhận an toàn vào số dư của học sinh <strong>{studentInfo?.user?.fullName}</strong>.
                        </p>
                        <div className="flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-100/50 p-2 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Phương án xử lý:</strong> Số tiền này sẽ được <strong>tự động cấn trừ vào hóa đơn tiền ăn kỳ tiếp theo</strong>, hoặc quý phụ huynh có thể liên hệ kế toán nhà trường để nhận lại số tiền nộp dư.
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết từng hóa đơn nộp thừa */}
                      {overpaidBills.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-emerald-950 block">
                            Chi tiết các hóa đơn có tiền nộp thừa:
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {overpaidBills.map((b) => {
                              const bPaid = (b.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
                              const bExcess = bPaid - Number(b.finalAmount);
                              return (
                                <div key={b.id} className="bg-white/95 p-3 rounded-xl border border-emerald-200/70 text-xs space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                                    <span className="font-bold text-slate-900">
                                      Hóa đơn Tháng {b.month}/{b.year}
                                    </span>
                                    <span className="text-[11px] text-slate-600">
                                      Tiền hóa đơn: <strong>{formatMoney(b.finalAmount)}</strong> | Đã thanh toán: <strong className="text-emerald-700">{formatMoney(bPaid)}</strong>
                                    </span>
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                                      Dư: +{formatMoney(bExcess)}
                                    </Badge>
                                  </div>
                                  {b.transactions && b.transactions.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-500 font-semibold block">
                                        Lịch sử các lần chuyển khoản ghi nhận vào hóa đơn này:
                                      </span>
                                      {b.transactions.map((tx, tidx) => (
                                        <div key={tx.id || tidx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200/60">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-emerald-700">+{formatMoney(tx.amount)}</span>
                                            <span className="text-[10px] text-slate-500">
                                              {new Date(tx.transDate).toLocaleString("vi-VN")}
                                            </span>
                                          </div>
                                          {tx.content && (
                                            <span className="text-[10px] text-slate-600 font-mono truncate max-w-[200px] sm:max-w-xs">
                                              {tx.content}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Giao dịch độc lập chưa gắn bill */}
                      {unlinkedTransactions.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-emerald-950 block">
                            Giao dịch chuyển khoản bổ sung được ghi nhận:
                          </span>
                          <div className="space-y-1.5">
                            {unlinkedTransactions.map((tx, uidx) => (
                              <div key={tx.id || uidx} className="flex items-center justify-between text-xs bg-white/95 p-2.5 rounded-xl border border-emerald-200">
                                <div>
                                  <span className="font-bold text-emerald-700">+{formatMoney(tx.amount)}</span>
                                  <span className="text-[10px] text-slate-500 ml-2">
                                    {new Date(tx.transDate).toLocaleString("vi-VN")}
                                  </span>
                                  {tx.content && (
                                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{tx.content}</p>
                                  )}
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                  Bảo lưu cấn trừ
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CẢI TIẾN 2: Thẻ hiển thị Tiền dư do điều chỉnh Thời khóa biểu */}
                  {scheduleSurplusBills.length > 0 && (
                    <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50/70 border-2 border-indigo-400/80 rounded-2xl shadow-sm space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-indigo-950 text-sm sm:text-base flex items-center gap-2">
                              Tiền ăn dư do điều chỉnh Thời khóa biểu thực tế
                            </h4>
                            <p className="text-[11px] text-indigo-800">
                              Thời khóa biểu thực tế tháng kết thúc có số buổi ăn ít hơn số buổi đã tạm tính trên hóa đơn
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 self-start sm:self-center">
                          <span className="text-xs text-indigo-800 font-medium">Tổng tiền dư TKB:</span>
                          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-3 py-1 shadow-xs">
                            +{formatMoney(totalScheduleSurplus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {scheduleSurplusBills.map((sb) => {
                          const reducedDays = Math.abs(sb.liveScheduleDelta || 0);
                          return (
                            <div key={sb.id} className="p-3.5 bg-white/90 border border-indigo-200 rounded-xl space-y-2.5 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                    Hóa đơn Tháng {sb.month}/{sb.year}
                                  </span>
                                  <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">
                                    Đã thanh toán đủ
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-indigo-900 font-bold">
                                  Tiền dư bảo lưu: <span className="text-sm font-extrabold text-indigo-700">+{formatMoney(sb.liveEstimatedSurplus || 0)}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block text-[10px]">Số buổi đã tính & nộp:</span>
                                  <span className="font-bold text-slate-800">{sb.scheduleMealDays} buổi ({formatMoney(sb.finalAmount)})</span>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block text-[10px]">TKB thực tế sau cập nhật:</span>
                                  <span className="font-bold text-indigo-700">{sb.liveActualDays} buổi <span className="text-rose-600 font-normal">(-{reducedDays} buổi)</span></span>
                                </div>
                                <div className="p-2 bg-indigo-50/70 rounded-lg border border-indigo-100 col-span-2 sm:col-span-1">
                                  <span className="text-indigo-700 block text-[10px]">Đơn giá / buổi:</span>
                                  <span className="font-bold text-indigo-950">{formatMoney(sb.unitPrice)}</span>
                                </div>
                              </div>

                              <div className="p-2.5 bg-indigo-50/80 border border-indigo-200/70 rounded-lg flex items-start gap-2 text-[11px] text-indigo-950">
                                <ArrowRight className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong>Quy trình đối soát tự động:</strong> Khoản tiền dư <strong>+{formatMoney(sb.liveEstimatedSurplus || 0)}</strong> ({reducedDays} suất ăn chưa dùng) sẽ được hệ thống <strong>tự động trừ trực tiếp vào Phiếu báo tiền ăn Tháng {sb.nextMonth}/{sb.nextYear}</strong> (mục <i>'Bù trừ giảm từ tháng trước'</i>). Quý phụ huynh không cần làm thủ tục hoàn tiền.
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Trạng thái công nợ: Không có nợ hoặc Danh sách các phiếu còn nợ */}
                  {debtBills.length === 0 ? (
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
                        ) : totalTransferSurplus > 0 || scheduleSurplusBills.length > 0 ? (
                          `Học sinh ${studentInfo?.user?.fullName || ""} hiện không có phiếu báo tiền ăn nào còn nợ. Các khoản thanh toán thừa hoặc tiền dư do điều chỉnh thời khóa biểu đã được ghi nhận chi tiết ở phía trên.`
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
            </>
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
                            <span className="font-bold text-emerald-700">
                              +{formatMoney(paidAmount - billTotal)} (Đã ghi nhận thừa)
                            </span>
                          ) : (
                            <span className={`font-bold ${isPaid ? "text-slate-400" : "text-rose-600"}`}>
                              {formatMoney(Math.max(0, billTotal - paidAmount))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Banner ghi nhận nộp thừa / chuyển khoản 2 lần */}
                      {paidAmount > billTotal && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-900 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <Wallet className="h-3.5 w-3.5 text-emerald-700" />
                              Phát hiện nộp thừa / chuyển khoản 2 lần:
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              Thừa +{formatMoney(paidAmount - billTotal)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-emerald-800">
                            Hóa đơn có tổng tiền {formatMoney(billTotal)}, phụ huynh đã chuyển khoản tổng cộng {formatMoney(paidAmount)}. Số tiền nộp thừa <strong>+{formatMoney(paidAmount - billTotal)}</strong> đã được ghi nhận trên hệ thống và sẽ được tự động cấn trừ kỳ sau hoặc hoàn trả theo yêu cầu.
                          </p>
                        </div>
                      )}

                      {/* Banner ghi nhận điều chỉnh Thời khóa biểu thực tế */}
                      {isPaid && typeof bill.liveScheduleDelta === "number" && bill.liveScheduleDelta < 0 && (bill.liveEstimatedSurplus || 0) > 0 && (
                        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-indigo-900 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              Điều chỉnh số buổi theo TKB thực tế:
                            </span>
                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px]">
                              Dư +{formatMoney(bill.liveEstimatedSurplus || 0)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-indigo-900">
                            Hóa đơn đã thanh toán {bill.scheduleMealDays} buổi. Thời khóa biểu thực tế cập nhật cuối tháng chỉ còn <strong>{bill.liveActualDays} buổi</strong> (giảm {Math.abs(bill.liveScheduleDelta)} buổi). Số tiền ăn dư <strong>+{formatMoney(bill.liveEstimatedSurplus || 0)}</strong> sẽ được hệ thống <strong>tự động trừ trực tiếp vào hóa đơn Tháng {bill.nextMonth}/{bill.nextYear}</strong>.
                          </p>
                        </div>
                      )}

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
