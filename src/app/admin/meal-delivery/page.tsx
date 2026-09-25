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
  ExternalLink,
  Download,
  FolderArchive,
  FileDown,
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
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
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.55,
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
  // Hỗ trợ 2 chế độ:
  //   - Nếu > 8 ảnh: batch upload ảnh trước qua /api/meal-delivery/upload-photos, rồi gửi JSON
  //   - Nếu <= 8 ảnh: gửi FormData trực tiếp (chế độ truyền thống, đảm bảo < 10MB)
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

    const BATCH_THRESHOLD = 8; // Ngưỡng chuyển sang batch upload mode

    try {
      // ============================================================
      // CHẾ ĐỘ BATCH UPLOAD: > 8 ảnh → upload từng batch 5 ảnh, rồi gửi JSON
      // ============================================================
      if (compressedPhotos.length > BATCH_THRESHOLD) {
        const BATCH_SIZE = 5;
        const totalBatches = Math.ceil(compressedPhotos.length / BATCH_SIZE);
        const allPhotoUrls: string[] = [];
        let totalPhotoSizeKb = 0;

        // Hiển thị dialog tiến trình batch upload
        Swal.fire({
          title: "Đang tải ảnh lên máy chủ...",
          html: `<p>Chuẩn bị tải <b>${compressedPhotos.length}</b> ảnh theo ${totalBatches} đợt...</p>
                 <p style="font-size:12px;color:#64748b;margin-top:4px">Mỗi đợt tối đa ${BATCH_SIZE} ảnh. Vui lòng không đóng trang này.</p>`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
        });

        // Upload tuần tự từng batch
        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batchStart = batchIdx * BATCH_SIZE;
          const batchEnd = Math.min(batchStart + BATCH_SIZE, compressedPhotos.length);
          const batchPhotos = compressedPhotos.slice(batchStart, batchEnd);

          // Cập nhật dialog tiến trình
          Swal.update({
            title: "Đang tải ảnh lên máy chủ...",
            html: `<p style="font-size:15px;font-weight:600">Đang tải ảnh: đợt <b>${batchIdx + 1}/${totalBatches}</b></p>
                   <p style="font-size:13px;color:#475569;margin-top:4px">Ảnh ${batchStart + 1}–${batchEnd} / ${compressedPhotos.length} ảnh</p>
                   <div style="margin-top:10px;background:#e2e8f0;border-radius:8px;height:8px;overflow:hidden">
                     <div style="width:${Math.round(((batchIdx) / totalBatches) * 100)}%;height:100%;background:#2563eb;border-radius:8px;transition:width 0.3s"></div>
                   </div>
                   <p style="font-size:11px;color:#94a3b8;margin-top:6px">Vui lòng không đóng trang này cho đến khi hoàn tất</p>`,
          });

          // Tạo FormData cho batch
          const batchFormData = new FormData();
          batchFormData.append("deliveryDate", deliveryDate);
          for (const item of batchPhotos) {
            batchFormData.append("photos", item.file);
          }

          // Gửi batch
          let batchRes: Response;
          try {
            batchRes = await fetch("/api/meal-delivery/upload-photos", {
              method: "POST",
              body: batchFormData,
            });
          } catch (networkError) {
            Swal.fire({
              title: "Lỗi kết nối mạng",
              html: `<p>Không thể gửi đợt ảnh thứ <b>${batchIdx + 1}/${totalBatches}</b> (ảnh ${batchStart + 1}–${batchEnd}).</p>
                     <p style="margin-top:8px;font-size:13px;color:#64748b">Lỗi: ${String(networkError)}</p>
                     <p style="margin-top:8px;font-size:12px;color:#94a3b8">${allPhotoUrls.length > 0 ? `Đã tải thành công ${allPhotoUrls.length} ảnh trước đó.` : ""} Vui lòng kiểm tra kết nối mạng và thử lại.</p>`,
              icon: "error",
              confirmButtonColor: "#dc2626",
            });
            setSubmitting(false);
            return;
          }

          let batchData: any = {};
          try {
            batchData = await batchRes.json();
          } catch {
            batchData = { error: `Máy chủ phản hồi không đúng định dạng (HTTP ${batchRes.status})` };
          }

          if (!batchRes.ok) {
            Swal.fire({
              title: `Lỗi tải ảnh đợt ${batchIdx + 1}/${totalBatches}`,
              html: `<p>${batchData.error || "Đã xảy ra lỗi khi tải ảnh lên máy chủ"}</p>
                     <p style="margin-top:8px;font-size:13px;color:#64748b">Ảnh ${batchStart + 1}–${batchEnd} không tải được.</p>
                     <p style="margin-top:8px;font-size:12px;color:#94a3b8">${allPhotoUrls.length > 0 ? `Đã tải thành công ${allPhotoUrls.length} ảnh trước đó.` : ""} Vui lòng thử lại.</p>`,
              icon: "error",
              confirmButtonColor: "#dc2626",
            });
            setSubmitting(false);
            return;
          }

          // Thu thập URLs từ batch thành công
          allPhotoUrls.push(...(batchData.photoUrls || []));
          totalPhotoSizeKb += batchData.photoSizeKb || 0;
        }

        // Cập nhật dialog: đang lưu phiếu giao nhận
        Swal.update({
          title: "Đang lưu phiếu giao nhận...",
          html: `<p style="font-size:14px">Đã tải xong <b>${allPhotoUrls.length}</b> ảnh. Đang lưu phiếu giao nhận...</p>
                 <div style="margin-top:10px;background:#e2e8f0;border-radius:8px;height:8px;overflow:hidden">
                   <div style="width:95%;height:100%;background:#16a34a;border-radius:8px;transition:width 0.3s"></div>
                 </div>`,
        });

        // Gửi JSON POST để tạo record với các photoUrls đã upload
        const jsonBody = {
          deliveryDate,
          shift,
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim(),
          deliveredMan: String(Number(deliveredMan) || 0),
          deliveredChay: String(Number(deliveredChay) || 0),
          deliveredChao: String(Number(deliveredChao) || 0),
          expectedTotal: expectedSummary?.expectedTotal ? String(expectedSummary.expectedTotal) : undefined,
          note: note.trim(),
          photoUrls: allPhotoUrls,
          photoSizeKb: String(totalPhotoSizeKb),
        };

        const res = await fetch("/api/meal-delivery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonBody),
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Máy chủ phản hồi không đúng định dạng (HTTP ${res.status})` };
        }

        if (res.ok) {
          Swal.fire({
            title: "Giao nhận thành công!",
            text: `Đã lưu phiếu giao ${totalDelivered} suất cơm cho "${receiverName.trim()}" kèm ${allPhotoUrls.length} ảnh ký nhận (tải theo ${totalBatches} đợt).`,
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
            html: `<p>${data.error || "Đã xảy ra lỗi khi lưu phiếu giao nhận"}</p>
                   <p style="margin-top:8px;font-size:12px;color:#94a3b8">Ảnh đã được tải lên thành công (${allPhotoUrls.length} ảnh). Lỗi xảy ra khi tạo phiếu trong hệ thống.</p>
                   ${data.details ? `<p style="margin-top:8px;font-size:12px;color:#888;word-break:break-all">Chi tiết: ${data.details}</p>` : ""}`,
            icon: "error",
            confirmButtonColor: "#dc2626",
          });
        }
      } else {
        // ============================================================
        // CHẾ ĐỘ FORMDATA TRUYỀN THỐNG: <= 8 ảnh → gửi trực tiếp 1 request
        // ============================================================
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

        // Gửi từng file ảnh đã nén
        for (const item of compressedPhotos) {
          formData.append("photos", item.file);
        }

        const res = await fetch("/api/meal-delivery", {
          method: "POST",
          body: formData,
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Máy chủ phản hồi không đúng định dạng (HTTP ${res.status})` };
        }

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
            html: `<p>${data.error || "Đã xảy ra lỗi khi lưu phiếu giao nhận"}</p>${data.details ? `<p style="margin-top:8px;font-size:12px;color:#888;word-break:break-all">Chi tiết: ${data.details}</p>` : ""}`,
            icon: "error",
            confirmButtonColor: "#dc2626",
          });
        }
      }
    } catch (err) {
      Swal.close();
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

  // Tải ảnh đơn đang xem
  const [downloadingSingle, setDownloadingSingle] = useState(false);
  const handleDownloadCurrentPhoto = async () => {
    const url = activeGalleryPhotos[activePhotoIndex];
    if (!url || !galleryRecord) return;
    setDownloadingSingle(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = url.split(".").pop()?.split("?")[0] || "webp";
      const cleanDate = galleryRecord.deliveryDate ? galleryRecord.deliveryDate.replace(/-/g, "") : "ngay";
      a.download = `BienBan_GiaoNhan_${cleanDate}_trang_${activePhotoIndex + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(`Đã tải ảnh trang #${activePhotoIndex + 1}!`);
    } catch (err) {
      console.error("Lỗi khi tải ảnh:", err);
      window.open(url, "_blank");
    } finally {
      setDownloadingSingle(false);
    }
  };

  // Tải tất cả ảnh dạng file ZIP
  const [downloadingZip, setDownloadingZip] = useState(false);
  const handleDownloadAllPhotos = async () => {
    if (!galleryRecord || activeGalleryPhotos.length === 0) return;
    setDownloadingZip(true);
    Swal.fire({
      title: "Đang đóng gói file ZIP...",
      text: `Đang tải và nén ${activeGalleryPhotos.length} ảnh biên bản ký nhận...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const cleanDate = galleryRecord.deliveryDate ? galleryRecord.deliveryDate.replace(/-/g, "") : "ngay";
      const folder = zip.folder(`BienBan_${cleanDate}`) || zip;

      for (let i = 0; i < activeGalleryPhotos.length; i++) {
        const pUrl = activeGalleryPhotos[i];
        const res = await fetch(pUrl);
        const blob = await res.blob();
        const ext = pUrl.split(".").pop()?.split("?")[0] || "webp";
        const fileName = `Trang_${String(i + 1).padStart(2, "0")}.${ext}`;
        folder.file(fileName, blob);
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      const zipUrl = window.URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `Bien_Ban_Giao_Nhan_${cleanDate}_${activeGalleryPhotos.length}_anh.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(zipUrl);

      Swal.close();
      toast.success(`Đã tải về thành công ${activeGalleryPhotos.length} ảnh trong file ZIP!`);
    } catch (err) {
      console.error("Lỗi tải file ZIP:", err);
      Swal.fire("Lỗi", "Không thể nén ảnh: " + String(err), "error");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Điều hướng bằng phím mũi tên khi mở modal gallery
  useEffect(() => {
    if (!galleryRecord || activeGalleryPhotos.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : activeGalleryPhotos.length - 1));
      } else if (e.key === "ArrowRight") {
        setActivePhotoIndex((prev) => (prev < activeGalleryPhotos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryRecord, activeGalleryPhotos.length]);

  // Hỗ trợ vuốt cảm ứng (touch swipe) cho mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const diff = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 45; // pixel
    if (diff > minSwipeDistance) {
      // Vuốt sang trái -> xem ảnh kế tiếp
      setActivePhotoIndex((prev) => (prev < activeGalleryPhotos.length - 1 ? prev + 1 : 0));
    } else if (diff < -minSwipeDistance) {
      // Vuốt sang phải -> xem ảnh trước đó
      setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : activeGalleryPhotos.length - 1));
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Tự động cuộn thumbnail đang chọn vào giữa tầm nhìn
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!thumbnailContainerRef.current) return;
    const activeThumb = thumbnailContainerRef.current.children[activePhotoIndex] as HTMLElement;
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activePhotoIndex]);

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
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Danh Sách Phiếu Giao Nhận ({records.length} phiếu)</span>
                </CardTitle>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Bấm nút &quot;Xem ảnh&quot; để mở popup xem chi tiết biên bản ký nhận
                </span>
              </CardHeader>
              <CardContent className="p-0">
                {/* 1. Phiên bản Bảng (Table) cho Tablet & PC */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 text-xs">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Ngày & Buổi</TableHead>
                        <TableHead>Người giao</TableHead>
                        <TableHead>Người ký nhận</TableHead>
                        <TableHead className="text-center">Chi tiết suất (Mặn - Chay - Cháo)</TableHead>
                        <TableHead className="text-center font-bold">Tổng suất</TableHead>
                        <TableHead>Ghi chú</TableHead>
                        <TableHead className="text-center">Biên bản ký nhận</TableHead>
                        <TableHead className="w-16 text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, idx) => {
                        const photos = getRecordPhotos(r);
                        return (
                          <TableRow key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 text-xs">
                            <TableCell className="text-center font-medium text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                                {formatDate(r.deliveryDate)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                  {r.shift === "TIET_4" ? "Tiết 4" : r.shift === "TIET_5" ? "Tiết 5" : "Cả ngày"}
                                </Badge>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(r.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {r.deliveredBy?.fullName || r.deliveredBy?.username || "Nhân viên"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {r.receiverName}
                              </div>
                              {r.receiverPhone && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />
                                  <span>{r.receiverPhone}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                                <span className="text-slate-700 font-bold" title="Mặn">{r.deliveredMan} M</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-600 font-bold" title="Chay">{r.deliveredChay} C</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-amber-600 font-bold" title="Cháo">{r.deliveredChao} Ch</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-black font-mono text-sm">
                                {r.totalDelivered}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-slate-500 italic" title={r.note || ""}>
                              {r.note || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {photos.length > 0 ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenGallery(r, 0)}
                                  className="h-8 text-xs font-semibold bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-blue-200 gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Xem ảnh ({photos.length})</span>
                                </Button>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Không có ảnh</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {(isAdmin || r.deliveredBy?.id === session?.user?.id) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRecord(r)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 h-8 w-8 p-0 cursor-pointer"
                                  title="Xóa phiếu này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 2. Phiên bản Compact Card cho Mobile */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {records.map((r) => {
                    const photos = getRecordPhotos(r);
                    return (
                      <div key={r.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono text-sm">
                              {formatDate(r.deliveryDate)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {r.shift === "TIET_4" ? "Tiết 4" : r.shift === "TIET_5" ? "Tiết 5" : "Cả ngày"}
                            </Badge>
                          </div>
                          {(isAdmin || r.deliveredBy?.id === session?.user?.id) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRecord(r)}
                              className="text-rose-500 hover:text-rose-700 h-7 w-7 p-0 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Nhận: <b>{r.receiverName}</b></span>
                          <span className="font-bold text-blue-700 text-sm">{r.totalDelivered} suất</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            {r.deliveredMan}M • {r.deliveredChay}C • {r.deliveredChao}Ch
                          </span>
                          {photos.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenGallery(r, 0)}
                              className="h-7 text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Xem {photos.length} ảnh</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Lightbox Gallery Phóng to ảnh ký nhận - Bố cục chuẩn PC (Ảnh dọc bên trái, Thumbnail bên phải, Nút tải ảnh) */}
      <Dialog open={!!galleryRecord} onOpenChange={(open) => !open && setGalleryRecord(null)}>
        <DialogContent className="max-w-7xl w-[98vw] h-[92vh] max-h-[95vh] p-3 sm:p-5 bg-slate-950 text-white border border-slate-800 shadow-2xl flex flex-col min-w-0 overflow-hidden rounded-2xl">
          {/* Header Modal */}
          <DialogHeader className="text-left space-y-2 pb-3 border-b border-slate-800/80 pr-10 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Images className="h-5 w-5 text-blue-500" />
                  <span>Ảnh Biên Bản Ký Nhận Suất Cơm</span>
                </DialogTitle>
                {activeGalleryPhotos.length > 0 && (
                  <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs font-mono shrink-0">
                    Trang {activePhotoIndex + 1} / {activeGalleryPhotos.length}
                  </Badge>
                )}
              </div>

              {/* Thông tin phiếu & Nút tải nhanh ở Header */}
              {galleryRecord && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[11px] sm:text-xs bg-slate-900 text-slate-300 border-slate-700 font-normal">
                    <Calendar className="h-3 w-3 mr-1 inline text-blue-400" />
                    {formatDate(galleryRecord.deliveryDate)}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] sm:text-xs bg-slate-900 text-slate-300 border-slate-700 font-normal">
                    <User className="h-3 w-3 mr-1 inline text-amber-400" />
                    {galleryRecord.receiverName}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] sm:text-xs bg-emerald-950/80 text-emerald-300 border-emerald-800 font-medium">
                    {galleryRecord.totalDelivered} suất
                  </Badge>

                  {/* Nút tải ảnh nhanh */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadCurrentPhoto}
                    disabled={downloadingSingle}
                    className="h-7 text-xs bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 gap-1.5 cursor-pointer"
                    title="Tải ảnh trang đang xem"
                  >
                    {downloadingSingle ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 text-blue-400" />}
                    <span className="hidden md:inline">Tải ảnh này</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDownloadAllPhotos}
                    disabled={downloadingZip}
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 cursor-pointer"
                    title={`Tải toàn bộ ${activeGalleryPhotos.length} ảnh trong file ZIP`}
                  >
                    {downloadingZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderArchive className="h-3 w-3" />}
                    <span className="hidden md:inline">Tải tất cả ZIP</span>
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Thân Modal: Bố cục 2 Cột trên PC (Ảnh chính dọc bên trái, Thumbnail bên phải) */}
          {activeGalleryPhotos.length > 0 && (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col lg:flex-row gap-3 pt-2 overflow-hidden">
              {/* CỘT TRÁI: KHUNG XEM ẢNH CHÍNH (Đảm bảo hiển thị trọn vẹn văn bản dọc A4) */}
              <div className="flex-1 min-w-0 h-full flex flex-col justify-between overflow-hidden bg-black/95 rounded-xl border border-slate-800/80 relative">
                {/* Vùng hiển thị ảnh chính với object-contain */}
                <div
                  className="relative w-full flex-1 h-full min-h-0 overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src={activeGalleryPhotos[activePhotoIndex]}
                    alt={`Ảnh ký nhận ${activePhotoIndex + 1}`}
                    className="max-h-full max-w-full w-auto h-auto object-contain mx-auto shadow-2xl rounded select-none transition-opacity duration-150"
                  />

                  {/* Nút Prev trên ảnh */}
                  {activeGalleryPhotos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : activeGalleryPhotos.length - 1))}
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/70 hover:bg-blue-600 text-white rounded-full backdrop-blur-md cursor-pointer transition-all active:scale-95 shadow-xl border border-white/10 z-10"
                      title="Trang trước đó (Phím ←)"
                    >
                      <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  )}

                  {/* Nút Next trên ảnh */}
                  {activeGalleryPhotos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((prev) => (prev < activeGalleryPhotos.length - 1 ? prev + 1 : 0))}
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/70 hover:bg-blue-600 text-white rounded-full backdrop-blur-md cursor-pointer transition-all active:scale-95 shadow-xl border border-white/10 z-10"
                      title="Trang tiếp theo (Phím →)"
                    >
                      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  )}
                </div>

                {/* Footer ảnh: thông tin tỉ lệ & nút mở ảnh gốc */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400 shrink-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="hidden sm:inline">Phím <strong>← →</strong> hoặc vuốt màn hình để chuyển trang</span>
                    <span className="sm:hidden">Vuốt ngang để chuyển trang</span>
                    <span>• Toàn trang dọc vừa vặn</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={activeGalleryPhotos[activePhotoIndex]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-blue-400 hover:text-blue-300 rounded text-[11px] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Mở ảnh gốc</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: DANH SÁCH THUMBNAIL DỌC VÀ KHỐI NÚT DOWNLOAD */}
              <div className="w-full lg:w-72 xl:w-80 shrink-0 h-auto lg:h-full flex flex-col bg-slate-900/80 rounded-xl border border-slate-800/80 overflow-hidden">
                {/* Header cột phải */}
                <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Images className="h-4 w-4 text-blue-400" />
                    <span>Danh Sách Trang Ký Nhận</span>
                  </div>
                  <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-mono">
                    {activeGalleryPhotos.length} trang
                  </Badge>
                </div>

                {/* Danh sách Thumbnail: Dọc trên PC, Ngang trên Mobile */}
                <div
                  ref={thumbnailContainerRef}
                  className="lg:flex-1 lg:overflow-y-auto max-lg:flex max-lg:overflow-x-auto p-2 sm:p-2.5 gap-2 space-y-0 lg:space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                >
                  {activeGalleryPhotos.map((thumbUrl, idx) => {
                    const isSelected = activePhotoIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-full flex items-center gap-2.5 p-1.5 sm:p-2 rounded-lg border transition-all text-left cursor-pointer shrink-0 max-lg:w-20 max-lg:flex-col ${
                          isSelected
                            ? "border-blue-500 bg-blue-950/60 ring-2 ring-blue-500/40 text-white shadow-md"
                            : "border-slate-800/90 bg-slate-950/40 opacity-70 hover:opacity-100 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        {/* Ảnh thumbnail */}
                        <div className="relative w-12 h-16 sm:w-14 sm:h-18 rounded overflow-hidden shrink-0 bg-black border border-slate-800">
                          <img
                            src={thumbUrl}
                            alt={`Trang ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 right-0 bg-black/85 text-[9px] text-white font-mono px-1 rounded-tl">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Thông tin mô tả trang (hiển thị trên PC) */}
                        <div className="flex-1 min-w-0 hidden lg:block">
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>Trang #{idx + 1}</span>
                            {isSelected && (
                              <Badge className="bg-blue-600 text-white text-[9px] px-1 py-0 h-4">
                                Đang xem
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            Biên bản bàn giao
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Cột Phải: KHỐI NÚT DOWNLOAD TIỆN LỢI */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/90 space-y-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCurrentPhoto}
                    disabled={downloadingSingle}
                    className="w-full h-9 bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                  >
                    {downloadingSingle ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-400" />
                    )}
                    <span>Tải ảnh đang xem (Trang #{activePhotoIndex + 1})</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDownloadAllPhotos}
                    disabled={downloadingZip}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-md"
                  >
                    {downloadingZip ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderArchive className="h-3.5 w-3.5" />
                    )}
                    <span>Tải tất cả ({activeGalleryPhotos.length} ảnh ZIP)</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
