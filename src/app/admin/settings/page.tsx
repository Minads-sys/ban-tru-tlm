'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Swal from 'sweetalert2';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  School,
  Clock,
  Calendar,
  Coins,
  MapPin,
  CreditCard,
  Building,
  UserCheck,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Wrench,
  Eye,
  History,
  Receipt,
} from 'lucide-react';

interface SettingsFormState {
  SCHOOL_NAME: string;
  SCHOOL_ADDRESS: string;
  MEAL_UNIT_PRICE: string;
  CUTOFF_TIME: string; // Có thể giữ lại hoặc thay thế bằng MEAL_LOCK_TIME_2
  MEAL_LOCK_TIME_1: string;
  MEAL_LOCK_TIME_1_SUNDAY: string;
  MEAL_LOCK_TIME_2: string;
  SCHOOL_YEAR: string;
  SCHOOL_YEAR_START: string;
  SCHOOL_YEAR_END: string;
  BANK_NAME: string;
  BANK_ACCOUNT_NO: string;
  BANK_ACCOUNT_NAME: string;
  DEFAULT_VISIBLE_DAYS: string;
  SEPAY_WEBHOOK_SECRET: string;
  SEPAY_API_KEY: string;
  SEPAY_ACCOUNT_NO: string;
  STUDENT_PORTAL_MAINTENANCE: string;
  STUDENT_MAINTENANCE_MESSAGE: string;
  STUDENT_SHOW_DEBT_TAB: string;
  STUDENT_SHOW_HISTORY_TAB: string;
}

const VIETNAM_BANKS = [
  "Vietcombank",
  "VietinBank",
  "BIDV",
  "Agribank",
  "MBBank",
  "Techcombank",
  "ACB",
  "VPBank",
  "TPBank",
  "VIB",
  "HDBank",
  "Sacombank",
  "SHB",
  "SeABank",
  "MSB",
  "OCB",
  "DongA Bank",
  "Eximbank",
  "LPBank",
  "Nam A Bank",
  "NCB",
  "VietABank",
  "BaoViet Bank",
  "Kienlongbank",
  "Bac A Bank",
  "Vietbank",
  "Saigonbank",
  "PGBank",
  "OceanBank",
  "CBBank",
  "GPBank",
  "Shinhan Bank",
  "Timo",
  "Cake by VPBank"
];

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState<SettingsFormState>({
    SCHOOL_NAME: '',
    SCHOOL_ADDRESS: '',
    MEAL_UNIT_PRICE: '30000',
    CUTOFF_TIME: '16:30',
    MEAL_LOCK_TIME_1: '16:00',
    MEAL_LOCK_TIME_1_SUNDAY: '19:00',
    MEAL_LOCK_TIME_2: '08:00',
    SCHOOL_YEAR: '2026-2027',
    SCHOOL_YEAR_START: '2026-09-05',
    SCHOOL_YEAR_END: '2027-05-31',
    BANK_NAME: 'MBBank',
    BANK_ACCOUNT_NO: '',
    BANK_ACCOUNT_NAME: '',
    DEFAULT_VISIBLE_DAYS: '["monday", "tuesday", "wednesday", "thursday", "friday"]',
    SEPAY_WEBHOOK_SECRET: '',
    SEPAY_API_KEY: '',
    SEPAY_ACCOUNT_NO: '',
    STUDENT_PORTAL_MAINTENANCE: 'false',
    STUDENT_MAINTENANCE_MESSAGE: '',
    STUDENT_SHOW_DEBT_TAB: 'false',
    STUDENT_SHOW_HISTORY_TAB: 'false',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // States cho Modal Reset Database
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetConfirmText, setResetConfirmText] = useState<string>('');
  const [deleteClasses, setDeleteClasses] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      setResetError('Vui lòng gõ chính xác từ khóa "RESET" để xác nhận.');
      return;
    }
    if (!resetPassword) {
      setResetError('Vui lòng nhập mật khẩu quản trị viên.');
      return;
    }

    try {
      setIsResetting(true);
      setResetError(null);

      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetPassword,
          confirmText: resetConfirmText.trim().toUpperCase(),
          deleteClasses,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowResetModal(false);
        setResetPassword('');
        setResetConfirmText('');
        setDeleteClasses(false);

        Swal.fire({
          title: 'Đặt lại dữ liệu thành công!',
          text: data.message || 'Cơ sở dữ liệu đã được làm mới, sẵn sàng cho năm học mới.',
          icon: 'success',
          confirmButtonText: 'Tải lại trang',
          confirmButtonColor: '#2563eb',
        }).then(() => {
          window.location.reload();
        });
      } else {
        setResetError(data.error || 'Có lỗi xảy ra khi đặt lại dữ liệu.');
      }
    } catch (err) {
      setResetError('Lỗi kết nối mạng, vui lòng thử lại.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/settings');
        if (!res.ok) {
          throw new Error('Không thể tải cài đặt');
        }
        const data = await res.json();
        setFormData((prev) => ({
          ...prev,
          SCHOOL_NAME: data.SCHOOL_NAME ?? prev.SCHOOL_NAME,
          SCHOOL_ADDRESS: data.SCHOOL_ADDRESS ?? prev.SCHOOL_ADDRESS,
          MEAL_UNIT_PRICE: data.MEAL_UNIT_PRICE ?? prev.MEAL_UNIT_PRICE,
          CUTOFF_TIME: data.CUTOFF_TIME ?? prev.CUTOFF_TIME,
          MEAL_LOCK_TIME_1: data.MEAL_LOCK_TIME_1 ?? prev.MEAL_LOCK_TIME_1,
          MEAL_LOCK_TIME_1_SUNDAY: data.MEAL_LOCK_TIME_1_SUNDAY ?? prev.MEAL_LOCK_TIME_1_SUNDAY,
          MEAL_LOCK_TIME_2: data.MEAL_LOCK_TIME_2 ?? prev.MEAL_LOCK_TIME_2,
          SCHOOL_YEAR: data.SCHOOL_YEAR ?? prev.SCHOOL_YEAR,
          SCHOOL_YEAR_START: data.SCHOOL_YEAR_START ?? prev.SCHOOL_YEAR_START,
          SCHOOL_YEAR_END: data.SCHOOL_YEAR_END ?? prev.SCHOOL_YEAR_END,
          BANK_NAME: data.BANK_NAME ?? prev.BANK_NAME,
          BANK_ACCOUNT_NO: data.BANK_ACCOUNT_NO ?? prev.BANK_ACCOUNT_NO,
          BANK_ACCOUNT_NAME: data.BANK_ACCOUNT_NAME ?? prev.BANK_ACCOUNT_NAME,
          DEFAULT_VISIBLE_DAYS: data.DEFAULT_VISIBLE_DAYS ?? prev.DEFAULT_VISIBLE_DAYS,
          SEPAY_WEBHOOK_SECRET: data.SEPAY_WEBHOOK_SECRET ?? prev.SEPAY_WEBHOOK_SECRET,
          SEPAY_API_KEY: data.SEPAY_API_KEY ?? prev.SEPAY_API_KEY,
          SEPAY_ACCOUNT_NO: data.SEPAY_ACCOUNT_NO ?? prev.SEPAY_ACCOUNT_NO,
          STUDENT_PORTAL_MAINTENANCE: data.STUDENT_PORTAL_MAINTENANCE ?? prev.STUDENT_PORTAL_MAINTENANCE,
          STUDENT_MAINTENANCE_MESSAGE: data.STUDENT_MAINTENANCE_MESSAGE ?? prev.STUDENT_MAINTENANCE_MESSAGE,
          STUDENT_SHOW_DEBT_TAB: data.STUDENT_SHOW_DEBT_TAB ?? prev.STUDENT_SHOW_DEBT_TAB,
          STUDENT_SHOW_HISTORY_TAB: data.STUDENT_SHOW_HISTORY_TAB ?? prev.STUDENT_SHOW_HISTORY_TAB,
        }));
      } catch (err) {
        console.error(err);
        setStatusMessage({
          type: 'error',
          text: 'Lỗi khi tải thông tin cài đặt. Vui lòng thử lại sau.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleChange = (field: keyof SettingsFormState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (statusMessage) {
      setStatusMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Lỗi khi lưu cài đặt');
      }

      setStatusMessage({
        type: 'success',
        text: 'Cài đặt hệ thống đã được lưu thành công!',
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu cài đặt',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val: string) => {
    const num = Number(val.replace(/\D/g, ''));
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Cài đặt Hệ thống
              </h1>
              <p className="text-sm text-muted-foreground">
                Quản lý Tên trường, Địa chỉ, Tài khoản Ngân hàng và Cấu hình bán trú
              </p>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-all ${
              statusMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading ? (
          <Card className="flex h-72 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Đang tải cài đặt hệ thống...</p>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CARD 1: Thông tin Nhà trường */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <School className="h-5 w-5 text-blue-600" />
                  Thông tin Nhà trường
                </CardTitle>
                <CardDescription>
                  Tên trường và địa chỉ hiển thị trên tất cả phiếu thu, hóa đơn và báo cáo
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
                {/* Tên trường */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="SCHOOL_NAME" className="flex items-center gap-2 text-sm font-medium">
                    <School className="h-4 w-4 text-slate-500" />
                    Tên Trường (SCHOOL_NAME)
                  </Label>
                  <Input
                    id="SCHOOL_NAME"
                    type="text"
                    placeholder="VD: Trường Tiểu học Thăng Long Mới"
                    value={formData.SCHOOL_NAME}
                    onChange={(e) => handleChange('SCHOOL_NAME', e.target.value)}
                    required
                    className="h-10"
                  />
                </div>

                {/* Địa chỉ trường */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="SCHOOL_ADDRESS" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    Địa chỉ Trường (SCHOOL_ADDRESS)
                  </Label>
                  <Input
                    id="SCHOOL_ADDRESS"
                    type="text"
                    placeholder="VD: 123 Đường Thăng Long Mới, Phường X, Quận Y, Hà Nội"
                    value={formData.SCHOOL_ADDRESS}
                    onChange={(e) => handleChange('SCHOOL_ADDRESS', e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Năm học */}
                <div className="space-y-2">
                  <Label htmlFor="SCHOOL_YEAR" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    Năm Học Hiện Tại
                  </Label>
                  <Input
                    id="SCHOOL_YEAR"
                    type="text"
                    placeholder="VD: 2026-2027"
                    value={formData.SCHOOL_YEAR}
                    onChange={(e) => handleChange('SCHOOL_YEAR', e.target.value)}
                    required
                    className="h-10"
                  />
                </div>

                {/* Ngày Bắt Đầu & Kết Thúc Năm Học */}
                <div className="space-y-2 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="SCHOOL_YEAR_START" className="flex items-center gap-2 text-sm font-medium">
                      Ngày Bắt Đầu Năm Học
                    </Label>
                    <Input
                      id="SCHOOL_YEAR_START"
                      type="date"
                      value={formData.SCHOOL_YEAR_START}
                      onChange={(e) => handleChange('SCHOOL_YEAR_START', e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="SCHOOL_YEAR_END" className="flex items-center gap-2 text-sm font-medium">
                      Ngày Kết Thúc Năm Học
                    </Label>
                    <Input
                      id="SCHOOL_YEAR_END"
                      type="date"
                      value={formData.SCHOOL_YEAR_END}
                      onChange={(e) => handleChange('SCHOOL_YEAR_END', e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Các chức năng Cắt suất, Đổi món và Tạo hóa đơn chỉ được phép thao tác trong khoảng thời gian Năm học này.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CARD 2: Cài đặt Tài khoản Ngân hàng (SePay / VietQR) */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  Tài khoản Ngân hàng Thanh toán (VietQR / SePay)
                </CardTitle>
                <CardDescription>
                  Thông tin tài khoản nhận chuyển khoản thanh toán tiền bán trú từ Phụ huynh
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
                {/* Tên ngân hàng */}
                <div className="space-y-2">
                  <Label htmlFor="BANK_NAME" className="flex items-center gap-2 text-sm font-medium">
                    <Building className="h-4 w-4 text-slate-500" />
                    Ngân Hàng (BANK_NAME)
                  </Label>
                  <Select
                    value={formData.BANK_NAME}
                    onValueChange={(value) => handleChange('BANK_NAME', value)}
                  >
                    <SelectTrigger id="BANK_NAME" className="h-10">
                      <SelectValue placeholder="Chọn Ngân hàng" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIETNAM_BANKS.map((bank) => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Số tài khoản */}
                <div className="space-y-2">
                  <Label htmlFor="BANK_ACCOUNT_NO" className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    Số Tài Khoản (BANK_ACCOUNT_NO)
                  </Label>
                  <Input
                    id="BANK_ACCOUNT_NO"
                    type="text"
                    placeholder="VD: 9999888888"
                    value={formData.BANK_ACCOUNT_NO}
                    onChange={(e) => handleChange('BANK_ACCOUNT_NO', e.target.value)}
                    className="h-10 font-mono font-semibold"
                  />
                </div>

                {/* Tên chủ tài khoản */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="BANK_ACCOUNT_NAME" className="flex items-center gap-2 text-sm font-medium">
                    <UserCheck className="h-4 w-4 text-slate-500" />
                    Tên Chủ Tài Khoản (BANK_ACCOUNT_NAME)
                  </Label>
                  <Input
                    id="BANK_ACCOUNT_NAME"
                    type="text"
                    placeholder="VD: TRUONG TH TLM"
                    value={formData.BANK_ACCOUNT_NAME}
                    onChange={(e) => handleChange('BANK_ACCOUNT_NAME', e.target.value.toUpperCase())}
                    className="h-10 uppercase font-semibold"
                  />
                </div>
              </CardContent>
            </Card>

            {/* CARD 3: Cấu hình Suất ăn & Khóa sổ */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  Cấu hình Đơn giá & Giờ Khóa sổ
                </CardTitle>
                <CardDescription>
                  Ảnh hưởng trực tiếp đến việc tính tiền ăn và thời hạn nhận yêu cầu cắt suất
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
                {/* Giờ chốt dự kiến (Lần 1) */}
                <div className="space-y-2">
                  <Label htmlFor="MEAL_LOCK_TIME_1" className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Giờ Chốt Dự Kiến (Ngày Thường)
                  </Label>
                  <Input
                    id="MEAL_LOCK_TIME_1"
                    type="time"
                    value={formData.MEAL_LOCK_TIME_1}
                    onChange={(e) => handleChange('MEAL_LOCK_TIME_1', e.target.value)}
                    required
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Giờ chốt số lượng dự kiến của ngày hôm trước để báo nhà cung cấp (VD: 16:00).
                  </p>
                </div>

                {/* Giờ chốt dự kiến Chủ Nhật */}
                <div className="space-y-2">
                  <Label htmlFor="MEAL_LOCK_TIME_1_SUNDAY" className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Giờ Chốt Dự Kiến (Chủ Nhật cho T2)
                  </Label>
                  <Input
                    id="MEAL_LOCK_TIME_1_SUNDAY"
                    type="time"
                    value={formData.MEAL_LOCK_TIME_1_SUNDAY}
                    onChange={(e) => handleChange('MEAL_LOCK_TIME_1_SUNDAY', e.target.value)}
                    required
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Giờ chốt số lượng dự kiến vào chiều Chủ Nhật để chuẩn bị cho sáng Thứ 2 (VD: 19:00).
                  </p>
                </div>

                {/* Giờ khóa sổ cắt suất chính thức */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="MEAL_LOCK_TIME_2" className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Giờ Chốt Chính Thức (Hạn Chót Cắt Suất Trong Ngày)
                  </Label>
                  <Input
                    id="MEAL_LOCK_TIME_2"
                    type="time"
                    value={formData.MEAL_LOCK_TIME_2}
                    onChange={(e) => handleChange('MEAL_LOCK_TIME_2', e.target.value)}
                    required
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Thời hạn cuối cùng Phụ huynh có thể gửi yêu cầu cắt suất ăn cho ngày hôm nay (VD: 08:00 sáng).
                  </p>
                </div>

                {/* Đơn giá suất ăn */}
                <div className="space-y-2">
                  <Label htmlFor="MEAL_UNIT_PRICE" className="flex items-center gap-2 text-sm font-medium">
                    <Coins className="h-4 w-4 text-slate-500" />
                    Đơn Giá 1 Suất Ăn (VNĐ)
                  </Label>
                  <Input
                    id="MEAL_UNIT_PRICE"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="30000"
                    value={formData.MEAL_UNIT_PRICE}
                    onChange={(e) => handleChange('MEAL_UNIT_PRICE', e.target.value)}
                    required
                    className="h-10 font-medium"
                  />
                  <p className="text-xs font-semibold text-emerald-700">
                    Hiển thị: {formatCurrency(formData.MEAL_UNIT_PRICE)} / suất
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CARD 4: Hiển thị Thời khóa biểu */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Quy tắc hiển thị Thời khóa biểu
                </CardTitle>
                <CardDescription>
                  Chọn các ngày học mặc định trong tuần để hiển thị khi tạo Thời khóa biểu mới
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Các ngày hiển thị mặc định:</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "monday", label: "Thứ 2" },
                      { id: "tuesday", label: "Thứ 3" },
                      { id: "wednesday", label: "Thứ 4" },
                      { id: "thursday", label: "Thứ 5" },
                      { id: "friday", label: "Thứ 6" },
                      { id: "saturday", label: "Thứ 7" }
                    ].map((day) => {
                      let activeDays: string[] = [];
                      try {
                        activeDays = JSON.parse(formData.DEFAULT_VISIBLE_DAYS || '[]');
                      } catch {}
                      const isActive = activeDays.includes(day.id);
                      
                      return (
                        <Button
                          key={day.id}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          className={isActive ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                          onClick={() => {
                            let newDays = [...activeDays];
                            if (isActive) newDays = newDays.filter(d => d !== day.id);
                            else newDays.push(day.id);
                            handleChange('DEFAULT_VISIBLE_DAYS', JSON.stringify(newDays));
                          }}
                        >
                          {day.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Khi tạo Thời khóa biểu cho một tuần mới, hệ thống sẽ chỉ mở sẵn các cột của các ngày được chọn ở trên. Đối với các tuần có ngoại lệ (như học bù Thứ 7), bạn có thể mở thêm cột trực tiếp trên màn hình Thời khóa biểu.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-3 border-t bg-slate-50/50 p-4">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="min-w-[140px] gap-2 shadow-sm font-medium bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu Tất Cả Cài Đặt
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* CARD 5: Chế độ Bảo trì Cổng Học sinh & Phụ huynh */}
            <Card className={`shadow-sm border-2 transition-all ${
              formData.STUDENT_PORTAL_MAINTENANCE === 'true' 
                ? 'border-amber-400 bg-amber-50/30' 
                : 'border-slate-200 bg-white'
            }`}>
              <CardHeader className={`border-b ${
                formData.STUDENT_PORTAL_MAINTENANCE === 'true' 
                  ? 'bg-amber-50/70 border-amber-200' 
                  : 'bg-card'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Wrench className={`h-5 w-5 ${formData.STUDENT_PORTAL_MAINTENANCE === 'true' ? 'text-amber-600' : 'text-slate-600'}`} />
                      Chế độ Bảo trì Cổng Học sinh & Phụ huynh
                    </CardTitle>
                    <CardDescription>
                      Tạm dừng truy cập của học sinh và phụ huynh khi nhà trường cần rà soát số liệu hoặc bảo trì hệ thống
                    </CardDescription>
                  </div>
                  <div>
                    {formData.STUDENT_PORTAL_MAINTENANCE === 'true' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                        ĐANG BẬT BẢO TRÌ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        ĐANG HOẠT ĐỘNG
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                {/* Công tắc Toggle Switch */}
                <div className={`flex items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                  formData.STUDENT_PORTAL_MAINTENANCE === 'true'
                    ? 'border-amber-300 bg-amber-100/40'
                    : 'border-slate-200 bg-slate-50/80'
                }`}>
                  <div className="space-y-1">
                    <label htmlFor="maintenance-toggle" className="text-sm font-bold text-slate-800 cursor-pointer block">
                      Tạm dừng đường link học sinh (Hiện thông báo bảo trì)
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Khi bật, mọi học sinh truy cập cổng thông tin (/student-login, /student) sẽ thấy màn hình thông báo hệ thống đang bảo trì. 
                      Tài khoản Quản trị viên (Admin) và Cán bộ quản lý vẫn làm việc bình thường.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center pt-1 sm:pt-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="maintenance-toggle"
                        type="checkbox"
                        checked={formData.STUDENT_PORTAL_MAINTENANCE === 'true'}
                        onChange={(e) => handleChange('STUDENT_PORTAL_MAINTENANCE', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>

                {/* Tin nhắn thông báo tùy biến */}
                <div className="space-y-2">
                  <Label htmlFor="STUDENT_MAINTENANCE_MESSAGE" className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    Thông điệp hiển thị cho Phụ huynh & Học sinh (Tùy chọn)
                  </Label>
                  <Input
                    id="STUDENT_MAINTENANCE_MESSAGE"
                    type="text"
                    placeholder="VD: Cổng thông tin bán trú đang tạm dừng để rà soát tiền ăn tháng 09/2026. Quý phụ huynh vui lòng quay lại sau."
                    value={formData.STUDENT_MAINTENANCE_MESSAGE}
                    onChange={(e) => handleChange('STUDENT_MAINTENANCE_MESSAGE', e.target.value)}
                    className="h-10 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nếu để trống, hệ thống sẽ sử dụng thông điệp thông báo bảo trì mặc định chuẩn mực và lịch sự.
                  </p>
                </div>

                {formData.STUDENT_PORTAL_MAINTENANCE === 'true' && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <b>Đang ở chế độ bảo trì:</b> Học sinh và phụ huynh hiện không thể đăng nhập hoặc xem công nợ. Nhớ bấm <b>"Lưu Tất Cả Cài Đặt"</b> bên dưới để áp dụng thay đổi.
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-end gap-3 border-t bg-slate-50/50 p-4">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="min-w-[140px] gap-2 shadow-sm font-medium bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu Tất Cả Cài Đặt
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* CARD 5.1: Quản lý hiển thị Cổng Học sinh (Sổ Bán Trú) */}
            <Card className="shadow-sm border-2 border-slate-200 bg-white">
              <CardHeader className="border-b bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600" />
                      Cấu hình Hiển thị Cổng Học sinh & Phụ huynh
                    </CardTitle>
                    <CardDescription>
                      Chủ động Bật / Tắt các phân hệ tính năng hiển thị cho học sinh và phụ huynh khi đăng nhập Sổ Bán Trú
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {/* Công tắc 1: Danh sách nợ & QR */}
                <div className={`flex items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                  formData.STUDENT_SHOW_DEBT_TAB === 'true'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50/80'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor="debt-tab-toggle" className="text-sm font-bold text-slate-800 cursor-pointer">
                        Hiển thị Danh sách nợ & Mã QR đóng tiền
                      </label>
                      {formData.STUDENT_SHOW_DEBT_TAB === 'true' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ĐANG BẬT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600 border border-slate-300">
                          ĐANG TẮT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Cho phép học sinh/phụ huynh xem tab <b>&quot;DS công nợ&quot;</b> và quét mã VietQR để thanh toán tiền ăn trực tuyến. Khuyến nghị BẬT vào các đợt thu tiền ăn.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center pt-1 sm:pt-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="debt-tab-toggle"
                        type="checkbox"
                        checked={formData.STUDENT_SHOW_DEBT_TAB === 'true'}
                        onChange={(e) => handleChange('STUDENT_SHOW_DEBT_TAB', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                {/* Công tắc 2: Lịch sử giao dịch & Thanh toán */}
                <div className={`flex items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                  formData.STUDENT_SHOW_HISTORY_TAB === 'true'
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50/80'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor="history-tab-toggle" className="text-sm font-bold text-slate-800 cursor-pointer">
                        Hiển thị Lịch sử giao dịch & Thanh toán
                      </label>
                      {formData.STUDENT_SHOW_HISTORY_TAB === 'true' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          ĐANG BẬT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600 border border-slate-300">
                          ĐANG TẮT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Cho phép học sinh/phụ huynh xem tab <b>&quot;Lịch sử thanh toán&quot;</b> để tra cứu hóa đơn các tháng cũ và các giao dịch chuyển khoản ngân hàng đã được hệ thống ghi nhận.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center pt-1 sm:pt-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="history-tab-toggle"
                        type="checkbox"
                        checked={formData.STUDENT_SHOW_HISTORY_TAB === 'true'}
                        onChange={(e) => handleChange('STUDENT_SHOW_HISTORY_TAB', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-3 border-t bg-slate-50/50 p-4">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="min-w-[140px] gap-2 shadow-sm font-medium bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu Tất Cả Cài Đặt
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* CARD 6: KHU VỰC NGUY HIỂM - ĐẶT LẠI DỮ LIỆU HỆ THỐNG */}
            <Card className="shadow-sm border-rose-200 bg-rose-50/20">
              <CardHeader className="border-b border-rose-100 bg-rose-50/50">
                <CardTitle className="text-lg font-semibold text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Khu vực Nguy hiểm: Khởi tạo lại Dữ liệu (Reset Database)
                </CardTitle>
                <CardDescription className="text-rose-700/80">
                  Dọn dẹp sạch toàn bộ dữ liệu phát sinh (học sinh, hóa đơn, lịch sử thu tiền, thời khóa biểu) để bắt đầu năm học mới.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    Lưu ý đặc biệt quan trọng trước khi thực hiện:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    <li>
                      <b className="text-rose-700">Dữ liệu sẽ bị xóa vĩnh viễn:</b> Tất cả hóa đơn tiền ăn, lịch sử giao dịch chuyển khoản & tiền mặt, các ca chốt tiền, yêu cầu cắt suất/đổi món, thời khóa biểu và toàn bộ danh sách học sinh.
                    </li>
                    <li>
                      <b className="text-emerald-700">Dữ liệu được giữ nguyên:</b> Cài đặt hệ thống (tên trường, ngân hàng SePay/BIDV, đơn giá, giờ chốt...) và toàn bộ tài khoản Cán bộ quản lý (Admin, Thu ngân, Giáo viên...).
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Đặt lại dữ liệu để chuẩn bị cho Năm học mới</h4>
                    <p className="text-xs text-slate-500">Thao tác này yêu cầu xác thực bằng mật khẩu Admin và không thể hoàn tác.</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setResetError(null);
                      setResetPassword('');
                      setResetConfirmText('');
                      setDeleteClasses(false);
                      setShowResetModal(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs shrink-0 font-medium"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Đặt lại dữ liệu hệ thống...
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {/* DIALOG XÁC NHẬN RESET DATABASE */}
        <Dialog open={showResetModal} onOpenChange={(open) => {
          if (!isResetting) setShowResetModal(open);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-lg">
                <ShieldAlert className="h-5 w-5" />
                Xác nhận Đặt lại Dữ liệu Hệ thống
              </DialogTitle>
              <DialogDescription className="text-slate-600 text-xs">
                Hành động này sẽ xóa sạch toàn bộ dữ liệu phát sinh trong cơ sở dữ liệu để đưa hệ thống về trạng thái ban đầu.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResetDatabase} className="space-y-4 py-2">
              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1.5 text-slate-700">
                <p className="font-semibold text-rose-600">⚠️ Thao tác này KHÔNG THỂ hoàn tác!</p>
                <p>Toàn bộ học sinh, hóa đơn, lịch sử nạp tiền và báo cắt suất sẽ bị xóa vĩnh viễn.</p>
              </div>

              <div className="flex items-center space-x-2 bg-slate-100 p-2.5 rounded border border-slate-200">
                <input
                  type="checkbox"
                  id="deleteClassesCheck"
                  checked={deleteClasses}
                  onChange={(e) => setDeleteClasses(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="deleteClassesCheck" className="text-xs font-medium text-slate-800 cursor-pointer">
                  Xóa luôn cả danh mục Lớp học (để nhập lại danh sách lớp mới)
                </label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPasswordInput" className="text-xs font-semibold text-slate-800">
                  1. Mật khẩu tài khoản Quản trị viên (Admin) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="adminPasswordInput"
                  type="password"
                  placeholder="Nhập mật khẩu Admin để xác nhận"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  className="text-sm bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmTextInput" className="text-xs font-semibold text-slate-800">
                  2. Nhập chữ <span className="font-bold font-mono text-rose-600">RESET</span> vào ô dưới để xác nhận <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="confirmTextInput"
                  type="text"
                  placeholder="Gõ chữ RESET"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  required
                  className="font-mono uppercase text-sm bg-white"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="text-slate-600"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'RESET' || !resetPassword}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Đang đặt lại dữ liệu...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xác nhận Xóa Vĩnh Viễn
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
