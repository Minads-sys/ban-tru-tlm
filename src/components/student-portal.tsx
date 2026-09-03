"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/hooks/use-realtime";
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
} from "lucide-react";
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

interface StudentData {
  id: string;
  studentCode: string;
  boardingCode?: string | null;
  userId: string;
  classId: string;
  mealType: "MAN" | "CHAY" | "CHAO";
  boardingStatus: "ACTIVE" | "CANCELLED" | "SUSPENDED";
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
  netPayableDays: number;
  unitPrice: string | number;
  totalAmount: string | number;
  previousDeduction: string | number;
  finalAmount: string | number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "SETTLED";
  qrCodeUrl: string | null;
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

  // States for Cancel Form
  const [cancelDate, setCancelDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [ignoreCutoff, setIgnoreCutoff] = useState<boolean>(false);
  const [submittingCancel, setSubmittingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // States for Override Form
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideMealType, setOverrideMealType] = useState<string>("MAN");
  const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
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
      const res = await fetch(`/api/billing?studentId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setBills(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  useEffect(() => {
    if (studentId) {
      fetchStudentInfo(studentId);
      fetchCancellations(studentId);
      fetchOverrides(studentId);
      fetchBills(studentId);
    } else if (status !== "loading") {
      setLoadingStudent(false);
      setLoadingCancellations(false);
      setLoadingOverrides(false);
      setLoadingBills(false);
    }
  }, [studentId, status, fetchStudentInfo, fetchCancellations, fetchOverrides, fetchBills]);

  // Realtime: tự cập nhật khi trạng thái cắt suất, đổi món hoặc hóa đơn thay đổi
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
    onChanged: () => { if (studentId) fetchBills(studentId); },
  });

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !cancelDate || !reason.trim()) return;

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
          ignoreCutoff,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCancelSuccess(data.message || "Gửi yêu cầu thành công");
        setCancelDate("");
        setReason("");
        fetchCancellations(studentId);
      } else {
        setCancelError(data.error || "Có lỗi xảy ra, vui lòng thử lại");
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
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md py-3 -mt-3 mb-2 -mx-4 px-4 sm:mx-0 sm:px-4 sm:py-4 sm:-mt-4 sm:mb-4 sm:rounded-lg border-b sm:border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TRANG THÔNG TIN SUẤT ĂN BÁN TRÚ</h1>
        <p className="text-sm text-slate-500 mt-1">
          <span className="font-semibold text-blue-600">{studentInfo?.user?.fullName || session?.user?.name}</span> {studentInfo?.class?.name ? `- Lớp: ${studentInfo.class.name}` : studentInfo?.classId ? `- Lớp: ${studentInfo.classId}` : ''}
        </p>
      </div>

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

      <Tabs defaultValue="cancel" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-slate-200">
          <TabsTrigger value="cancel" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-600 font-medium data-[state=active]:shadow-sm">
            <Calendar className="h-4 w-4 mr-2" />
            {readOnly ? 'Lịch sử Cắt suất' : 'Cắt suất ăn'}
          </TabsTrigger>
          <TabsTrigger value="override" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-600 font-medium data-[state=active]:shadow-sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {readOnly ? 'Lịch sử Đổi món' : 'Thay đổi món ăn'}
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-600 font-medium data-[state=active]:shadow-sm">
            <Receipt className="h-4 w-4 mr-2" />
            Tiền ăn & Thanh toán
          </TabsTrigger>
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
                    Chọn ngày muốn cắt suất/đổi món ăn. Học sinh phải có lịch ăn bán trú vào ngày này và chỉ được cắt suất/đổi món trong tuần hiện tại, hệ thống sẽ mở tuần kế tiếp vào thứ Bảy
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
                        onChange={(e) => {
                           const d = new Date(e.target.value);
                           if (d.getDay() === 0) {
                             alert("Chủ nhật không có lịch ăn bán trú.");
                             setCancelDate("");
                             return;
                           }
                           setCancelDate(e.target.value);
                        }}
                        required
                        className="bg-white"
                      />
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
                    
                    {/* Nút ẩn bỏ qua giờ chốt (dành cho Test) */}
                    <div className="flex items-center space-x-2 bg-amber-50 p-2 rounded border border-amber-200">
                      <input 
                        type="checkbox" 
                        id="ignoreCutoffCancel" 
                        checked={ignoreCutoff}
                        onChange={(e) => setIgnoreCutoff(e.target.checked)}
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="ignoreCutoffCancel" className="text-xs font-medium text-amber-800 cursor-pointer">
                        Bỏ qua giờ chốt (Dành cho Test)
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingCancel || !cancelDate || !reason.trim()}
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
                      Chọn ngày muốn cắt suất/đổi món ăn. Học sinh phải có lịch ăn bán trú vào ngày này và chỉ được cắt suất/đổi món trong tuần hiện tại, hệ thống sẽ mở tuần kế tiếp vào thứ Bảy
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
                           const val = e.target.value;
                           if (!val) {
                             setOverrideDate("");
                             return;
                           }
                           const d = new Date(val);
                           if (d.getDay() === 0) {
                             alert("Chủ nhật không có lịch ăn bán trú.");
                             setOverrideDate("");
                             return;
                           }
                           
                           // Check against active cancellations
                           const hasCancellation = cancellations.some(c => {
                             if (c.status === "REJECTED") return false;
                             const cd = new Date(c.cancelDate);
                             const cdStr = `${cd.getUTCFullYear()}-${String(cd.getUTCMonth() + 1).padStart(2, '0')}-${String(cd.getUTCDate()).padStart(2, '0')}`;
                             return cdStr === val;
                           });
                           
                           if (hasCancellation) {
                             alert("Học sinh đang có yêu cầu cắt suất vào ngày này (chưa bị từ chối), không thể đổi món.");
                             setOverrideDate("");
                             return;
                           }
                           
                           setOverrideDate(val);
                        }}
                        required
                        className="bg-white"
                      />
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
                      disabled={submittingOverride || !overrideDate}
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

          {/* TAB 3: TIỀN ĂN & THANH TOÁN */}
          <TabsContent value="billing">
            <div className="space-y-6">
              {loadingBills ? (
                <Card className="p-8 text-center text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                  Đang tải thông tin tiền ăn...
                </Card>
              ) : bills.length === 0 ? (
                <Card className="p-8 text-center text-slate-400">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50 text-slate-400" />
                  <p className="font-medium text-slate-600">Chưa có thông báo tiền ăn nào</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Nhà trường chưa phát hành hóa đơn tiền ăn cho học sinh.
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {bills.map((bill, index) => {
                    const isLatest = index === 0;
                    const isPaid = bill.paymentStatus === "PAID";
                    const isPartial = bill.paymentStatus === "PARTIAL";

                    return (
                      <Card
                        key={bill.id}
                        className={`overflow-hidden border-2 transition-all ${
                          isLatest
                            ? isPaid
                              ? "border-green-200 bg-green-50/10 shadow-sm"
                              : "border-blue-200 bg-white shadow-md"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <CardHeader className={`border-b pb-4 ${isLatest && !isPaid ? "bg-blue-50/60" : "bg-slate-50"}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg font-bold text-slate-900">
                                  Hóa đơn tiền ăn Tháng {bill.month}/{bill.year}
                                </CardTitle>
                                {isLatest && (
                                  <Badge className="bg-blue-600 text-white text-[10px]">Mới nhất</Badge>
                                )}
                              </div>
                              <CardDescription className="text-xs mt-0.5">
                                Học sinh: <b>{studentInfo?.user?.fullName}</b> — Lớp: <b>{studentInfo?.class?.name}</b>
                              </CardDescription>
                            </div>
                            <div>
                              {isPaid ? (
                                <Badge className="bg-green-100 text-green-700 border-green-300 font-semibold px-3 py-1 flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5" /> Đã thanh toán
                                </Badge>
                              ) : isPartial ? (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold px-3 py-1 flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" /> Đã thanh toán một phần
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 border-rose-300 font-semibold px-3 py-1 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> Chưa thanh toán
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-5 space-y-6">
                          {/* Bảng chi tiết tính tiền */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block">Số ngày ăn dự kiến:</span>
                              <span className="text-base font-bold text-slate-800">{bill.scheduleMealDays} ngày</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block">Đã duyệt cắt suất:</span>
                              <span className="text-base font-bold text-rose-600">{bill.canceledDays} ngày</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-500 block">Trừ tiền tháng trước:</span>
                              <span className="text-base font-bold text-amber-600">
                                -{new Intl.NumberFormat("vi-VN").format(Number(bill.previousDeduction))}đ
                              </span>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <span className="text-blue-700 font-medium block">Số tiền cần nộp:</span>
                              <span className="text-base font-extrabold text-blue-900">
                                {new Intl.NumberFormat("vi-VN").format(Number(bill.finalAmount))}đ
                              </span>
                            </div>
                          </div>

                          {/* Khung quét mã VietQR nếu chưa thanh toán */}
                          {!isPaid && Number(bill.finalAmount) > 0 && (
                            <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-6">
                              {/* QR Code */}
                              {bill.qrCodeUrl && (
                                <div className="shrink-0 flex flex-col items-center bg-white p-3 rounded-lg border border-blue-100 shadow-xs">
                                  <img
                                    src={bill.qrCodeUrl}
                                    alt="QR Thanh toán Tiền ăn"
                                    className="w-44 h-44 object-contain"
                                    loading="eager"
                                  />
                                  <span className="text-[11px] text-blue-600 font-medium mt-1">
                                    Quét bằng app ngân hàng
                                  </span>
                                </div>
                              )}

                              {/* Hướng dẫn và thông tin chuyển khoản */}
                              <div className="flex-1 space-y-3 w-full text-xs">
                                <div className="space-y-1">
                                  <h4 className="font-bold text-sm text-slate-800 uppercase flex items-center gap-1.5">
                                    <CreditCard className="h-4 w-4 text-blue-600" />
                                    Hướng dẫn Chuyển khoản Tự động gạch nợ
                                  </h4>
                                  <p className="text-slate-600 text-[11px]">
                                    Quý phụ huynh mở app Ngân hàng (MB, Vietcombank, Techcombank, BIDV...) quét mã QR trên để hệ thống tự động gạch nợ trong vòng <b>1-3 giây</b>.
                                  </p>
                                </div>

                                <div className="space-y-2 pt-1">
                                  <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Ngân hàng nhận:</span>
                                      <span className="font-semibold text-slate-800">BIDV</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Số tài khoản:</span>
                                      <span className="font-mono font-bold text-slate-900 text-sm">96247BANTRUTLM08</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
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

                                  <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                    <div>
                                      <span className="text-slate-400 block text-[10px]">Chủ tài khoản:</span>
                                      <span className="font-semibold text-slate-800">HOANG KIM</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
                                    <div>
                                      <span className="text-amber-700 block text-[10px] font-bold">
                                        NỘI DUNG CHUYỂN KHOẢN BẮT BUỘC:
                                      </span>
                                      <span className="font-mono font-extrabold text-blue-700 text-sm">
                                        BSTLM {studentInfo?.boardingCode || studentInfo?.studentCode} T{String(bill.month).padStart(2, '0')}{String(bill.year).slice(-2)}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-blue-700 hover:bg-blue-100"
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
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}
