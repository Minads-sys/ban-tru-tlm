'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Coins,
  Receipt,
  FileText,
  Phone,
  School,
  Utensils,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Clock,
  Sparkles,
  Edit,
  Trash2,
  Download,
  KeyRound,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { StudentPortal } from '@/components/student-portal';
import { useRealtime } from '@/hooks/use-realtime';

interface StudentItem {
  id: string;
  studentCode: string;
  boardingCode?: string | null;
  userId: string;
  classId: string;
  birthDate: string | null;
  gender: 'MALE' | 'FEMALE';
  mealType: 'MAN' | 'CHAY' | 'CHAO';
  boardingStatus: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED';
  boardingRegisteredAt: string | null;
  boardingCancelledAt: string | null;
  parentPhone: string | null;
  user: {
    fullName: string;
    username: string;
    isActive: boolean;
  };
  class: {
    name: string;
  };
}

interface SettlementResult {
  totalPaid: number;
  actualUsedAmount: number;
  refundOrDebt: number;
  type: 'REFUND' | 'ADDITIONAL_PAYMENT' | 'BALANCED';
}

function formatCurrency(amount: number | string): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(num);
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Cancel dialog states
  const [cancellingStudent, setCancellingStudent] = useState<StudentItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Settlement modal state
  const [settlementData, setSettlementData] = useState<{
    student: StudentItem;
    settlement: SettlementResult;
  } | null>(null);

  // Activate dialog states
  const [activatingStudent, setActivatingStudent] = useState<StudentItem | null>(null);
  const [isSubmittingActivate, setIsSubmittingActivate] = useState<boolean>(false);

  // Viewing student portal state
  const [viewingStudent, setViewingStudent] = useState<StudentItem | null>(null);

  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    studentCode: '',
    boardingCode: '',
    fullName: '',
    classId: '',
    mealType: 'MAN',
    parentPhone: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Create student states
  const [creatingStudent, setCreatingStudent] = useState<boolean>(false);
  const [createFormData, setCreateFormData] = useState({
    studentCode: '',
    boardingCode: '',
    fullName: '',
    classId: '',
    mealType: 'MAN',
    parentPhone: '',
    gender: 'NAM',
    birthDate: '',
    generateBill: true,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Delete dialog states
  const [deletingStudent, setDeletingStudent] = useState<StudentItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);
  const [resettingPasswordStudent, setResettingPasswordStudent] = useState<StudentItem | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState<boolean>(false);

  // Alerts
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Fetch students from API
  const fetchStudents = useCallback(async (classIdParam: string, statusParam: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (classIdParam && classIdParam !== 'ALL') {
        params.append('classId', classIdParam);
      }
      if (statusParam && statusParam !== 'ALL') {
        params.append('status', statusParam);
      }

      const queryString = params.toString();
      const url = `/api/students${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Không thể tải danh sách học sinh');
      }

      const data: StudentItem[] = await res.json();
      setStudents(data);
    } catch (err) {
      console.error('Fetch students error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tải danh sách học sinh',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and fetch on filter change
  useEffect(() => {
    fetchStudents(selectedClass, selectedStatus);
  }, [selectedClass, selectedStatus, fetchStudents]);

  // Realtime: tự cập nhật khi có thay đổi trên bảng students
  useRealtime({
    table: 'students',
    event: '*',
    onChanged: () => fetchStudents(selectedClass, selectedStatus),
  });

  // Extract distinct class list from students for filter dropdown
  const classOptions = useMemo(() => {
    const classSet = new Set<string>();
    students.forEach((s) => {
      if (s.classId) classSet.add(s.classId);
    });
    // Add some common classes if empty
    return Array.from(classSet).sort();
  }, [students]);

  // Filter students by search term (Mã HS, Mã Bán Trú, Tên HS)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.studentCode.toLowerCase().includes(q) ||
        (s.boardingCode && s.boardingCode.toLowerCase().includes(q)) ||
        s.user.fullName.toLowerCase().includes(q) ||
        s.user.username.toLowerCase().includes(q) ||
        (s.parentPhone && s.parentPhone.includes(q))
    );
  }, [students, searchQuery]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClass, selectedStatus]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  // Statistics counters
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.boardingStatus === 'ACTIVE').length;
    const cancelled = students.filter((s) => s.boardingStatus === 'CANCELLED').length;
    const suspended = students.filter((s) => s.boardingStatus === 'SUSPENDED').length;
    return { total, active, cancelled, suspended };
  }, [students]);

  // Handle Cancel Boarding Action
  const handleConfirmCancel = async () => {
    if (!cancellingStudent) return;
    setIsSubmittingCancel(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          studentId: cancellingStudent.id,
          note: cancelReason.trim() || 'Hủy đăng ký ăn bán trú theo yêu cầu',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi hủy bán trú');
      }

      // Close cancel confirmation dialog
      const targetStudent = cancellingStudent;
      setCancellingStudent(null);
      setCancelReason('');

      // Show settlement popup if returned
      if (data.settlement) {
        setSettlementData({
          student: targetStudent,
          settlement: data.settlement,
        });
      }

      setStatusMessage({
        type: 'success',
        text: data.message || `Đã hủy bán trú thành công cho học sinh ${targetStudent.user.fullName}`,
      });

      // Refresh list
      await fetchStudents(selectedClass, selectedStatus);
    } catch (err) {
      console.error('Cancel boarding error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi xảy ra khi hủy bán trú',
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Handle Activate Boarding Action
  const handleConfirmActivate = async () => {
    if (!activatingStudent) return;
    setIsSubmittingActivate(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          studentId: activatingStudent.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi kích hoạt bán trú');
      }

      const studentName = activatingStudent.user.fullName;
      setActivatingStudent(null);

      setStatusMessage({
        type: 'success',
        text: data.message || `Đã mở lại bán trú cho học sinh ${studentName}`,
      });

      // Refresh list
      await fetchStudents(selectedClass, selectedStatus);
    } catch (err) {
      console.error('Activate boarding error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi xảy ra khi kích hoạt bán trú',
      });
    } finally {
      setIsSubmittingActivate(false);
    }
  };

  const handleEditClick = (student: StudentItem) => {
    setEditingStudent(student);
    setEditFormData({
      studentCode: student.studentCode || '',
      boardingCode: student.boardingCode || '',
      fullName: student.user.fullName || '',
      classId: student.classId,
      mealType: student.mealType || 'MAN',
      parentPhone: student.parentPhone || '',
    });
  };

  const handleConfirmEdit = async () => {
    if (!editingStudent) return;
    setIsSubmittingEdit(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingStudent.id,
          ...editFormData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi cập nhật học sinh');
      }

      setEditingStudent(null);
      setStatusMessage({ type: 'success', text: data.message || 'Cập nhật thành công' });
      await fetchStudents(selectedClass, selectedStatus);
    } catch (err) {
      console.error('Update student error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi xảy ra',
      });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmCreate = async () => {
    setIsSubmittingCreate(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...createFormData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi đăng ký học sinh mới');
      }

      setCreatingStudent(false);
      setCreateFormData({
        studentCode: '',
        boardingCode: '',
        fullName: '',
        classId: '',
        mealType: 'MAN',
        parentPhone: '',
        gender: 'NAM',
        birthDate: '',
        generateBill: true,
      });
      setStatusMessage({ type: 'success', text: data.message || 'Đăng ký học sinh mới thành công' });
      await fetchStudents(selectedClass, selectedStatus);
    } catch (err) {
      console.error('Create student error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo',
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Delete Action
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsSubmittingDelete(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/students?studentId=${deletingStudent.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa học sinh');

      setStatusMessage({ type: 'success', text: data.message || 'Xóa thành công' });
      setDeletingStudent(null);
      await fetchStudents(selectedClass, selectedStatus);
    } catch (err) {
      console.error('Delete student error:', err);
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Có lỗi xảy ra' });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingPasswordStudent) return;
    setIsSubmittingReset(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/students/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resettingPasswordStudent.userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi khôi phục mật khẩu');

      setStatusMessage({ type: 'success', text: 'Khôi phục mật khẩu về ngày sinh thành công' });
      setResettingPasswordStudent(null);
    } catch (err) {
      console.error('Reset password error:', err);
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Có lỗi xảy ra' });
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Render Meal Type Badge
  const renderMealTypeBadge = (mealType: string) => {
    switch (mealType) {
      case 'CHAY':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-medium">
            Suất Chay
          </Badge>
        );
      case 'CHAO':
        return (
          <Badge className="bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50 text-xs font-medium">
            Suất Cháo
          </Badge>
        );
      case 'MAN':
      default:
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50 text-xs font-medium">
            Suất Mặn
          </Badge>
        );
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-xs font-medium gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Đang ăn bán trú</span>
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 text-xs font-medium gap-1">
            <X className="h-3 w-3 text-rose-600" />
            <span>Đã hủy bán trú</span>
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs font-medium gap-1">
            <Clock className="h-3 w-3 text-amber-600" />
            <span>Tạm ngưng</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs font-medium">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          PAGE HEADER
         ======================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Quản lý Học sinh Bán trú
            </h1>
            <p className="text-sm text-muted-foreground">
              Tra cứu danh sách, thay đổi trạng thái tham gia và tự động quyết toán khi hủy bán trú
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStudents(selectedClass, selectedStatus)}
            disabled={isLoading}
            className="gap-2 border-red-600 text-red-600 hover:bg-red-50 shadow-xs cursor-pointer bg-white"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới danh sách</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.location.href = `/api/excel/export/students?classId=${selectedClass}&status=${selectedStatus}`}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setCreatingStudent(true)}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng ký mới</span>
            <span className="sm:hidden">Mới</span>
          </Button>
        </div>
      </div>

      {/* ========================================================
          NOTIFICATION ALERT
         ======================================================== */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border p-4 text-sm font-medium transition-all ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================
          STATS CARDS
         ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-slate-500">
              Tổng số học sinh
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Dữ liệu trên hệ thống</p>
          </CardContent>
        </Card>

        {/* Active */}
        <Card className="border-emerald-200 bg-emerald-50/20 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-medium text-emerald-800">
              Đang ăn bán trú
            </CardDescription>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">{stats.active}</div>
            <p className="text-[11px] text-emerald-600/90 mt-0.5">Trạng thái ACTIVE</p>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-rose-200 bg-rose-50/20 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-medium text-rose-800">
              Đã hủy bán trú
            </CardDescription>
            <UserMinus className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-rose-700">{stats.cancelled}</div>
            <p className="text-[11px] text-rose-600/90 mt-0.5">Trạng thái CANCELLED</p>
          </CardContent>
        </Card>

        {/* Suspended */}
        <Card className="border-amber-200 bg-amber-50/20 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-xs font-medium text-amber-800">
              Tạm ngưng
            </CardDescription>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-700">{stats.suspended}</div>
            <p className="text-[11px] text-amber-600/90 mt-0.5">Trạng thái SUSPENDED</p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================
          SEARCH & FILTER BAR
         ======================================================== */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Search input */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm theo CCCD, Họ tên, SĐT phụ huynh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            {/* Class filter */}
            <div className="space-y-1">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-10 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <School className="h-4 w-4 text-slate-500 shrink-0" />
                    <SelectValue placeholder="Lọc theo Lớp" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả các lớp</SelectItem>
                  {classOptions.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      Lớp {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-10 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-4 w-4 text-slate-500 shrink-0" />
                    <SelectValue placeholder="Lọc theo Trạng thái" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                  <SelectItem value="ACTIVE">Đang bán trú (ACTIVE)</SelectItem>
                  <SelectItem value="CANCELLED">Đã hủy (CANCELLED)</SelectItem>
                  <SelectItem value="SUSPENDED">Tạm ngưng (SUSPENDED)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Indicator */}
          {(selectedClass !== 'ALL' || selectedStatus !== 'ALL' || searchQuery.trim()) && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Bộ lọc đang áp dụng:</span>
                {selectedClass !== 'ALL' && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    Lớp: {selectedClass}
                  </Badge>
                )}
                {selectedStatus !== 'ALL' && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    Trạng thái: {selectedStatus}
                  </Badge>
                )}
                {searchQuery.trim() && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    Từ khóa: &quot;{searchQuery}&quot;
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedClass('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="h-6 text-xs text-blue-600 hover:text-blue-800 p-0"
              >
                Xóa tất cả bộ lọc
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          STUDENTS DATA TABLE
         ======================================================== */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b bg-slate-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Danh sách học sinh
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Hiển thị {filteredStudents.length} / {students.length} học sinh
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Đang tải danh sách học sinh...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Không tìm thấy học sinh nào phù hợp
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại các bộ lọc lớp/trạng thái.
              </p>
            </div>
          ) : (
            <>
              <Table wrapperClassName="max-h-[65vh]">
                <TableHeader className="sticky top-0 z-10 bg-slate-50 text-xs shadow-sm shadow-slate-200">
                  <TableRow>
                    <TableHead className="w-12 text-center font-semibold text-slate-700">
                      STT
                    </TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700">Mã Bán Trú</TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700">Số CCCD</TableHead>
                    <TableHead className="font-semibold text-slate-700">Họ và tên</TableHead>
                    <TableHead className="w-20 font-semibold text-slate-700">Giới tính</TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700">Ngày sinh</TableHead>
                    <TableHead className="w-24 font-semibold text-slate-700">Lớp</TableHead>
                    <TableHead className="w-28 font-semibold text-slate-700">Loại suất</TableHead>
                    <TableHead className="w-40 font-semibold text-slate-700">Trạng thái</TableHead>
                    <TableHead className="w-36 text-center font-semibold text-slate-700">
                      Thao tác
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedStudents.map((student, index) => (
                    <TableRow
                      key={student.id}
                      className="hover:bg-slate-50/70 transition-colors text-sm"
                    >
                      {/* STT */}
                      <TableCell className="text-center font-medium text-slate-500">
                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </TableCell>

                      {/* Mã Bán Trú */}
                      <TableCell>
                        {student.boardingCode ? (
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {student.boardingCode}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Chưa cấp</span>
                        )}
                      </TableCell>

                      {/* Số CCCD */}
                      <TableCell>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border">
                          {student.studentCode}
                        </span>
                      </TableCell>

                      {/* Họ tên & Thông tin phụ huynh */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div 
                            className="font-semibold text-blue-600 hover:underline cursor-pointer"
                            onClick={() => setViewingStudent(student)}
                          >
                            {student.user?.fullName || 'Chưa cập nhật'}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="text-[11px] text-slate-400">
                              TK: @{student.user?.username}
                            </span>
                            {student.parentPhone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {student.parentPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Giới tính */}
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {student.gender === 'FEMALE' ? 'Nữ' : student.gender === 'MALE' ? 'Nam' : '---'}
                        </span>
                      </TableCell>

                      {/* Ngày sinh */}
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {student.birthDate ? new Date(student.birthDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '---'}
                        </span>
                      </TableCell>

                      {/* Lớp */}
                      <TableCell>
                        <Badge variant="outline" className="bg-white font-medium text-slate-800">
                          {student.class?.name || student.classId}
                        </Badge>
                      </TableCell>

                      {/* Loại suất */}
                      <TableCell>{renderMealTypeBadge(student.mealType)}</TableCell>

                      {/* Trạng thái */}
                      <TableCell>{renderStatusBadge(student.boardingStatus)}</TableCell>

                      {/* Thao tác Buttons */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {student.boardingStatus === 'ACTIVE' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCancellingStudent(student);
                                setCancelReason('');
                              }}
                              className="h-8 px-2.5 text-xs font-medium border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Hủy bán trú</span>
                            </Button>
                          ) : student.boardingStatus === 'CANCELLED' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActivatingStudent(student)}
                              className="h-8 px-2.5 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Mở lại</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActivatingStudent(student)}
                              className="h-8 px-2.5 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Kích hoạt</span>
                            </Button>
                          )}
                          
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Sửa thông tin"
                            onClick={() => handleEditClick(student)}
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200 shadow-2xs cursor-pointer shrink-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Khôi phục mật khẩu (Ngày sinh)"
                            onClick={() => setResettingPasswordStudent(student)}
                            className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 border-slate-200 shadow-2xs cursor-pointer shrink-0"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Xóa học sinh"
                            onClick={() => setDeletingStudent(student)}
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 border-slate-200 shadow-2xs cursor-pointer shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6 mt-2">
                <div className="flex flex-1 justify-between sm:hidden">
                  <Button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                  >
                    Trước
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                  >
                    Sau
                  </Button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Hiển thị <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> trong số <span className="font-medium">{filteredStudents.length}</span> kết quả
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-l-md px-2 py-2 cursor-pointer"
                      >
                        <span className="sr-only">Trang trước</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                      </Button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 focus:outline-offset-0">
                        Trang {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-r-md px-2 py-2 cursor-pointer"
                      >
                        <span className="sr-only">Trang sau</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          DIALOG: CANCEL BOARDING & REASON INPUT
         ======================================================== */}
      <Dialog
        open={Boolean(cancellingStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingStudent(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <UserMinus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Hủy đăng ký bán trú
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Thao tác sẽ khóa tài khoản học sinh và lập phiếu quyết toán tiền ăn
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {cancellingStudent && (
            <div className="space-y-4 py-2">
              {/* Student Summary box */}
              <div className="rounded-lg bg-slate-50 border p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Học sinh:</span>
                  <span className="font-bold text-slate-900">
                    {cancellingStudent.user.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lớp:</span>
                  <span className="font-semibold text-slate-800">
                    {cancellingStudent.class?.name || cancellingStudent.classId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Loại suất:</span>
                  <span className="font-semibold text-slate-800">
                    {cancellingStudent.mealType === 'MAN'
                      ? 'Suất Mặn'
                      : cancellingStudent.mealType === 'CHAY'
                      ? 'Suất Chay'
                      : 'Suất Cháo'}
                  </span>
                </div>
              </div>

              {/* Note / Reason input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cancelReason"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  Lý do hủy bán trú (Ghi chú quyết toán):
                </label>
                <Input
                  id="cancelReason"
                  type="text"
                  placeholder="VD: Chuyển trường, phụ huynh xin tự túc cơm trưa..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              {/* Notice */}
              <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Hệ thống sẽ tự động tính số ngày đã ăn thực tế trong tháng để tạo phiếu quyết toán
                  (hoàn tiền hoặc thu thêm).
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancellingStudent(null);
                setCancelReason('');
              }}
              disabled={isSubmittingCancel}
              className="cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isSubmittingCancel}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 cursor-pointer"
            >
              {isSubmittingCancel ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4" />
                  <span>Xác nhận Hủy bán trú</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          DIALOG: SETTLEMENT RESULT (SHOW AFTER CANCELLATION)
         ======================================================== */}
      <Dialog
        open={Boolean(settlementData)}
        onOpenChange={(open) => {
          if (!open) setSettlementData(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Kết quả Quyết toán Bán trú
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Phiếu quyết toán tiền ăn đã được ghi nhận vào hệ thống
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {settlementData && (
            <div className="space-y-4 py-2">
              {/* Student info */}
              <div className="rounded-lg bg-slate-50 border p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Học sinh:</span>
                  <span className="font-bold text-slate-900">
                    {settlementData.student.user.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lớp:</span>
                  <span className="font-semibold text-slate-800">
                    {settlementData.student.class?.name || settlementData.student.classId}
                  </span>
                </div>
              </div>

              {/* Settlement calculation breakdown */}
              <div className="rounded-lg border p-4 space-y-3 bg-white">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tổng tiền phụ huynh đã đóng trong tháng:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(settlementData.settlement.totalPaid)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tiền ăn thực tế đã sử dụng:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(settlementData.settlement.actualUsedAmount)}
                  </span>
                </div>

                <div className="border-t pt-3">
                  {settlementData.settlement.type === 'REFUND' ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 block mb-1">
                        Hoàn tiền lại cho Phụ huynh
                      </span>
                      <div className="text-2xl font-extrabold text-emerald-700">
                        {formatCurrency(settlementData.settlement.refundOrDebt)}
                      </div>
                      <p className="text-[11px] text-emerald-600 mt-1">
                        (Nhà trường thực hiện chi trả hoàn trả số dư thừa lại cho phụ huynh)
                      </p>
                    </div>
                  ) : settlementData.settlement.type === 'ADDITIONAL_PAYMENT' ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 block mb-1">
                        Phụ huynh cần đóng thêm
                      </span>
                      <div className="text-2xl font-extrabold text-amber-700">
                        {formatCurrency(settlementData.settlement.refundOrDebt)}
                      </div>
                      <p className="text-[11px] text-amber-600 mt-1">
                        (Số tiền còn thiếu cho các ngày học sinh đã ăn bán trú trong tháng)
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3.5 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 block mb-1">
                        Quyết toán Cân bằng (0 VNĐ)
                      </span>
                      <div className="text-xl font-bold text-blue-700">0 VNĐ</div>
                      <p className="text-[11px] text-blue-600 mt-1">
                        Số tiền đã nộp vừa đủ với số ngày ăn thực tế.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSettlementData(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              Đã hiểu và Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          DIALOG: REACTIVATE BOARDING
         ======================================================== */}
      <Dialog
        open={Boolean(activatingStudent)}
        onOpenChange={(open) => {
          if (!open) setActivatingStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Mở lại đăng ký Bán trú
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Kích hoạt lại trạng thái ăn bán trú và mở khóa tài khoản cho học sinh
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activatingStudent && (
            <div className="space-y-3 py-2 text-sm text-slate-700">
              <p>
                Bạn có chắc chắn muốn mở lại quyền tham gia bán trú cho học sinh:
              </p>
              <div className="rounded-lg bg-slate-50 border p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-900">
                    {activatingStudent.user.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lớp:</span>
                  <span className="font-semibold text-slate-800">
                    {activatingStudent.class?.name || activatingStudent.classId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Học sinh sẽ được cập nhật trạng thái ACTIVE và tài khoản đăng nhập sẽ được kích hoạt lại ngay lập tức.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivatingStudent(null)}
              disabled={isSubmittingActivate}
              className="cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleConfirmActivate}
              disabled={isSubmittingActivate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer"
            >
              {isSubmittingActivate ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang kích hoạt...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Xác nhận Kích hoạt</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          DIALOG: CREATE STUDENT
         ======================================================== */}
      <Dialog
        open={creatingStudent}
        onOpenChange={(open) => {
          if (!open) setCreatingStudent(false);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Đăng ký mới</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">Đăng ký học sinh vào hệ thống bán trú</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Họ và Tên (*)</label>
              <Input
                value={createFormData.fullName}
                onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                placeholder="Họ và Tên học sinh"
                className="h-10 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Số CCCD (*)</label>
                <Input
                  value={createFormData.studentCode}
                  onChange={(e) => setCreateFormData({ ...createFormData, studentCode: e.target.value })}
                  placeholder="Số CCCD"
                  className="h-10 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mã Bán Trú</label>
                <Input
                  value={createFormData.boardingCode}
                  onChange={(e) => setCreateFormData({ ...createFormData, boardingCode: e.target.value })}
                  placeholder="Tự động nếu trống"
                  className="h-10 text-sm font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Lớp học (*)</label>
                <Select
                  value={createFormData.classId}
                  onValueChange={(val) => setCreateFormData({ ...createFormData, classId: val })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Chọn lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((cls) => (
                      <SelectItem key={cls} value={cls}>Lớp {cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Loại suất ăn (*)</label>
                <Select
                  value={createFormData.mealType}
                  onValueChange={(val) => setCreateFormData({ ...createFormData, mealType: val })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Chọn loại suất" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAN">Suất Mặn</SelectItem>
                    <SelectItem value="CHAY">Suất Chay</SelectItem>
                    <SelectItem value="CHAO">Suất Cháo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Ngày sinh</label>
                <Input
                  type="date"
                  value={createFormData.birthDate}
                  onChange={(e) => setCreateFormData({ ...createFormData, birthDate: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Giới tính</label>
                <Select
                  value={createFormData.gender}
                  onValueChange={(val) => setCreateFormData({ ...createFormData, gender: val })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAM">Nam</SelectItem>
                    <SelectItem value="NU">Nữ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">SĐT Phụ huynh</label>
              <Input
                value={createFormData.parentPhone}
                onChange={(e) => setCreateFormData({ ...createFormData, parentPhone: e.target.value })}
                placeholder="Số điện thoại"
                className="h-10 text-sm"
              />
            </div>

            <div className="flex items-start space-x-2 pt-2 pb-1">
              <input
                type="checkbox"
                id="generateBill"
                checked={createFormData.generateBill}
                onChange={(e) => setCreateFormData({ ...createFormData, generateBill: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="generateBill"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-800"
                >
                  Tạo hóa đơn thanh toán cho tháng này
                </label>
                <p className="text-[11.5px] text-slate-500">
                  Hệ thống sẽ tính số ngày còn lại trong tháng từ hôm nay để lập hóa đơn. Nếu chưa cần thanh toán ngay, cứ chọn tạo hóa đơn để lưu hệ thống.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button type="button" variant="outline" onClick={() => setCreatingStudent(false)} disabled={isSubmittingCreate}>
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCreate}
              disabled={isSubmittingCreate || !createFormData.fullName || !createFormData.studentCode || !createFormData.classId}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
            >
              {isSubmittingCreate ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span>Đăng ký</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          DIALOG: EDIT STUDENT
         ======================================================== */}
      <Dialog
        open={Boolean(editingStudent)}
        onOpenChange={(open) => {
          if (!open) setEditingStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Sửa thông tin</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">Cập nhật thông tin học sinh</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingStudent && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Mã Bán Trú</label>
                  <Input
                    value={editFormData.boardingCode}
                    onChange={(e) => setEditFormData({ ...editFormData, boardingCode: e.target.value })}
                    placeholder="VD: BT00001"
                    className="h-10 text-sm font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Số CCCD</label>
                  <Input
                    value={editFormData.studentCode}
                    onChange={(e) => setEditFormData({ ...editFormData, studentCode: e.target.value })}
                    placeholder="Số Căn cước công dân"
                    className="h-10 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Họ và Tên</label>
                <Input
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  placeholder="Họ và Tên"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Lớp học</label>
                <Select
                  value={editFormData.classId}
                  onValueChange={(val) => setEditFormData({ ...editFormData, classId: val })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Chọn lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((cls) => (
                      <SelectItem key={cls} value={cls}>Lớp {cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Loại suất ăn</label>
                <Select
                  value={editFormData.mealType}
                  onValueChange={(val) => setEditFormData({ ...editFormData, mealType: val })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Chọn loại suất" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAN">Suất Mặn</SelectItem>
                    <SelectItem value="CHAY">Suất Chay</SelectItem>
                    <SelectItem value="CHAO">Suất Cháo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">SĐT Phụ huynh</label>
                <Input
                  value={editFormData.parentPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })}
                  placeholder="SĐT Phụ huynh"
                  className="h-10 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditingStudent(null)} disabled={isSubmittingEdit}>
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEdit}
              disabled={isSubmittingEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
            >
              {isSubmittingEdit ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Lưu thay đổi</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          DIALOG: DELETE STUDENT
         ======================================================== */}
      <Dialog
        open={Boolean(deletingStudent)}
        onOpenChange={(open) => {
          if (!open) setDeletingStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Xóa Học sinh</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Hành động này không thể hoàn tác
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deletingStudent && (
            <div className="py-2 text-sm text-slate-700 space-y-3">
              <p>Bạn có chắc chắn muốn xóa học sinh <strong>{deletingStudent.user.fullName}</strong> khỏi hệ thống?</p>
              <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-800 border border-red-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>
                  Lưu ý: Nếu học sinh này đã có lịch sử điểm danh hoặc hóa đơn, thao tác xóa có thể không thành công để đảm bảo tính toàn vẹn dữ liệu. Trong trường hợp đó, bạn nên <strong>Hủy bán trú</strong> thay vì Xóa.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeletingStudent(null)} disabled={isSubmittingDelete}>
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isSubmittingDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
            >
              {isSubmittingDelete ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>Xác nhận Xóa</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          RESET PASSWORD DIALOG
         ======================================================== */}
      <Dialog 
        open={Boolean(resettingPasswordStudent)} 
        onOpenChange={(open) => {
          if (!open) setResettingPasswordStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Khôi phục mật khẩu</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Khôi phục mật khẩu về ngày sinh của học sinh
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {resettingPasswordStudent && (
            <div className="py-2 text-sm text-slate-700 space-y-3">
              <p>Bạn có chắc chắn muốn khôi phục mật khẩu của học sinh <strong>{resettingPasswordStudent.user.fullName}</strong>?</p>
              <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Lưu ý: Mật khẩu sẽ được khôi phục về ngày tháng năm sinh (định dạng ddmmyyyy). Học sinh sẽ <strong>bắt buộc phải đổi mật khẩu mới</strong> trong lần đăng nhập tiếp theo.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResettingPasswordStudent(null)} disabled={isSubmittingReset}>
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={isSubmittingReset}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
            >
              {isSubmittingReset ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              <span>Xác nhận khôi phục</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          STUDENT PORTAL DIALOG
         ======================================================== */}
      <Dialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-slate-50 border-none shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-4 border-b border-slate-200">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">
                TRANG THÔNG TIN SUẤT ĂN BÁN TRÚ
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                <span className="font-semibold text-blue-600">{viewingStudent?.user.fullName}</span> {viewingStudent?.class?.name ? `- Lớp: ${viewingStudent.class.name}` : ''}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingStudent(null)}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            {viewingStudent && <StudentPortal forceStudentId={viewingStudent.id} readOnly={true} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
