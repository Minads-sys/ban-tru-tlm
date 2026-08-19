'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';

interface SettingsFormState {
  SCHOOL_NAME: string;
  SCHOOL_ADDRESS: string;
  MEAL_UNIT_PRICE: string;
  CUTOFF_TIME: string;
  SCHOOL_YEAR: string;
  BANK_NAME: string;
  BANK_ACCOUNT_NO: string;
  BANK_ACCOUNT_NAME: string;
}

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState<SettingsFormState>({
    SCHOOL_NAME: '',
    SCHOOL_ADDRESS: '',
    MEAL_UNIT_PRICE: '30000',
    CUTOFF_TIME: '16:30',
    SCHOOL_YEAR: '2026-2027',
    BANK_NAME: 'MBBank',
    BANK_ACCOUNT_NO: '',
    BANK_ACCOUNT_NAME: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
          SCHOOL_NAME: data.SCHOOL_NAME ?? prev.SCHOOL_NAME,
          SCHOOL_ADDRESS: data.SCHOOL_ADDRESS ?? prev.SCHOOL_ADDRESS,
          MEAL_UNIT_PRICE: data.MEAL_UNIT_PRICE ?? prev.MEAL_UNIT_PRICE,
          CUTOFF_TIME: data.CUTOFF_TIME ?? prev.CUTOFF_TIME,
          SCHOOL_YEAR: data.SCHOOL_YEAR ?? prev.SCHOOL_YEAR,
          BANK_NAME: data.BANK_NAME ?? prev.BANK_NAME,
          BANK_ACCOUNT_NO: data.BANK_ACCOUNT_NO ?? prev.BANK_ACCOUNT_NO,
          BANK_ACCOUNT_NAME: data.BANK_ACCOUNT_NAME ?? prev.BANK_ACCOUNT_NAME,
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="SCHOOL_YEAR" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    Năm Học Hiện Tại (SCHOOL_YEAR)
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
                  <Input
                    id="BANK_NAME"
                    type="text"
                    placeholder="VD: MBBank, Vietcombank, TPBank"
                    value={formData.BANK_NAME}
                    onChange={(e) => handleChange('BANK_NAME', e.target.value)}
                    className="h-10"
                  />
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
                {/* Giờ khóa sổ cắt suất */}
                <div className="space-y-2">
                  <Label htmlFor="CUTOFF_TIME" className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Giờ Khóa Sổ Cắt Suất Hàng Ngày
                  </Label>
                  <Input
                    id="CUTOFF_TIME"
                    type="time"
                    value={formData.CUTOFF_TIME}
                    onChange={(e) => handleChange('CUTOFF_TIME', e.target.value)}
                    required
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Thời hạn cuối cùng Phụ huynh có thể gửi yêu cầu cắt suất ăn (VD: 16:30 chiều hôm trước).
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
          </form>
        )}
      </div>
    </div>
  );
}
