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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileCheck2,
  Printer,
  History,
  AlertTriangle,
  CheckCircle,
  Clock,
  RotateCcw,
  Banknote,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, numberToVietnameseWords, formatDate, getVietnamTodayString } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { CashHandoverPrint, CashHandoverClosingData } from "./cash-handover-print";

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export function CashClosingManager({ currentUser }: { currentUser: any }) {
  const [activeTab, setActiveTab] = useState("closing-today");

  // TAB 1: Chốt ca hôm nay
  const [unclosedData, setUnclosedData] = useState<{
    count: number;
    totalAmount: number;
    transactions: any[];
  }>({ count: 0, totalAmount: 0, transactions: [] });
  const [loadingUnclosed, setLoadingUnclosed] = useState(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    500000: 0,
    200000: 0,
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
  });
  const [closingNote, setClosingNote] = useState("");
  const [submittingClosing, setSubmittingClosing] = useState(false);

  // TAB 2: Lịch sử biên bản bàn giao
  const [historyClosings, setHistoryClosings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal in Biên bản A4
  const [handoverPrintData, setHandoverPrintData] = useState<CashHandoverClosingData | null>(null);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // TAB 3: Quản lý Hủy phiếu (Chỉ Kế toán / Admin)
  const isAccountantOrAdmin =
    currentUser?.role === "ADMIN" ||
    hasPermission(currentUser?.permissions || [], "MANAGE_FINANCE");

  const [voidSearchTerm, setVoidSearchTerm] = useState("");
  const [voidReceipts, setVoidReceipts] = useState<any[]>([]);
  const [loadingVoidReceipts, setLoadingVoidReceipts] = useState(false);

  // Tải danh sách giao dịch chưa chốt ca
  const fetchUnclosed = useCallback(async () => {
    setLoadingUnclosed(true);
    try {
      const res = await fetch("/api/billing/cash-closing?mode=current");
      const data = await res.json();
      if (data.success) {
        setUnclosedData({
          count: data.count,
          totalAmount: data.totalAmount,
          transactions: data.transactions,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUnclosed(false);
    }
  }, []);

  // Tải lịch sử các biên bản bàn giao
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/billing/cash-closing?mode=history&limit=50");
      const data = await res.json();
      if (data.success) {
        setHistoryClosings(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "closing-today") {
      fetchUnclosed();
    } else if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchUnclosed, fetchHistory]);

  // Tính tổng tiền kiểm đếm từ bảng kê mệnh giá
  const countedTotal = DENOMINATIONS.reduce((sum, d) => sum + (denomCounts[d] || 0) * d, 0);
  const countedDiff = countedTotal - unclosedData.totalAmount;

  const handleDenomChange = (val: number, count: number) => {
    setDenomCounts((prev) => ({
      ...prev,
      [val]: Math.max(0, count),
    }));
  };

  // Nút Chốt ca & Lập biên bản bàn giao
  const handleSubmitClosing = async () => {
    if (unclosedData.count === 0) {
      Swal.fire("Thông báo", "Không có phiếu thu tiền mặt nào chưa chốt ca để bàn giao!", "warning");
      return;
    }

    if (countedDiff !== 0) {
      const confirmDiff = await Swal.fire({
        title: countedDiff > 0 ? "Thừa tiền thực tế" : "Thiếu tiền thực tế",
        html: `Tiền kiểm đếm: <b>${formatCurrency(countedTotal)}</b><br/>Tiền trên phần mềm: <b>${formatCurrency(unclosedData.totalAmount)}</b><br/>Chênh lệch: <b class="${countedDiff > 0 ? "text-blue-600" : "text-rose-600"}">${formatCurrency(countedDiff)}</b><br/><br/>Bạn có chắc chắn muốn chốt ca với số liệu này?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Vẫn chốt ca",
        cancelButtonText: "Kiểm đếm lại",
      });
      if (!confirmDiff.isConfirmed) return;
    }

    setSubmittingClosing(true);
    try {
      const res = await fetch("/api/billing/cash-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          denominationData: denomCounts,
          note: closingNote,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire("Chốt ca thành công!", data.message, "success");

        // Lấy chi tiết biên bản vừa lập để mở cửa sổ in A4
        await handleOpenPrintDetail(data.closing.id);

        // Reset form và tải lại dữ liệu
        setClosingNote("");
        setDenomCounts({
          500000: 0,
          200000: 0,
          100000: 0,
          50000: 0,
          20000: 0,
          10000: 0,
          5000: 0,
          2000: 0,
          1000: 0,
        });
        fetchUnclosed();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể lập biên bản chốt ca", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingClosing(false);
    }
  };

  // Xem và in chi tiết Biên bản bàn giao A4
  const handleOpenPrintDetail = async (closingId: string) => {
    try {
      const res = await fetch(`/api/billing/cash-closing?mode=detail&id=${closingId}`);
      const data = await res.json();
      if (data.success && data.closing) {
        setHandoverPrintData(data.closing);
        setOpenPrintModal(true);
      } else {
        Swal.fire("Lỗi", "Không thể tải chi tiết biên bản bàn giao", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối", "error");
    }
  };

  // Kế toán xác nhận nhận đủ tiền
  const handleAccountantConfirm = async (closingId: string, code: string) => {
    const confirmBox = await Swal.fire({
      title: "Xác nhận nhận đủ tiền?",
      text: `Bạn có chắc chắn đã kiểm đếm và nhận đủ tiền mặt theo biên bản ${code}? Thao tác này sẽ KHÓA CỨNG toàn bộ phiếu thu trong ca!`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Xác nhận nhận tiền",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#059669",
    });

    if (!confirmBox.isConfirmed) return;

    try {
      const res = await fetch("/api/billing/cash-closing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingId,
          action: "CONFIRM",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire("Thành công", data.message, "success");
        fetchHistory();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xác nhận", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    }
  };

  // TAB 3: Tìm kiếm phiếu thu để hủy (Chỉ Kế toán / Admin)
  const handleSearchVoidReceipts = async () => {
    if (!voidSearchTerm.trim()) return;
    setLoadingVoidReceipts(true);
    try {
      const res = await fetch(`/api/billing/cash-payment?search=${encodeURIComponent(voidSearchTerm.trim())}&limit=20`);
      const data = await res.json();
      if (data.data) {
        setVoidReceipts(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVoidReceipts(false);
    }
  };

  // Kế toán / Admin thực hiện hủy phiếu thu
  const handleExecuteVoid = async (rc: any) => {
    const { value: formValues } = await Swal.fire({
      title: `HỦY PHIẾU THU ${rc.receiptNumber}`,
      html: `
        <div class="text-left text-xs space-y-2 text-slate-700">
          <div class="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">
            <b>CẢNH BÁO QUAN TRỌNG:</b> Thao tác này sẽ trừ số tiền <b>${formatCurrency(rc.amount)}</b> khỏi doanh thu và đưa công nợ của học sinh <b>${rc.student?.fullName}</b> quay lại trạng thái chưa thanh toán.
          </div>
          <div class="pt-1">
            <label class="font-bold block mb-1">Xác nhận đã thu hồi phiếu in giấy gốc: <span class="text-rose-600">*</span></label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="swal-recovered-check" class="rounded text-rose-600" />
              <span>Đã thu hồi lại phiếu thu giấy từ phụ huynh / học sinh</span>
            </label>
          </div>
          <div class="pt-2">
            <label class="font-bold block mb-1">Lý do hủy chi tiết (bắt buộc lưu vết): <span class="text-rose-600">*</span></label>
            <textarea id="swal-void-reason" class="swal2-textarea w-full text-xs p-2 m-0 border rounded" placeholder="VD: Nhập nhầm số tiền, học sinh xin chuyển sang tháng sau..."></textarea>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận Hủy Phiếu",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Đóng",
      focusConfirm: false,
      preConfirm: () => {
        const recovered = (document.getElementById("swal-recovered-check") as HTMLInputElement)?.checked;
        const reason = (document.getElementById("swal-void-reason") as HTMLTextAreaElement)?.value;
        if (!recovered) {
          Swal.showValidationMessage("Bạn phải xác nhận đã thu hồi phiếu giấy gốc!");
          return false;
        }
        if (!reason || reason.trim().length < 5) {
          Swal.showValidationMessage("Vui lòng nhập lý do hủy chi tiết (tối thiểu 5 ký tự)!");
          return false;
        }
        return { reason: reason.trim() };
      },
    });

    if (!formValues) return;

    try {
      const res = await fetch("/api/billing/cash-payment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: rc.id,
          voidReason: formValues.reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire("Đã hủy phiếu thu thành công", data.message, "success");
        handleSearchVoidReceipts();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể hủy phiếu thu", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi kết nối", "error");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[600px] mb-4">
          <TabsTrigger value="closing-today" className="flex items-center gap-2 text-xs sm:text-sm">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            Chốt Ca Hôm Nay
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 text-xs sm:text-sm">
            <History className="h-4 w-4 text-indigo-600" />
            Lịch Sử Bàn Giao ({historyClosings.length})
          </TabsTrigger>
          {isAccountantOrAdmin && (
            <TabsTrigger
              value="void-manager"
              className="flex items-center gap-2 text-xs sm:text-sm text-rose-700 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-800"
            >
              <ShieldAlert className="h-4 w-4" />
              Quản Lý Hủy Phiếu (Kế toán)
            </TabsTrigger>
          )}
        </TabsList>

        {/* ================= TAB 1: CHỐT CA HÔM NAY ================= */}
        <TabsContent value="closing-today" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BẢNG KÊ TIỀN & ĐỐI CHIẾU MỆNH GIÁ (7 CỘT) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b bg-slate-50/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-emerald-600" />
                        Bảng Kê Mệnh Giá Tiền Mặt Bàn Giao
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Thu ngân kiểm đếm két và nhập số tờ của từng loại mệnh giá
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <tr className="bg-slate-50 text-[11px]">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Mệnh giá</TableHead>
                        <TableHead className="w-32 text-center">Số tờ kiểm đếm</TableHead>
                        <TableHead className="text-right">Thành tiền (đ)</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {DENOMINATIONS.map((val, idx) => {
                        const count = denomCounts[val] || 0;
                        const subTotal = count * val;
                        return (
                          <TableRow key={val}>
                            <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-xs text-slate-800">
                              {new Intl.NumberFormat("vi-VN").format(val)} đ
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="0"
                                value={count === 0 ? "" : count}
                                placeholder="0"
                                onChange={(e) => handleDenomChange(val, parseInt(e.target.value || "0", 10))}
                                className="h-8 w-24 text-center font-bold text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-slate-900">
                              {subTotal > 0 ? formatCurrency(subTotal) : "0 đ"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* TỔNG KẾT & XÁC NHẬN CHỐT CA (5 CỘT) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-blue-200 shadow-md bg-white">
                <CardHeader className="bg-blue-600 text-white rounded-t-xl pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5" />
                    Tổng Hợp Chốt Ca Thu Ngân
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-xs">
                    Đối chiếu tiền thực tế vs tiền ghi nhận trên hệ thống
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-xs">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-600 font-medium">Số phiếu thu trong ca:</span>
                      <span className="text-base font-bold text-slate-900">{unclosedData.count} phiếu</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-blue-50/70 rounded-xl border border-blue-200">
                      <span className="text-blue-900 font-semibold">Tổng tiền trên phần mềm:</span>
                      <span className="text-lg font-black text-blue-800">
                        {formatCurrency(unclosedData.totalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                      <span className="text-emerald-900 font-semibold">Tổng tiền kiểm đếm thực tế:</span>
                      <span className="text-lg font-black text-emerald-800">
                        {formatCurrency(countedTotal)}
                      </span>
                    </div>

                    {/* HIỂN THỊ CHÊNH LỆCH */}
                    <div
                      className={`p-3 rounded-xl border flex justify-between items-center ${
                        countedDiff === 0
                          ? "bg-emerald-100/70 border-emerald-300 text-emerald-900"
                          : countedDiff > 0
                          ? "bg-blue-100/70 border-blue-300 text-blue-900"
                          : "bg-rose-100/70 border-rose-300 text-rose-900"
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1.5">
                        {countedDiff === 0 ? (
                          <CheckCircle className="h-4 w-4 text-emerald-700" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                        )}
                        Chênh lệch (Thực tế - Phần mềm):
                      </span>
                      <span className="text-base font-black">
                        {countedDiff === 0 ? "0 đ (Khớp 100%)" : formatCurrency(countedDiff)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="closingNote" className="text-slate-600 text-xs">Ghi chú bàn giao:</Label>
                    <Input
                      id="closingNote"
                      placeholder="VD: Ca sáng có 1 tờ 50k bị rách nhẹ..."
                      value={closingNote}
                      onChange={(e) => setClosingNote(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitClosing}
                    disabled={submittingClosing || unclosedData.count === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {submittingClosing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Printer className="h-5 w-5" />
                    )}
                    <span>CHỐT CA & IN BIÊN BẢN BÀN GIAO (A4)</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 2: LỊCH SỬ BIÊN BẢN BÀN GIAO ================= */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                Danh Sách Biên Bản Bàn Giao Tiền Mặt Đã Lập
              </CardTitle>
              <CardDescription className="text-xs">
                Kế toán kiểm đếm thực tế và bấm Xác nhận để khóa sổ vĩnh viễn
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Đang tải danh sách biên bản...
                </div>
              ) : historyClosings.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Chưa có biên bản bàn giao nào được lập.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <tr className="bg-slate-50 text-[11px]">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Mã biên bản</TableHead>
                        <TableHead>Ngày bàn giao</TableHead>
                        <TableHead>Người nộp (Thu ngân)</TableHead>
                        <TableHead>Người nhận (Kế toán)</TableHead>
                        <TableHead className="text-center">Số phiếu</TableHead>
                        <TableHead className="text-right">Tổng tiền</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {historyClosings.map((c, idx) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-center text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-bold text-xs text-blue-700">
                            {c.code}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(c.closingDate)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {c.cashier?.fullName || "Thu ngân"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.accountant?.fullName ? (
                              <span className="font-medium text-emerald-700">{c.accountant.fullName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa nhận</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-bold">
                            {c.totalTransactions}
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-rose-600">
                            {formatCurrency(c.totalAmount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.status === "CONFIRMED" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Đã khóa sổ</Badge>
                            ) : c.status === "REJECTED" ? (
                              <Badge variant="destructive" className="text-[10px]">Đã từ chối</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px]">Chờ xác nhận</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPrintDetail(c.id)}
                              className="h-7 px-2 text-[11px]"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              In A4
                            </Button>

                            {/* Nút xác nhận nhận tiền: Chỉ dành cho Kế toán hoặc Admin khi đang ở trạng thái PENDING */}
                            {isAccountantOrAdmin && c.status === "PENDING" && (
                              <Button
                                size="sm"
                                onClick={() => handleAccountantConfirm(c.id, c.code)}
                                className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Xác nhận nhận tiền
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

        {/* ================= TAB 3: QUẢN LÝ HỦY PHIẾU (CHỈ KẾ TOÁN / ADMIN) ================= */}
        {isAccountantOrAdmin && (
          <TabsContent value="void-manager" className="space-y-6">
            <Card className="border-rose-200 shadow-sm bg-rose-50/20">
              <CardHeader className="pb-3 border-b border-rose-100">
                <CardTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  Khu Vực Quản Lý & Hủy Phiếu Thu Sai Sót (Dành Cho Kế Toán)
                </CardTitle>
                <CardDescription className="text-xs text-rose-700">
                  Thu ngân tuyệt đối không có quyền hủy phiếu. Chỉ Kế toán/Admin được phép hủy khi đã thu hồi phiếu giấy gốc và có lý do chính đáng.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nhập mã phiếu thu (VD: PT-20260904-0001), tên học sinh, hoặc mã bán trú..."
                    value={voidSearchTerm}
                    onChange={(e) => setVoidSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchVoidReceipts()}
                    className="bg-white text-xs"
                  />
                  <Button onClick={handleSearchVoidReceipts} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                    Tìm kiếm phiếu
                  </Button>
                </div>

                {voidReceipts.length > 0 && (
                  <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                    <Table>
                      <TableHeader>
                        <tr className="bg-slate-50 text-[11px]">
                          <TableHead>Mã phiếu</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Lớp</TableHead>
                          <TableHead>Thu ngân</TableHead>
                          <TableHead className="text-right">Số tiền</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {voidReceipts.map((rc) => (
                          <TableRow key={rc.id}>
                            <TableCell className="font-mono font-bold text-xs">{rc.receiptNumber}</TableCell>
                            <TableCell className="font-medium text-xs uppercase">{rc.student?.fullName}</TableCell>
                            <TableCell className="text-xs">{rc.student?.className}</TableCell>
                            <TableCell className="text-xs">{rc.cashierName}</TableCell>
                            <TableCell className="text-right font-bold text-xs text-rose-600">
                              {formatCurrency(rc.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              {rc.isVoided ? (
                                <Badge variant="destructive" className="text-[10px]">Đã hủy</Badge>
                              ) : rc.closingSessionStatus === "CONFIRMED" ? (
                                <Badge className="bg-slate-200 text-slate-800 text-[10px]">Đã khóa sổ</Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Hợp lệ</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!rc.isVoided && rc.closingSessionStatus !== "CONFIRMED" ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleExecuteVoid(rc)}
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Hủy phiếu thu này
                                </Button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Không thể hủy</span>
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
        )}
      </Tabs>

      {/* DIALOG XEM VÀ IN BIÊN BẢN BÀN GIAO A4 */}
      <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {handoverPrintData && (
            <CashHandoverPrint
              data={handoverPrintData}
              onClose={() => setOpenPrintModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
