"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Truck,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  User,
  Phone,
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ZoomIn,
  X,
  Send,
  Loader2,
  Check,
  PlusCircle,
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Images,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import Swal from "sweetalert2";
import { compressImage, CompressedImageResult } from "@/lib/image-compressor";
import { formatDate } from "@/lib/utils";

const MAX_PHOTOS = 40;

interface DeliveryRecord {
  id: string;
  deliveryDate: string;
  shift: string;
  receiverName: string;
  receiverPhone?: string | null;
  deliveredMan: number;
  deliveredChay: number;
  deliveredChao: number;
  totalDelivered: number;
  expectedTotal?: number | null;
  photoUrl: string;
  photoUrls?: string[];
  photoSizeKb?: number | null;
  note?: string | null;
  createdAt: string;
  deliveredBy?: {
    id: string;
    fullName: string;
    username: string;
  };
}

interface ExpectedSummary {
  date: string;
  expectedMan: number;
  expectedChay: number;
  expectedChao: number;
  expectedTotal: number;
}

export default function MealDeliveryPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "BOARDING_MANAGER";

  // Tab active
  const [activeTab, setActiveTab] = useState<string>("create");

  // Form states
  const todayStr = new Date().toISOString().split("T")[0];
  const [deliveryDate, setDeliveryDate] = useState<string>(todayStr);
  const [shift, setShift] = useState<string>("ALL");
  const [receiverName, setReceiverName] = useState<string>("");
  const [receiverPhone, setReceiverPhone] = useState<string>("");
  const [deliveredMan, setDeliveredMan] = useState<number | "">(0);
  const [deliveredChay, setDeliveredChay] = useState<number | "">(0);
  const [deliveredChao, setDeliveredChao] = useState<number | "">(0);
  const [note, setNote] = useState<string>("");

  // Kế hoạch đối chiếu
  const [expectedSummary, setExpectedSummary] = useState<ExpectedSummary | null>(null);
  const [loadingExpected, setLoadingExpected] = useState<boolean>(false);

  // Quản lý nhiều ảnh & Nén ảnh (Tối đa 40 ảnh)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [compressedPhotos, setCompressedPhotos] = useState<CompressedImageResult[]>([]);
  const [compressingProgress, setCompressingProgress] = useState<{ current: number; total: number } | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Danh sách lịch sử
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [filterDate, setFilterDate] = useState<string>("");

  // Lightbox Gallery xem ảnh
  const [galleryRecord, setGalleryRecord] = useState<DeliveryRecord | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Tải số suất kế hoạch của ngày
  const fetchExpectedSummary = async (dateStr: string) => {
    if (!dateStr) return;
    setLoadingExpected(true);
    try {
      const res = await fetch(`/api/meal-delivery?action=expected-summary&date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setExpectedSummary(data);
      }
    } catch (err) {
      console.error("Lỗi khi tải số suất kế hoạch:", err);
    } finally {
      setLoadingExpected(false);
    }
  };

  // Tải danh sách lịch sử phiếu giao nhận
  const fetchRecords = async (dateStr?: string) => {
    setLoadingRecords(true);
    try {
      let url = "/api/meal-delivery";
      if (dateStr) {
        url += `?date=${dateStr}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch sử giao nhận:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchExpectedSummary(deliveryDate);
  }, [deliveryDate]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchRecords(filterDate);
    }
  }, [activeTab, filterDate]);

  // Xử lý nén nhiều ảnh (chọn file từ máy hoặc chụp liên tiếp)
  const handleProcessFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      toast.error("Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP)!");
      return;
    }

    const currentCount = compressedPhotos.length;
    const availableSlots = MAX_PHOTOS - currentCount;

    if (availableSlots <= 0) {
      toast.error(`Đã đạt giới hạn tối đa ${MAX_PHOTOS} ảnh cho một phiếu giao nhận!`);
      return;
    }

    const filesToProcess = fileArray.slice(0, availableSlots);
    if (fileArray.length > availableSlots) {
      toast.warning(`Chỉ có thể thêm ${availableSlots} ảnh nữa (tối đa ${MAX_PHOTOS} ảnh).`);
    }

    try {
      const newCompressedList: CompressedImageResult[] = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        setCompressingProgress({ current: i + 1, total: filesToProcess.length });
        const result = await compressImage(filesToProcess[i], {
          maxWidth: 1800,
          maxHeight: 1800,
          quality: 0.78,
          format: "image/webp",
        });
        newCompressedList.push(result);
      }

      setCompressedPhotos((prev) => [...prev, ...newCompressedList]);
      toast.success(`Đã nén thành công ${newCompressedList.length} ảnh!`);
    } catch (error) {
      console.error("Lỗi khi nén ảnh:", error);
      toast.error("Đã xảy ra lỗi khi nén ảnh: " + String(error));
    } finally {
      setCompressingProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (index: number) => {
    setCompressedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Tự động điền số suất theo kế hoạch hệ thống
  const handleAutoFillFromExpected = () => {
    if (!expectedSummary) return;
    setDeliveredMan(expectedSummary.expectedMan);
    setDeliveredChay(expectedSummary.expectedChay);
    setDeliveredChao(expectedSummary.expectedChao);
    toast.info("Đã điền số suất theo kế hoạch của ngày!");
  };

  const totalDelivered =
    (Number(deliveredMan) || 0) +
    (Number(deliveredChay) || 0) +
    (Number(deliveredChao) || 0);

  // Tính tổng dung lượng các ảnh đã nén
  const totalOriginalSizeKb = compressedPhotos.reduce((sum, p) => sum + p.originalSizeKb, 0);
  const totalCompressedSizeKb = compressedPhotos.reduce((sum, p) => sum + p.compressedSizeKb, 0);
  const overallCompressionRatio = totalOriginalSizeKb > 0
    ? Math.round(((totalOriginalSizeKb - totalCompressedSizeKb) / totalOriginalSizeKb) * 100)
    : 0;

  // Submit phiếu giao nhận
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deliveryDate) {
      toast.error("Vui lòng chọn ngày giao nhận!");
      return;
    }

    if (!receiverName.trim()) {
      toast.error("Vui lòng nhập tên người ký nhận cơm!");
      return;
    }

    if (totalDelivered <= 0) {
      toast.error("Tổng số suất cơm đã giao phải lớn hơn 0!");
      return;
    }

    if (compressedPhotos.length === 0) {
      toast.error("Vui lòng chụp hoặc tải lên ít nhất 1 ảnh biên bản ký nhận!");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("deliveryDate", deliveryDate);
      formData.append("shift", shift);
      formData.append("receiverName", receiverName.trim());
      formData.append("receiverPhone", receiverPhone.trim());
      formData.append("deliveredMan", String(Number(deliveredMan) || 0));
      formData.append("deliveredChay", String(Number(deliveredChay) || 0));
      formData.append("deliveredChao", String(Number(deliveredChao) || 0));
      if (expectedSummary?.expectedTotal) {
        formData.append("expectedTotal", String(expectedSummary.expectedTotal));
      }
      formData.append("note", note.trim());

      // Gửi từng file ảnh đã nén (tối đa 40 file)
      for (const item of compressedPhotos) {
        formData.append("photos", item.file);
      }

      const res = await fetch("/api/meal-delivery", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          title: "Giao nhận thành công!",
          text: `Đã lưu phiếu giao ${totalDelivered} suất cơm cho "${receiverName.trim()}" kèm ${compressedPhotos.length} ảnh ký nhận.`,
          icon: "success",
          confirmButtonColor: "#16a34a",
          confirmButtonText: "Đồng ý",
        });

        // Reset form
        setReceiverName("");
        setReceiverPhone("");
        setDeliveredMan(0);
        setDeliveredChay(0);
        setDeliveredChao(0);
        setNote("");
        setCompressedPhotos([]);

        // Chuyển sang tab lịch sử để xem lại
        setActiveTab("history");
        fetchRecords();
      } else {
        Swal.fire({
          title: "Không thể lưu phiếu",
          text: data.error || "Đã xảy ra lỗi khi lưu phiếu giao nhận",
          icon: "error",
          confirmButtonColor: "#dc2626",
        });
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa phiếu giao nhận
  const handleDeleteRecord = async (record: DeliveryRecord) => {
    const photoCount = (record.photoUrls && record.photoUrls.length > 0) ? record.photoUrls.length : 1;
    const result = await Swal.fire({
      title: "Xác nhận xóa phiếu giao nhận?",
      text: `Bạn có chắc muốn xóa phiếu giao ${record.totalDelivered} suất ngày ${formatDate(record.deliveryDate)} (Người nhận: ${record.receiverName}, gồm ${photoCount} ảnh)?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Xóa phiếu",
      cancelButtonText: "Hủy bỏ",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/meal-delivery?id=${record.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("Đã xóa phiếu giao nhận thành công!");
          fetchRecords(filterDate);
        } else {
          toast.error(data.error || "Không thể xóa phiếu giao nhận");
        }
      } catch (err) {
        toast.error("Lỗi kết nối máy chủ");
      }
    }
  };

  // Mở Lightbox Gallery cho một phiếu
  const handleOpenGallery = (record: DeliveryRecord, initialIndex: number = 0) => {
    setGalleryRecord(record);
    setActivePhotoIndex(initialIndex);
  };

  const getRecordPhotos = (record: DeliveryRecord): string[] => {
    if (record.photoUrls && record.photoUrls.length > 0) {
      return record.photoUrls;
    }
    return record.photoUrl ? [record.photoUrl] : [];
  };

  const activeGalleryPhotos = galleryRecord ? getRecordPhotos(galleryRecord) : [];

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 rounded-lg text-blue-600 dark:text-blue-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Giao Nhận Suất Cơm Bán Trú
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Nhập số suất thực tế đã giao, chụp ảnh phiếu ký nhận (tối đa 40 ảnh) và lưu trữ đối soát
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-1 px-3">
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            {session?.user?.name || (session?.user as any)?.username} ({isAdmin ? "Quản trị" : "Nhân viên"})
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="create" className="cursor-pointer gap-2 py-2">
            <PlusCircle className="h-4 w-4" />
            <span>Tạo Phiếu Giao Nhận</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="cursor-pointer gap-2 py-2">
            <History className="h-4 w-4" />
            <span>Lịch Sử Giao Nhận</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: TẠO PHIẾU GIAO NHẬN ==================== */}
        <TabsContent value="create" className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Card 1: Thông tin ngày & Ca giao */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  1. Thời Gian & Ca Giao Nhận
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryDate">Ngày giao nhận cơm <span className="text-rose-500">*</span></Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                    className="bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shift">Ca ăn giao nhận</Label>
                  <Select value={shift} onValueChange={setShift}>
                    <SelectTrigger id="shift" className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Chọn ca ăn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Toàn trường (Cả ngày)</SelectItem>
                      <SelectItem value="TIET_4">Ca Tiết 4 (Ăn sớm 10:15)</SelectItem>
                      <SelectItem value="TIET_5">Ca Tiết 5 (Ăn chính 11:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Thống kê số suất đối chiếu & Nhập số lượng thực tế */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    2. Số Lượng Suất Cơm Đã Giao
                  </CardTitle>
                  <CardDescription>Nhập số lượng khay/hộp cơm thực tế bàn giao cho người nhận</CardDescription>
                </div>

                {expectedSummary && expectedSummary.expectedTotal > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFillFromExpected}
                    className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-blue-600" />
                    Điền theo kế hoạch
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Đối chiếu kế hoạch */}
                {loadingExpected ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang kiểm tra số suất theo hệ thống...</span>
                  </div>
                ) : expectedSummary && (
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-300">
                      <Clock className="h-4 w-4" />
                      <span>Kế hoạch nấu của ngày ({formatDate(deliveryDate)}):</span>
                    </div>
                    <div className="flex items-center gap-3 font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">Mặn: <b>{expectedSummary.expectedMan}</b></span>
                      <span className="text-emerald-600">Chay: <b>{expectedSummary.expectedChay}</b></span>
                      <span className="text-amber-600">Cháo: <b>{expectedSummary.expectedChao}</b></span>
                      <span className="text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/80 px-2 py-0.5 rounded">
                        Tổng: <b>{expectedSummary.expectedTotal}</b>
                      </span>
                    </div>
                  </div>
                )}

                {/* 3 ô nhập số suất */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <Label htmlFor="man" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Cơm Mặn
                    </Label>
                    <Input
                      id="man"
                      type="number"
                      min={0}
                      value={deliveredMan}
                      onChange={(e) => setDeliveredMan(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-white dark:bg-slate-900 text-lg font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                    <Label htmlFor="chay" className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-400">
                      Cơm Chay
                    </Label>
                    <Input
                      id="chay"
                      type="number"
                      min={0}
                      value={deliveredChay}
                      onChange={(e) => setDeliveredChay(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-white dark:bg-slate-900 text-lg font-bold text-center text-emerald-700"
                    />
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                    <Label htmlFor="chao" className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-400">
                      Cháo
                    </Label>
                    <Input
                      id="chao"
                      type="number"
                      min={0}
                      value={deliveredChao}
                      onChange={(e) => setDeliveredChao(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-white dark:bg-slate-900 text-lg font-bold text-center text-amber-700"
                    />
                  </div>
                </div>

                {/* Tổng số suất */}
                <div className="flex items-center justify-between p-3.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    TỔNG SỐ SUẤT ĐÃ GIAO:
                  </span>
                  <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 font-mono">
                    {totalDelivered} <span className="text-sm font-normal text-slate-600">suất</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Thông tin người nhận */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  3. Người Ký Nhận & Ghi Chú
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="receiverName">Họ tên người nhận cơm <span className="text-rose-500">*</span></Label>
                  <Input
                    id="receiverName"
                    placeholder="VD: Cô Lan (GV trực), Thầy Thắng..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    required
                    className="bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="receiverPhone">Số điện thoại liên hệ (nếu có)</Label>
                  <Input
                    id="receiverPhone"
                    placeholder="VD: 0912345678"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="note">Ghi chú phát sinh / Lý do chênh lệch (nếu có)</Label>
                  <Textarea
                    id="note"
                    rows={2}
                    placeholder="VD: Lớp 10A1 xin thêm 2 suất mặn; Bàn giao đầy đủ canh và đồ tráng miệng..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Chụp ảnh & Nén ảnh ký nhận (Hỗ trợ tối đa 40 ảnh) */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-600" />
                    4. Chụp Ảnh Biên Bản Ký Nhận <span className="text-rose-500">*</span>
                  </CardTitle>
                  <CardDescription>
                    Hỗ trợ chụp hoặc tải nhiều ảnh cùng lúc (tối đa {MAX_PHOTOS} ảnh). Hệ thống tự động nén nhẹ nhưng đảm bảo nét chữ ký.
                  </CardDescription>
                </div>

                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {compressedPhotos.length} / {MAX_PHOTOS} ảnh
                </Badge>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Inputs ẩn */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
                />

                {/* Các nút bấm chụp / tải ảnh */}
                {compressedPhotos.length < MAX_PHOTOS && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 py-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm rounded-xl"
                      disabled={!!compressingProgress}
                    >
                      {compressingProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                      <span>{compressedPhotos.length === 0 ? "Chụp Ảnh Ký Nhận (Camera)" : "Chụp Thêm Ảnh Mới"}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-5 border-slate-300 font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer rounded-xl"
                      disabled={!!compressingProgress}
                    >
                      <Upload className="h-4 w-4" />
                      <span>{compressedPhotos.length === 0 ? "Chọn Nhiều Ảnh Từ Thư Viện" : "Tải Thêm Từ Thư Viện"}</span>
                    </Button>
                  </div>
                )}

                {/* Thanh trạng thái tiến trình nén */}
                {compressingProgress && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 flex items-center gap-3 text-xs text-blue-800 dark:text-blue-300 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                    <span>Đang nén tối ưu ảnh <b>{compressingProgress.current} / {compressingProgress.total}</b>... Vui lòng đợi trong giây lát.</span>
                  </div>
                )}

                {/* Danh sách lưới ảnh đã chụp / nén */}
                {compressedPhotos.length > 0 && (
                  <div className="space-y-3">
                    {/* Thống kê dung lượng */}
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          Đã chọn <b>{compressedPhotos.length} ảnh</b> • Tổng dung lượng sau nén: <b>{(totalCompressedSizeKb / 1024).toFixed(2)} MB</b> (Gốc: {(totalOriginalSizeKb / 1024).toFixed(1)} MB)
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white font-bold text-[11px]">
                        Tiết kiệm {overallCompressionRatio}% dung lượng
                      </Badge>
                    </div>

                    {/* Lưới ảnh thu nhỏ (Grid) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-1">
                      {compressedPhotos.map((item, index) => (
                        <div
                          key={index}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-square flex items-center justify-center shadow-xs"
                        >
                          <img
                            src={item.dataUrl}
                            alt={`Ảnh ký nhận ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />

                          {/* Nhãn số thứ tự */}
                          <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                            #{index + 1} ({item.compressedSizeKb}KB)
                          </span>

                          {/* Nút xóa ảnh */}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-md cursor-pointer transition-transform hover:scale-110"
                            title="Xóa ảnh này"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {compressedPhotos.length < MAX_PHOTOS && (
                      <p className="text-[11px] text-slate-400 italic">
                        * Bạn có thể bấm chụp hoặc chọn thêm để tải thêm ảnh (còn {MAX_PHOTOS - compressedPhotos.length} ảnh nữa).
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nút gửi */}
            <Button
              type="submit"
              disabled={submitting || totalDelivered <= 0 || !receiverName.trim() || compressedPhotos.length === 0 || !!compressingProgress}
              className="w-full py-6 text-base font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  <span>Đang lưu phiếu & tải {compressedPhotos.length} ảnh lên máy chủ...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  <span>Xác Nhận & Hoàn Tất Giao Nhận ({totalDelivered} suất • {compressedPhotos.length} ảnh)</span>
                </>
              )}
            </Button>
          </form>
        </TabsContent>

        {/* ==================== TAB 2: LỊCH SỬ GIAO NHẬN ==================== */}
        <TabsContent value="history" className="space-y-4">
          {/* Bộ lọc */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="filterDate" className="text-xs sm:text-sm shrink-0">Lọc theo ngày:</Label>
                <Input
                  id="filterDate"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 w-full sm:w-44 text-sm"
                />
                {filterDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterDate("")}
                    className="text-xs text-slate-500 cursor-pointer"
                  >
                    Xem tất cả
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchRecords(filterDate)}
                className="text-xs cursor-pointer gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Làm mới
              </Button>
            </CardContent>
          </Card>

          {/* Danh sách phiếu */}
          {loadingRecords ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm">Đang tải danh sách phiếu giao nhận...</span>
            </div>
          ) : records.length === 0 ? (
            <Card className="border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-slate-500">
              <Truck className="h-10 w-10 mx-auto mb-2 text-slate-400" />
              <p className="font-medium text-base">Chưa có phiếu giao nhận nào</p>
              <p className="text-xs text-slate-400 mt-1">
                {filterDate ? `Không tìm thấy phiếu nào vào ngày ${formatDate(filterDate)}` : "Hãy tạo phiếu giao nhận đầu tiên trong tab 'Tạo Phiếu Giao Nhận'"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {records.map((r) => {
                const photos = getRecordPhotos(r);
                return (
                  <Card key={r.id} className="border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all">
                    <CardHeader className="pb-2.5 border-b border-slate-100 dark:border-slate-800/60 flex flex-row items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-base">
                            {formatDate(r.deliveryDate)}
                          </span>
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
                            {r.shift === "TIET_4" ? "Ca Tiết 4" : r.shift === "TIET_5" ? "Ca Tiết 5" : "Cả ngày"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Giao bởi: <b>{r.deliveredBy?.fullName || r.deliveredBy?.username || "Nhân viên"}</b> • {new Date(r.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      {(isAdmin || r.deliveredBy?.id === session?.user?.id) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecord(r)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0 cursor-pointer"
                          title="Xóa phiếu"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="pt-3 space-y-3">
                      {/* Người nhận */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Người ký nhận:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {r.receiverName} {r.receiverPhone ? `(${r.receiverPhone})` : ""}
                        </span>
                      </div>

                      {/* Thống kê suất */}
                      <div className="grid grid-cols-4 gap-1.5 text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <div className="text-slate-400 text-[10px]">Mặn</div>
                          <div className="font-bold text-slate-700 dark:text-slate-300">{r.deliveredMan}</div>
                        </div>
                        <div>
                          <div className="text-emerald-600 text-[10px]">Chay</div>
                          <div className="font-bold text-emerald-600">{r.deliveredChay}</div>
                        </div>
                        <div>
                          <div className="text-amber-600 text-[10px]">Cháo</div>
                          <div className="font-bold text-amber-600">{r.deliveredChao}</div>
                        </div>
                        <div className="border-l border-slate-200 dark:border-slate-700 pl-1">
                          <div className="text-blue-600 text-[10px] font-semibold">TỔNG</div>
                          <div className="font-extrabold text-blue-700 dark:text-blue-400 text-sm">{r.totalDelivered}</div>
                        </div>
                      </div>

                      {r.note && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded border border-amber-100 dark:border-amber-900/40 italic">
                          "{r.note}"
                        </p>
                      )}

                      {/* Danh sách ảnh ký nhận */}
                      {photos.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Images className="h-3.5 w-3.5 text-blue-600" />
                              Biên bản ký nhận ({photos.length} ảnh):
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.photoSizeKb ? `Tổng ~${r.photoSizeKb} KB` : ""}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {photos.map((pUrl, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => handleOpenGallery(r, pIdx)}
                                className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group cursor-pointer"
                              >
                                <img
                                  src={pUrl}
                                  alt={`Ảnh ${pIdx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl">
                                  #{pIdx + 1}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Lightbox Gallery Phóng to ảnh ký nhận (Hỗ trợ duyệt nhiều ảnh qua lại) */}
      <Dialog open={!!galleryRecord} onOpenChange={(open) => !open && setGalleryRecord(null)}>
        <DialogContent className="max-w-4xl w-[96vw] p-4 bg-slate-950 text-white border-slate-800 shadow-2xl">
          <DialogHeader className="text-left space-y-1 pb-2 border-b border-slate-800">
            <DialogTitle className="text-base text-slate-100 flex items-center justify-between flex-wrap gap-2">
              <span>Ảnh Biên Bản Ký Nhận Suất Cơm</span>
              {galleryRecord && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                    {formatDate(galleryRecord.deliveryDate)} • {galleryRecord.receiverName} ({galleryRecord.totalDelivered} suất)
                  </Badge>
                  <Badge className="bg-blue-600 text-white text-xs">
                    Ảnh {activePhotoIndex + 1} / {activeGalleryPhotos.length}
                  </Badge>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {activeGalleryPhotos.length > 0 && (
            <div className="py-2 flex flex-col items-center justify-center space-y-3">
              <div className="relative w-full max-h-[72vh] overflow-hidden rounded-xl border border-slate-800 bg-black flex items-center justify-center">
                <img
                  src={activeGalleryPhotos[activePhotoIndex]}
                  alt={`Ảnh ký nhận ${activePhotoIndex + 1}`}
                  className="max-h-[70vh] w-auto max-w-full object-contain mx-auto transition-all"
                />

                {/* Nút Prev */}
                {activeGalleryPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : activeGalleryPhotos.length - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm cursor-pointer transition-transform hover:scale-110"
                    title="Ảnh trước đó (←)"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                {/* Nút Next */}
                {activeGalleryPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActivePhotoIndex((prev) => (prev < activeGalleryPhotos.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm cursor-pointer transition-transform hover:scale-110"
                    title="Ảnh tiếp theo (→)"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Dải thumbnail bên dưới modal */}
              {activeGalleryPhotos.length > 1 && (
                <div className="flex items-center gap-1.5 max-w-full overflow-x-auto py-1 px-2">
                  {activeGalleryPhotos.map((thumbUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                        activePhotoIndex === idx ? "border-blue-500 scale-105 shadow-md" : "border-slate-700 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={thumbUrl} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between w-full text-xs text-slate-400 pt-1">
                <span>Dùng phím mũi tên hoặc nút bấm để chuyển ảnh</span>
                <a
                  href={activeGalleryPhotos[activePhotoIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Mở ảnh gốc trong tab mới
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
