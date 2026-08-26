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

  useEffect(() => {
    if (studentId) {
      fetchStudentInfo(studentId);
      fetchCancellations(studentId);
      fetchOverrides(studentId);
    } else if (status !== "loading") {
      setLoadingStudent(false);
      setLoadingCancellations(false);
      setLoadingOverrides(false);
    }
  }, [studentId, status, fetchStudentInfo, fetchCancellations, fetchOverrides]);

  // Realtime: tự cập nhật khi trạng thái cắt suất hoặc đổi món thay đổi
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
        <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-slate-200">
          <TabsTrigger value="cancel" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-600 font-medium data-[state=active]:shadow-sm">
            <Calendar className="h-4 w-4 mr-2" />
            {readOnly ? 'Lịch sử Cắt suất' : 'Cắt suất ăn'}
          </TabsTrigger>
          <TabsTrigger value="override" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-600 font-medium data-[state=active]:shadow-sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {readOnly ? 'Lịch sử Đổi món' : 'Thay đổi món ăn'}
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
        </Tabs>
    </div>
  );
}
