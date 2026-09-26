"use client";

import React, { useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Palette,
  Upload,
  Sparkles,
  Smartphone,
  Check,
  Image as ImageIcon,
  Loader2,
  Trash2,
  AlertCircle,
  Megaphone,
  CheckCircle2,
  GraduationCap,
  CalendarX,
  RefreshCw,
  QrCode,
  Eye,
  CalendarDays,
  Save,
} from "lucide-react";

interface ThemeBannerSettingsProps {
  theme: string;
  bannerUrl: string;
  motto: string;
  announcement: string;
  schoolName: string;
  isSaving?: boolean;
  onChange: (field: string, value: string) => void;
}

export function ThemeBannerSettings({
  theme,
  bannerUrl,
  motto,
  announcement,
  schoolName,
  isSaving = false,
  onChange,
}: ThemeBannerSettingsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = [
    {
      id: "red_star",
      title: "Quốc Khánh / Lễ Hội",
      subtitle: "Đỏ cờ hoa, sao vàng 3D",
      bgClass: "bg-gradient-to-r from-red-600 via-rose-700 to-amber-700",
      badge: "Mẫu chuẩn",
      icon: "🇻🇳",
    },
    {
      id: "tet_spring",
      title: "Tết Cổ Truyền",
      subtitle: "Đỏ vàng mai đào sum vầy",
      bgClass: "bg-gradient-to-r from-amber-600 via-orange-600 to-red-700",
      badge: "Xuân",
      icon: "🌸",
    },
    {
      id: "back_to_school",
      title: "Tựu Trường / Năm Mới",
      subtitle: "Xanh dương học đường tri thức",
      bgClass: "bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-800",
      badge: "Mùa thi",
      icon: "🎒",
    },
    {
      id: "default_tenloman",
      title: "Ten Lơ Man Mặc Định",
      subtitle: "Xanh navy & vàng nhận diện",
      bgClass: "bg-gradient-to-r from-sky-700 via-blue-800 to-slate-900",
      badge: "Nhà trường",
      icon: "🏫",
    },
    {
      id: "custom",
      title: "Tùy Chỉnh (Tải Ảnh)",
      subtitle: "Tải file ảnh hoặc nhập link ngoài",
      bgClass: "bg-gradient-to-r from-slate-700 via-slate-800 to-slate-950",
      badge: "Tự chọn",
      icon: "🖼️",
    },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("banner", file);

    try {
      const res = await fetch("/api/upload/banner", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi tải ảnh lên");
      }

      onChange("STUDENT_PORTAL_BANNER_URL", data.url);
      onChange("STUDENT_PORTAL_THEME", "custom");
    } catch (err: any) {
      setUploadError(err.message || "Không thể tải ảnh banner");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getPreviewBg = () => {
    if (bannerUrl) {
      return {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    switch (theme) {
      case "tet_spring":
        return { background: "radial-gradient(circle at 50% 25%, #f59e0b 0%, #dc2626 50%, #7f1d1d 100%)" };
      case "back_to_school":
        return { background: "radial-gradient(circle at 50% 25%, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)" };
      case "default_tenloman":
        return { background: "radial-gradient(circle at 50% 25%, #0284c7 0%, #0369a1 50%, #0f172a 100%)" };
      case "custom":
        return { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" };
      case "red_star":
      default:
        return { background: "radial-gradient(circle at 50% 25%, #d91c1c 0%, #a40606 45%, #660000 100%)" };
    }
  };

  return (
    <Card className="shadow-sm border-2 border-slate-200 bg-white">
      <CardHeader className="border-b bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Palette className="h-5 w-5 text-rose-600" />
              Quản lý Giao diện & Banner Cổng Học sinh (Mobile App)
            </CardTitle>
            <CardDescription>
              Cập nhật định kỳ hình nền banner, theme lễ hội theo mùa (Quốc khánh, Tết, Khai giảng...) và thông báo cho học sinh
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <Sparkles className="h-3.5 w-3.5 text-rose-500" />
              Cập nhật Định kỳ
            </span>
            <Button
              type="submit"
              disabled={isSaving}
              size="sm"
              className="gap-1.5 shadow-sm font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer h-9 px-4 shrink-0"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? "Đang lưu..." : "Cập nhật Giao diện"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CỘT TRÁI: Cấu hình Theme & Tải ảnh (7/12) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Chọn Preset Theme */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Palette className="h-4 w-4 text-slate-600" />
                Chọn Giao diện Chủ đề (Theme Preset):
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {presets.map((preset) => {
                  const isSelected = (theme || "red_star") === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        onChange("STUDENT_PORTAL_THEME", preset.id);
                        if (preset.id !== "custom") {
                          onChange("STUDENT_PORTAL_BANNER_URL", "");
                        }
                      }}
                      className={`relative text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-rose-500 bg-rose-50/40 shadow-xs ring-1 ring-rose-400"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{preset.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{preset.title}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {preset.subtitle}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className={`mt-2 h-2 rounded-full ${preset.bgClass} opacity-85`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Tải ảnh Banner Tùy chỉnh (Upload / URL) */}
            <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <Label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  Ảnh Banner Tùy chỉnh (Tải lên hoặc URL ảnh)
                </span>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("STUDENT_PORTAL_BANNER_URL", "");
                      if (theme === "custom") onChange("STUDENT_PORTAL_THEME", "red_star");
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xóa ảnh này
                  </button>
                )}
              </Label>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="https://... hoặc tải ảnh từ máy tính"
                  value={bannerUrl}
                  onChange={(e) => {
                    onChange("STUDENT_PORTAL_BANNER_URL", e.target.value);
                    if (e.target.value) onChange("STUDENT_PORTAL_THEME", "custom");
                  }}
                  className="h-9 text-xs flex-1 bg-white"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 h-9 shrink-0 bg-white hover:bg-slate-100 cursor-pointer text-xs font-medium"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-blue-600" />
                  )}
                  <span>{isUploading ? "Đang tải..." : "Tải ảnh từ máy"}</span>
                </Button>
              </div>

              {uploadError && (
                <div className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Gợi ý: Chọn ảnh tỉ lệ ngang (16:9 hoặc 2:1), kích thước tối ưu khoảng 800x450px hoặc 1200x600px để hiển thị sắc nét trên điện thoại.
              </p>
            </div>

            {/* 3. Slogan & Khẩu hiệu trên Banner */}
            <div className="space-y-2">
              <Label htmlFor="STUDENT_PORTAL_MOTTO" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Khẩu hiệu / Slogan Chào mừng (Hiển thị trên Banner)
              </Label>
              <Input
                id="STUDENT_PORTAL_MOTTO"
                type="text"
                placeholder="VD: Nhiệt liệt chào mừng năm học mới 2026 - 2027"
                value={motto}
                onChange={(e) => onChange("STUDENT_PORTAL_MOTTO", e.target.value)}
                className="h-9 text-xs bg-white"
              />
            </div>

            {/* 4. Thông báo toàn trường (Announcement) */}
            <div className="space-y-2">
              <Label htmlFor="STUDENT_PORTAL_ANNOUNCEMENT" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-blue-600" />
                Thông báo Bán Trú toàn trường (Hiển thị dạng thẻ nổi bật)
              </Label>
              <Textarea
                id="STUDENT_PORTAL_ANNOUNCEMENT"
                rows={2}
                placeholder="VD: Thực đơn tuần 02 đã được cập nhật. Học sinh vui lòng báo cắt hoặc đổi món trước 16:00..."
                value={announcement}
                onChange={(e) => onChange("STUDENT_PORTAL_ANNOUNCEMENT", e.target.value)}
                className="text-xs bg-white resize-none"
              />
            </div>

          </div>

          {/* CỘT PHẢI: Live Phone Preview thu nhỏ (5/12) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-blue-600" />
                Xem trước Giao diện Mobile:
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                Trực tiếp (Live)
              </span>
            </div>

            {/* Khung mô phỏng điện thoại */}
            <div className="w-full max-w-[320px] rounded-[32px] border-[6px] border-slate-800 shadow-xl overflow-hidden bg-slate-50 flex flex-col select-none ring-1 ring-slate-300">
              
              {/* Header Hero Banner thu nhỏ */}
              <div
                className="relative text-white pt-2.5 pb-6 px-3 transition-all duration-300"
                style={getPreviewBg()}
              >
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[9px] font-semibold text-white/80 mb-1 px-1">
                  <span>09:41</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px]">●●●</span>
                    <span className="text-[8px]">100%</span>
                  </div>
                </div>

                {/* Brand Header */}
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-amber-400 text-red-950 flex items-center justify-center text-[8px] font-black">
                      <GraduationCap className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-[10px] font-bold tracking-tight text-white drop-shadow truncate max-w-[170px]">
                      {schoolName || "Trường THPT Ten Lơ Man"}
                    </span>
                  </div>
                  <span className="text-[8px] font-semibold text-amber-200 bg-black/25 px-1.5 py-0.2 rounded-full border border-white/20">
                    Học Sinh
                  </span>
                </div>

                {/* Slogan */}
                {motto && (
                  <div className="text-center text-[9px] font-medium text-amber-200 mb-1 truncate px-2">
                    ★ {motto} ★
                  </div>
                )}

                {/* Floating Student Card thu nhỏ (Glassmorphic trong suốt đồng bộ mobile) */}
                <div className="mt-2 bg-black/25 backdrop-blur-[2px] rounded-xl p-2.5 shadow-md border border-white/20 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        <GraduationCap className="h-4 w-4 text-amber-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[8px] font-bold text-amber-300 uppercase truncate">
                          {schoolName || "Trường THPT Ten Lơ Man"}
                        </div>
                        <div className="text-[11px] font-bold text-white leading-none truncate">
                          Nguyễn Bảo Khánh
                        </div>
                        <div className="text-[8px] text-amber-200/90 font-medium mt-0.5">
                          Lớp 12A1 • Mã BT: BT-12A1-05
                        </div>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded-full shrink-0">
                      Hồ sơ
                    </span>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-white/15 flex items-baseline justify-between text-[9px]">
                    <span className="text-white/70">Tiền ăn còn nợ:</span>
                    <span className="font-extrabold text-amber-300 text-xs">770.000đ</span>
                  </div>

                  {/* Sub-bar trắng dưới cùng */}
                  <div className="mt-2 bg-white rounded-lg p-1.5 flex items-center justify-between text-slate-800 text-[8px] shadow-xs">
                    <span className="font-bold truncate">Cơm mặn</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded animate-pulse">Thanh toán</span>
                      <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">Cắt/Đổi món</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body thu nhỏ */}
              <div className="p-3 space-y-2 text-center">
                {/* 1. Suất ăn & Vị trí ăn thu nhỏ (Đưa lên trên Tiện ích) */}
                <div className="bg-gradient-to-br from-white to-purple-50/60 rounded-xl p-2 border border-purple-200/80 shadow-2xs text-left">
                  <div className="flex items-center justify-between text-[8px] font-bold text-slate-800 mb-1">
                    <span className="text-purple-700 uppercase flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                      Suất ăn & Vị trí ăn
                    </span>
                    <span className="text-slate-400 font-normal text-[7px]">Hôm nay</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-1 text-white text-[8px]">
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg p-1.5 font-bold truncate">
                      <span className="text-purple-200 text-[6px] block uppercase font-medium">Sân ăn</span>
                      Sân 1
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-1.5 font-bold truncate">
                      <span className="text-amber-100 text-[6px] block uppercase font-medium">Xe phục vụ</span>
                      Xe 1
                    </div>
                  </div>
                  <div className="text-[7px] text-slate-600 flex justify-between items-center">
                    <span>Món: <b>Cơm mặn</b></span>
                    <span className="text-purple-700 font-bold">Xem sơ đồ &gt;</span>
                  </div>
                </div>

                {/* 2. Tiện ích của bạn */}
                <div className="text-[10px] font-bold text-slate-700 text-left pt-0.5">
                  Tiện ích của bạn
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-xs shadow-2xs">
                      <CalendarX className="h-4 w-4" />
                    </div>
                    <span className="text-[8px] font-medium text-slate-600 mt-1">Cắt suất</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs shadow-2xs">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <span className="text-[8px] font-medium text-slate-600 mt-1">Đổi món</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-xs shadow-2xs">
                      <Eye className="h-4 w-4" />
                    </div>
                    <span className="text-[8px] font-medium text-slate-600 mt-1">Công khai</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shadow-2xs">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <span className="text-[8px] font-medium text-slate-600 mt-1">Lịch tuần</span>
                  </div>
                </div>

                {/* Bottom Nav Mockup */}
                <div className="mt-4 pt-1.5 border-t border-slate-200 flex items-center justify-around text-slate-400 text-[8px] font-medium">
                  <span className="text-blue-600 font-bold">● Trang chủ</span>
                  <span>Suất ăn</span>
                  <span>Hóa đơn</span>
                  <span>Lịch sử</span>
                  <span>Cá nhân</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t bg-slate-50/50 p-4">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Giao diện và hình nền mới sẽ được áp dụng ngay lập tức cho toàn bộ học sinh khi bấm cập nhật.</span>
        </div>
        <Button
          type="submit"
          disabled={isSaving}
          className="min-w-[190px] gap-2 shadow-sm font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu thay đổi...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Cập nhật Giao diện & Banner
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
