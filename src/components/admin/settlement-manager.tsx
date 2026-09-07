"use client";

import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  User,
  Phone,
  Calendar,
  Banknote,
  Loader2,
  FileText,
} from "lucide-react";
import { formatCurrency, formatDate, maskStudentCode } from "@/lib/utils";
import ExcelJS from "exceljs";

interface Props {
  currentUser?: any;
  onSelectStudentToCollect?: (student: any) => void;
}

export function SettlementManager({ currentUser, onSelectStudentToCollect }: Props) {
  const [loading, setLoading] = useState(false);
  const [pendingCollections, setPendingCollections] = useState<any[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<any[]>([]);
  const [stats, setStats] = useState({
    collectionCount: 0,
    totalPendingDebt: 0,
    refundCount: 0,
    totalPendingRefund: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [classes, setClasses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"collections" | "refunds">("collections");

  // Modal Xác nhận hoàn tiền (Chỉ Kế toán/Admin)
  const [selectedRefundItem, setSelectedRefundItem] = useState<any | null>(null);
  const [refundMethod, setRefundMethod] = useState<string>("TIỀN MẶT");
  const [refundNote, setRefundNote] = useState<string>("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Tải danh sách lớp học
  useEffect(() => {
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClasses(data);
      })
      .catch((err) => console.error(err));
  }, []);

  // Tải danh sách chờ quyết toán
  const fetchPendingData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (selectedClass !== "all") params.append("classId", selectedClass);

      const res = await fetch(`/api/settlements/pending?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setPendingCollections(data.pendingCollections || []);
        setPendingRefunds(data.pendingRefunds || []);
        setStats(data.stats || {
          collectionCount: 0,
          totalPendingDebt: 0,
          refundCount: 0,
          totalPendingRefund: 0,
        });
      } else {
        Swal.fire("Lỗi", data.error || "Không thể tải danh sách quyết toán", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedClass]);

  useEffect(() => {
    fetchPendingData();
  }, [fetchPendingData]);

  // Mở modal xác nhận hoàn tiền
  const handleOpenRefundModal = (item: any) => {
    setSelectedRefundItem(item);
    setRefundMethod("TIỀN MẶT");
    setRefundNote("");
  };

  // Xác nhận hoàn tiền
  const handleConfirmRefund = async () => {
    if (!selectedRefundItem) return;

    setSubmittingRefund(true);
    try {
      const res = await fetch("/api/settlements/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: selectedRefundItem.settlementId,
          refundMethod,
          refundNote,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire({
          icon: "success",
          title: "Hoàn tiền thành công!",
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
        });
        setSelectedRefundItem(null);
        fetchPendingData();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xác nhận hoàn tiền", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Xuất file Excel báo cáo quyết toán
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Phần mềm Bán trú TLM";
      workbook.created = new Date();

      // Sheet 1: Chờ thu nợ
      const wsCollect = workbook.addWorksheet("1. Chờ Thu Nợ");
      wsCollect.columns = [
        { header: "STT", key: "stt", width: 6 },
        { header: "Họ và tên", key: "fullName", width: 25 },
        { header: "Lớp", key: "className", width: 10 },
        { header: "Mã Bán Trú", key: "boardingCode", width: 15 },
        { header: "CCCD", key: "studentCode", width: 18 },
        { header: "Ngày ngừng ăn", key: "boardingCancelledAt", width: 15 },
        { header: "Số tiền nợ (đ)", key: "totalRemainingDebt", width: 18 },
        { header: "Chi tiết hóa đơn", key: "billsDetail", width: 30 },
      ];

      pendingCollections.forEach((item, index) => {
        const billsDetail = (item.unpaidBills || [])
          .map((b: any) => `T${b.month}/${b.year}: ${b.remainingDebt.toLocaleString("vi-VN")}đ`)
          .join("; ");

        wsCollect.addRow({
          stt: index + 1,
          fullName: item.fullName,
          className: item.className,
          boardingCode: item.boardingCode || "",
          studentCode: item.studentCode,
          boardingCancelledAt: item.boardingCancelledAt ? formatDate(item.boardingCancelledAt) : "",
          totalRemainingDebt: item.totalRemainingDebt,
          billsDetail,
        });
      });

      // Sheet 2: Chờ Kế toán hoàn tiền
      const wsRefund = workbook.addWorksheet("2. Chờ Hoàn Tiền");
      wsRefund.columns = [
        { header: "STT", key: "stt", width: 6 },
        { header: "Họ và tên", key: "fullName", width: 25 },
        { header: "Lớp", key: "className", width: 10 },
        { header: "Mã Bán Trú", key: "boardingCode", width: 15 },
        { header: "SĐT Phụ huynh", key: "parentPhone", width: 15 },
        { header: "Ngày ngừng ăn", key: "boardingCancelledAt", width: 15 },
        { header: "Ngày quyết toán", key: "settlementDate", width: 15 },
        { header: "Số tiền hoàn (đ)", key: "refundAmount", width: 18 },
        { header: "Ghi chú quyết toán", key: "note", width: 35 },
      ];

      pendingRefunds.forEach((item, index) => {
        wsRefund.addRow({
          stt: index + 1,
          fullName: item.fullName,
          className: item.className,
          boardingCode: item.boardingCode || "",
          parentPhone: item.parentPhone || "",
          boardingCancelledAt: item.boardingCancelledAt ? formatDate(item.boardingCancelledAt) : "",
          settlementDate: item.settlementDate ? formatDate(item.settlementDate) : "",
          refundAmount: item.refundAmount,
          note: item.note || "",
        });
      });

      // Định dạng Header các sheet
      [wsCollect, wsRefund].forEach((sheet) => {
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E40AF" },
        };
        sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh_Sach_Huy_Ban_Tru_Cho_Quyet_Toan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export excel error:", err);
      Swal.fire("Lỗi", "Không thể xuất file Excel", "error");
    }
  };

  const isAccountantOrAdmin = ["ACCOUNTANT", "ADMIN"].includes(currentUser?.role);

  return (
    <div className="space-y-6">
      {/* 1. THẺ THỐNG KÊ TỔNG QUAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                Tổng HS Chờ Quyết Toán
              </p>
              <p className="text-2xl font-black text-blue-900 mt-1">
                {stats.collectionCount + stats.refundCount}
              </p>
              <p className="text-[11px] text-blue-600 mt-0.5">Đã ngừng ăn bán trú</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-blue-200/70 flex items-center justify-center text-blue-700">
              <Scale className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-700 font-semibold uppercase tracking-wider">
                Chờ Thu Nợ Tiền Ăn
              </p>
              <p className="text-2xl font-black text-rose-900 mt-1">
                {stats.collectionCount} <span className="text-xs font-normal">học sinh</span>
              </p>
              <p className="text-xs font-bold text-rose-700 mt-0.5">
                {formatCurrency(stats.totalPendingDebt)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-rose-200/70 flex items-center justify-center text-rose-700">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">
                Chờ Kế Toán Hoàn Tiền
              </p>
              <p className="text-2xl font-black text-amber-900 mt-1">
                {stats.refundCount} <span className="text-xs font-normal">học sinh</span>
              </p>
              <p className="text-xs font-bold text-amber-700 mt-0.5">
                {formatCurrency(stats.totalPendingRefund)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-200/70 flex items-center justify-center text-amber-700">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/70 shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                Quy Trình Phân Quyền
              </p>
              <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                • <b>Thu ngân:</b> Chỉ thu tiền nợ, không chi tiền.<br />
                • <b>Kế toán:</b> Duy nhất phụ trách chi hoàn tiền thừa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. BỘ LỌC VÀ NÚT THAO TÁC */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm theo tên, lớp, mã BT, CCCD..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>

              <div className="w-40">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Tất cả các lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả các lớp</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendingData}
                disabled={loading}
                className="h-9 px-3 text-xs gap-1.5"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Làm mới</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="h-9 px-3.5 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold shrink-0"
            >
              <FileDown className="h-4 w-4 text-emerald-600" />
              <span>Xuất File Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. BẢNG DỮ LIỆU CHUYÊN BIỆT THEO TAB */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-2 max-w-md h-auto p-1 bg-slate-100 border border-slate-200 rounded-xl">
          <TabsTrigger
            value="collections"
            className="flex items-center justify-center gap-2 py-2 font-bold text-xs data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>1. Chờ Thu Nợ ({pendingCollections.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="refunds"
            className="flex items-center justify-center gap-2 py-2 font-bold text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>2. Chờ Kế Toán Hoàn Tiền ({pendingRefunds.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DANH SÁCH CHỜ THU NỢ */}
        <TabsContent value="collections" className="pt-3">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b bg-slate-50/60">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4 text-rose-600" />
                    Danh Sách Học Sinh Hủy Bán Trú Còn Nợ Tiền Ăn Thực Tế
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Thu ngân hoặc Kế toán có thể thu tiền nợ của các học sinh này tại Quầy Thu Tiền.
                  </CardDescription>
                </div>
                <Badge className="bg-rose-100 text-rose-800 text-xs font-bold border-rose-300">
                  Tổng nợ: {formatCurrency(stats.totalPendingDebt)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Đang tải danh sách chờ thu nợ...
                </div>
              ) : pendingCollections.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700">Tuyệt vời! Không có học sinh nào nợ tiền quyết toán.</p>
                  <p className="text-slate-400">Tất cả các học sinh đã hủy ăn đều đã được thanh toán đầy đủ công nợ.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <tr className="bg-slate-50 text-[11px]">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Họ và tên</TableHead>
                        <TableHead className="text-center">Lớp</TableHead>
                        <TableHead>Mã Bán Trú</TableHead>
                        <TableHead>CCCD</TableHead>
                        <TableHead>Ngày ngừng ăn</TableHead>
                        <TableHead className="text-right">Số tiền còn nợ</TableHead>
                        <TableHead>Chi tiết hóa đơn</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {pendingCollections.map((item, index) => (
                        <TableRow key={item.studentId} className="hover:bg-slate-50 text-xs">
                          <TableCell className="text-center font-medium text-slate-500">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 uppercase">
                            {item.fullName}
                          </TableCell>
                          <TableCell className="text-center font-bold text-blue-700">
                            {item.className}
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-slate-800">
                            {item.boardingCode || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600">
                            {maskStudentCode(item.studentCode)}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {item.boardingCancelledAt ? formatDate(item.boardingCancelledAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-rose-600 text-sm">
                            {formatCurrency(item.totalRemainingDebt)}
                          </TableCell>
                          <TableCell className="text-[11px] text-slate-500">
                            {(item.unpaidBills || []).map((b: any) => (
                              <div key={b.id}>
                                Tháng {String(b.month).padStart(2, "0")}/{b.year}: <b>{formatCurrency(b.remainingDebt)}</b>
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-right">
                            {onSelectStudentToCollect && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onSelectStudentToCollect(item)}
                                className="h-7 text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50"
                              >
                                Thu tiền <Banknote className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: DANH SÁCH CHỜ KẾ TOÁN HOÀN TIỀN */}
        <TabsContent value="refunds" className="pt-3">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b bg-slate-50/60">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-amber-600" />
                    Danh Sách Học Sinh Chờ Kế Toán Hoàn Trả Tiền Ăn Thừa
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Nghiệp vụ chi hoàn tiền thừa do Kế toán phụ trách. Thu ngân không thực hiện chi tiền tại quầy.
                  </CardDescription>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-xs font-bold border-amber-300">
                  Tổng hoàn: {formatCurrency(stats.totalPendingRefund)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                  Đang tải danh sách chờ hoàn tiền...
                </div>
              ) : pendingRefunds.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700">Hiện tại không có học sinh nào chờ hoàn tiền.</p>
                  <p className="text-slate-400">Tất cả các khoản hoàn trả đã được Kế toán giải quyết dứt điểm.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <tr className="bg-slate-50 text-[11px]">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Họ và tên</TableHead>
                        <TableHead className="text-center">Lớp</TableHead>
                        <TableHead>Mã Bán Trú</TableHead>
                        <TableHead>SĐT Phụ huynh</TableHead>
                        <TableHead>Ngày ngừng ăn</TableHead>
                        <TableHead>Ngày quyết toán</TableHead>
                        <TableHead className="text-right">Số tiền hoàn</TableHead>
                        <TableHead>Ghi chú</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {pendingRefunds.map((item, index) => (
                        <TableRow key={item.settlementId} className="hover:bg-slate-50 text-xs">
                          <TableCell className="text-center font-medium text-slate-500">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 uppercase">
                            {item.fullName}
                          </TableCell>
                          <TableCell className="text-center font-bold text-blue-700">
                            {item.className}
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-slate-800">
                            {item.boardingCode || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600">
                            {item.parentPhone || "—"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {item.boardingCancelledAt ? formatDate(item.boardingCancelledAt) : "—"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {item.settlementDate ? formatDate(item.settlementDate) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-amber-700 text-sm">
                            {formatCurrency(item.refundAmount)}
                          </TableCell>
                          <TableCell className="text-[11px] text-slate-500 max-w-xs truncate" title={item.note || ""}>
                            {item.note || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAccountantOrAdmin ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenRefundModal(item)}
                                className="h-7 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                Hoàn tiền
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Chỉ Kế toán
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 4. MODAL KẾ TOÁN XÁC NHẬN HOÀN TIỀN */}
      <Dialog open={Boolean(selectedRefundItem)} onOpenChange={(open) => !open && setSelectedRefundItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              Kế Toán Xác Nhận Chi Hoàn Tiền Thừa
            </DialogTitle>
          </DialogHeader>

          {selectedRefundItem && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Học sinh:</span>
                  <span className="font-bold text-slate-900 uppercase">{selectedRefundItem.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lớp:</span>
                  <span className="font-bold text-blue-700">{selectedRefundItem.className}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã Bán Trú:</span>
                  <span className="font-mono font-semibold">{selectedRefundItem.boardingCode || "—"}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-200">
                  <span className="font-semibold text-slate-800">Số tiền hoàn trả:</span>
                  <span className="font-black text-amber-800 text-base">
                    {formatCurrency(selectedRefundItem.refundAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-800">
                  Hình thức chi trả <span className="text-rose-600">*</span>
                </Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIỀN MẶT">Tiền mặt (Kế toán chi trực tiếp)</SelectItem>
                    <SelectItem value="CHUYỂN KHOẢN">Chuyển khoản ngân hàng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-800">Ghi chú chứng từ / Mã giao dịch:</Label>
                <Input
                  placeholder="VD: Phụ huynh ký nhận tiền mặt ngày 07/09 / Mã CK FT123..."
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                ℹ️ Sau khi xác nhận, hệ thống sẽ đánh dấu hồ sơ này đã hoàn tất quyết toán và tự động đồng bộ trạng thái trên toàn hệ thống.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRefundItem(null)}
              disabled={submittingRefund}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRefund}
              disabled={submittingRefund}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {submittingRefund ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Xác Nhận Đã Hoàn Tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
