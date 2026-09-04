"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Swal from "sweetalert2";
import QRCode from "qrcode";
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
  Search,
  CreditCard,
  Banknote,
  Printer,
  QrCode,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  Receipt,
  User,
  History,
  FileText,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, numberToVietnameseWords, maskStudentCode, getVietnamTodayString } from "@/lib/utils";
import { generateMealPaymentQR } from "@/lib/vietqr";
import { CashReceiptPrint, CashReceiptData } from "./cash-receipt-print";

interface StudentSearchResult {
  id: string;
  studentCode: string; // CCCD
  boardingCode: string | null;
  classId: string;
  class?: { name: string };
  user?: { fullName: string };
}

interface BillItem {
  id: string;
  month: number;
  year: number;
  finalAmount: number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL" | "SETTLED";
  transactions?: Array<{ id: string; amount: number; isVoided?: boolean }>;
}

export function CashPos({ currentUser }: { currentUser: any }) {
  // Tìm kiếm học sinh
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  // Danh sách hóa đơn của học sinh
  const [studentBills, setStudentBills] = useState<BillItem[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillItem | null>(null);

  // Form thu tiền mặt
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [customerPaid, setCustomerPaid] = useState<number>(0);
  const [note, setNote] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Modal in phiếu thu
  const [printReceiptData, setPrintReceiptData] = useState<CashReceiptData | null>(null);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // Modal hiển thị VietQR tại quầy
  const [openQrModal, setOpenQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [qrDetails, setQrDetails] = useState<{ amount: number; content: string; bankAccount: string } | null>(null);

  // Danh sách phiếu thu tiền mặt trong ngày của Thu ngân
  const [todayReceipts, setTodayReceipts] = useState<any[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phím tắt bàn phím: F2 tìm kiếm, F9 thanh toán
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "F9" && selectedBill && collectAmount > 0 && !submittingPayment) {
        e.preventDefault();
        handleConfirmPayment();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Tải danh sách phiếu thu tiền mặt hôm nay của Thu ngân
  const fetchTodayReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const today = getVietnamTodayString();
      const res = await fetch(`/api/billing/cash-payment?date=${today}&limit=100`);
      const data = await res.json();
      if (data.data) {
        setTodayReceipts(data.data);
        setTodayTotal(data.stats?.totalAmount || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReceipts(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayReceipts();
  }, [fetchTodayReceipts]);

  // Tìm kiếm học sinh tự động (debounce)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(searchTerm.trim())}&limit=10`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else if (data.data) {
          setSearchResults(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Khi chọn một học sinh -> Tải tất cả hóa đơn của học sinh đó
  const handleSelectStudent = async (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSearchTerm("");
    setSearchResults([]);
    setLoadingBills(true);
    setSelectedBill(null);
    setCollectAmount(0);
    setCustomerPaid(0);

    try {
      const res = await fetch(`/api/billing?studentId=${student.id}&limit=50`);
      const json = await res.json();
      const rawBills = Array.isArray(json) ? json : json.data || [];

      // Sắp xếp: Ưu tiên tháng còn nợ lên trước, năm giảm dần, tháng giảm dần
      const formattedBills: BillItem[] = rawBills.map((b: any) => ({
        id: b.id,
        month: b.month,
        year: b.year,
        finalAmount: Number(b.finalAmount),
        paymentStatus: b.paymentStatus,
        transactions: b.transactions || [],
      }));

      setStudentBills(formattedBills);

      // Tự động chọn hóa đơn nợ gần nhất
      const firstUnpaid = formattedBills.find(
        (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
      );
      if (firstUnpaid) {
        selectBillToPay(firstUnpaid);
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải danh sách hóa đơn của học sinh", "error");
    } finally {
      setLoadingBills(false);
    }
  };

  // Chọn hóa đơn để thu tiền
  const selectBillToPay = (bill: BillItem) => {
    setSelectedBill(bill);
    const paid = (bill.transactions || [])
      .filter((t) => !t.isVoided)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const remaining = Math.max(0, bill.finalAmount - paid);
    setCollectAmount(remaining);
    setCustomerPaid(remaining);
  };

  // Tính số tiền còn nợ của một hóa đơn
  const getBillRemainingDebt = (bill: BillItem) => {
    const paid = (bill.transactions || [])
      .filter((t) => !t.isVoided)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return Math.max(0, bill.finalAmount - paid);
  };

  // Mở popup QR Code VietQR động
  const handleOpenQrModal = async (bill: BillItem) => {
    if (!selectedStudent) return;
    const debt = getBillRemainingDebt(bill);
    const code = selectedStudent.boardingCode || selectedStudent.studentCode;

    const qrUrl = generateMealPaymentQR(code, bill.month, bill.year, debt);
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 300 });
      setQrCodeDataUrl(dataUrl);
      const mm = String(bill.month).padStart(2, "0");
      const yy = String(bill.year).slice(-2);
      setQrDetails({
        amount: debt,
        content: `BSTLM ${code} T${mm}${yy}`,
        bankAccount: "Tài khoản Bán Trú Trường",
      });
      setOpenQrModal(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tạo mã QR", "error");
    }
  };

  // Xác nhận thu tiền mặt
  const handleConfirmPayment = async () => {
    if (!selectedStudent || !selectedBill) {
      Swal.fire("Thông báo", "Vui lòng chọn học sinh và hóa đơn cần thanh toán", "warning");
      return;
    }

    if (collectAmount <= 0) {
      Swal.fire("Thông báo", "Số tiền thu phải lớn hơn 0", "warning");
      return;
    }

    if (customerPaid < collectAmount) {
      const confirmUnder = await Swal.fire({
        title: "Cảnh báo thiếu tiền",
        text: `Tiền khách đưa (${formatCurrency(customerPaid)}) nhỏ hơn số tiền muốn thu (${formatCurrency(collectAmount)}). Bạn có muốn tiếp tục không?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Vẫn tiếp tục",
        cancelButtonText: "Hủy",
      });
      if (!confirmUnder.isConfirmed) return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/billing/cash-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          billId: selectedBill.id,
          amount: collectAmount,
          customerPaid,
          note,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Mở popup in phiếu thu ngay lập tức
        setPrintReceiptData(data.receipt);
        setOpenPrintModal(true);

        // Tải lại dữ liệu hóa đơn của học sinh và danh sách phiếu thu hôm nay
        handleSelectStudent(selectedStudent);
        fetchTodayReceipts();
        setNote("");

        Swal.fire({
          icon: "success",
          title: "Thu tiền thành công!",
          text: `Đã thu ${formatCurrency(collectAmount)} từ học sinh ${selectedStudent.user?.fullName}`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xử lý thu tiền mặt", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // In lại phiếu thu từ bảng lịch sử
  const handleReprintReceipt = (receiptItem: any) => {
    setPrintReceiptData({
      receiptNumber: receiptItem.receiptNumber,
      transDate: receiptItem.transDate,
      amount: receiptItem.amount,
      note: receiptItem.note,
      cashierName: receiptItem.cashierName,
      student: {
        fullName: receiptItem.student?.fullName || "",
        studentCode: receiptItem.student?.studentCode || "", // Đã che CCCD 4 số cuối
        boardingCode: receiptItem.student?.boardingCode || "",
        className: receiptItem.student?.className || "",
      },
      bill: receiptItem.bill,
    });
    setOpenPrintModal(true);
  };

  const changeAmount = Math.max(0, customerPaid - collectAmount);

  return (
    <div className="space-y-6">
      {/* KHUNG TÌM KIẾM HỌC SINH TẠI QUẦY */}
      <Card className="border-blue-200 shadow-sm bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Gõ Họ tên, Lớp, Mã Bán Trú, hoặc 4 số cuối CCCD (Phím tắt: F2)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-6 text-base rounded-xl border-blue-300 focus:border-blue-500 bg-white shadow-xs font-medium"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-blue-500" />
              )}
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2 whitespace-nowrap">
              <kbd className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-mono font-bold">F2</kbd> Tìm kiếm
              <kbd className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-mono font-bold ml-2">F9</kbd> Thu tiền
            </div>
          </div>

          {/* KẾT QUẢ GỢI Ý TÌM KIẾM DROPDOWN */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {searchResults.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleSelectStudent(st)}
                  className="p-3.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {st.user?.fullName?.charAt(0) || "H"}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm sm:text-base">
                        {st.user?.fullName}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Lớp: <b>{st.class?.name || st.classId}</b></span>
                        <span>•</span>
                        <span>Mã BT: <b className="text-blue-700">{st.boardingCode || "—"}</b></span>
                        <span>•</span>
                        <span>CCCD: <b className="font-mono">{maskStudentCode(st.studentCode)}</b></span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-blue-600 text-xs font-semibold">
                    Chọn <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NỘI DUNG CHÍNH KHI ĐÃ CHỌN HỌC SINH */}
      {selectedStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI (7 CỘT): THÔNG TIN HỌC SINH & DANH SÁCH HÓA ĐƠN */}
          <div className="lg:col-span-7 space-y-6">
            {/* THẺ THÔNG TIN HỌC SINH (ÁP DỤNG BẢO MẬT CHE CCCD) */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b bg-slate-50/80">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <User className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Hồ Sơ Học Sinh
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
                    Đang ăn bán trú
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Họ tên học sinh:</span>
                    <span className="text-sm font-bold text-slate-900 uppercase">
                      {selectedStudent.user?.fullName}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Lớp:</span>
                    <span className="text-sm font-bold text-blue-700">
                      {selectedStudent.class?.name || selectedStudent.classId}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[11px]">Mã Bán Trú:</span>
                    <span className="text-sm font-bold text-slate-900">
                      {selectedStudent.boardingCode || "Chưa cấp"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200">
                    <span className="text-amber-800 block text-[11px] font-medium">Mã HS (CCCD - Đã che):</span>
                    <span className="text-sm font-mono font-bold text-amber-900 tracking-wider">
                      {maskStudentCode(selectedStudent.studentCode)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DANH SÁCH CÁC THÁNG HÓA ĐƠN & NỢ CŨ */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    Danh Sách Hóa Đơn Tiền Ăn
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Bấm chọn hóa đơn để thu tiền mặt hoặc mở mã VietQR
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingBills ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải danh sách hóa đơn...
                  </div>
                ) : studentBills.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Chưa có hóa đơn nào được tạo cho học sinh này.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <tr className="bg-slate-50 text-[11px]">
                          <TableHead className="w-10 text-center">Chọn</TableHead>
                          <TableHead>Tháng</TableHead>
                          <TableHead className="text-right">Tổng tiền</TableHead>
                          <TableHead className="text-right">Còn nợ</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {studentBills.map((b) => {
                          const remainingDebt = getBillRemainingDebt(b);
                          const isSelected = selectedBill?.id === b.id;
                          const isPaid = b.paymentStatus === "PAID";

                          return (
                            <TableRow
                              key={b.id}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? "bg-blue-50/80 font-medium" : isPaid ? "opacity-75" : "hover:bg-slate-50"
                              }`}
                              onClick={() => !isPaid && selectBillToPay(b)}
                            >
                              <TableCell className="text-center">
                                <input
                                  type="radio"
                                  name="selected_bill"
                                  checked={isSelected}
                                  disabled={isPaid}
                                  onChange={() => selectBillToPay(b)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900 text-xs">
                                Tháng {String(b.month).padStart(2, "0")}/{b.year}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(b.finalAmount)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs">
                                {remainingDebt > 0 ? (
                                  <span className="text-rose-600">{formatCurrency(remainingDebt)}</span>
                                ) : (
                                  <span className="text-emerald-600">0 đ</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {b.paymentStatus === "PAID" ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Đã nộp đủ</Badge>
                                ) : b.paymentStatus === "PARTIAL" ? (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">Nộp 1 phần</Badge>
                                ) : (
                                  <Badge className="bg-rose-100 text-rose-800 text-[10px]">Còn nợ</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {remainingDebt > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenQrModal(b);
                                    }}
                                    className="h-7 px-2 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50"
                                  >
                                    <QrCode className="h-3.5 w-3.5 mr-1" />
                                    Mã QR
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CỘT PHẢI (5 CỘT): FORM THU TIỀN MẶT POS */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-blue-300 shadow-md bg-white">
              <CardHeader className="bg-blue-600 text-white rounded-t-xl pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    <CardTitle className="text-base font-bold">Thao Tác Thu Tiền Mặt</CardTitle>
                  </div>
                  {selectedBill && (
                    <Badge className="bg-blue-500 text-white border-blue-400 text-xs">
                      T{String(selectedBill.month).padStart(2, "0")}/{selectedBill.year}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {selectedBill ? (
                  <>
                    {/* Số tiền cần thu */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between text-slate-500 text-xs mb-1">
                        <span>Số tiền nợ của tháng:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(getBillRemainingDebt(selectedBill))}
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <Label htmlFor="collectAmount" className="font-bold text-slate-800 text-xs">
                          Số tiền thu thực tế (đ) <span className="text-rose-600">*</span>
                        </Label>
                        <Input
                          id="collectAmount"
                          type="number"
                          step="1000"
                          value={collectAmount || ""}
                          onChange={(e) => setCollectAmount(Number(e.target.value))}
                          className="text-lg font-black text-blue-700 text-right bg-white py-5"
                        />
                        <div className="text-[11px] text-slate-500 text-right italic">
                          ({numberToVietnameseWords(collectAmount)})
                        </div>
                      </div>

                      {/* Các nút chọn nhanh số tiền */}
                      <div className="flex gap-2 mt-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const debt = getBillRemainingDebt(selectedBill);
                            setCollectAmount(debt);
                            setCustomerPaid(debt);
                          }}
                          className="flex-1 text-[11px] h-7 bg-white"
                        >
                          Thu đủ nợ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const half = Math.round(getBillRemainingDebt(selectedBill) / 2);
                            setCollectAmount(half);
                            setCustomerPaid(half);
                          }}
                          className="flex-1 text-[11px] h-7 bg-white"
                        >
                          Thu 50%
                        </Button>
                      </div>
                    </div>

                    {/* Tiền khách đưa & Tiền thối lại */}
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                      <div>
                        <Label htmlFor="customerPaid" className="font-semibold text-amber-900 text-xs">
                          Tiền khách đưa (đ):
                        </Label>
                        <Input
                          id="customerPaid"
                          type="number"
                          step="1000"
                          value={customerPaid || ""}
                          onChange={(e) => setCustomerPaid(Number(e.target.value))}
                          className="text-base font-bold text-amber-900 text-right bg-white mt-1 py-4"
                        />
                      </div>

                      {/* Nút bấm nhanh mệnh giá tiền khách đưa */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[200000, 500000, 1000000, 2000000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomerPaid(val)}
                            className="px-2 py-1 text-[10px] font-semibold bg-white border border-amber-300 rounded hover:bg-amber-100 text-amber-900 transition-colors"
                          >
                            {val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-between items-baseline pt-2 border-t border-amber-200">
                        <span className="font-semibold text-slate-700">Tiền thừa trả lại:</span>
                        <span className="text-base font-black text-emerald-700">
                          {formatCurrency(changeAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <Label htmlFor="note" className="text-slate-600 text-xs">Ghi chú (nếu có):</Label>
                      <Input
                        id="note"
                        placeholder="VD: Phụ huynh nộp trước một phần..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="text-xs mt-1"
                      />
                    </div>

                    {/* NÚT BẤM XÁC NHẬN THU TIỀN F9 */}
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={submittingPayment || collectAmount <= 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Printer className="h-5 w-5" />
                      )}
                      <span>[F9] XÁC NHẬN THU & IN PHIẾU</span>
                    </Button>
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Receipt className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="text-xs">Vui lòng chọn 1 hóa đơn còn nợ ở bảng bên trái để thực hiện thu tiền.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* DANH SÁCH CÁC PHIẾU THU TIỀN MẶT ĐÃ LẬP HÔM NAY CỦA THU NGÂN */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              Phiếu Thu Tiền Mặt Đã Lập Hôm Nay (Ca Làm Việc)
            </CardTitle>
            <CardDescription className="text-xs">
              Các phiếu thu tiền mặt trong ngày của bạn. (Thu ngân không có quyền hủy/xóa phiếu).
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Tổng thu tiền mặt hôm nay: </span>
            <span className="text-base font-black text-rose-600 ml-1">
              {formatCurrency(todayTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingReceipts ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
              Đang tải danh sách phiếu thu...
            </div>
          ) : todayReceipts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Chưa có phiếu thu tiền mặt nào được lập trong ngày hôm nay.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <tr className="bg-slate-50 text-[11px]">
                    <TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead>Mã phiếu thu</TableHead>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Mã Bán Trú</TableHead>
                    <TableHead>Mã HS (CCCD)</TableHead>
                    <TableHead className="text-right">Số tiền thu</TableHead>
                    <TableHead className="text-center">Giờ thu</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {todayReceipts.map((rc, idx) => (
                    <TableRow key={rc.id} className={rc.isVoided ? "bg-rose-50/50 opacity-60 line-through" : ""}>
                      <TableCell className="text-center text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono font-bold text-xs text-blue-700">
                        {rc.receiptNumber}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 text-xs uppercase">
                        {rc.student?.fullName || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{rc.student?.className || "—"}</TableCell>
                      <TableCell className="font-bold text-xs text-blue-800">
                        {rc.student?.boardingCode || "—"}
                      </TableCell>
                      {/* Mã CCCD hiển thị 4 số cuối (đã được mask từ API) */}
                      <TableCell className="font-mono text-xs text-slate-600">
                        {rc.student?.studentCode || "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs text-rose-600">
                        {formatCurrency(rc.amount)}
                      </TableCell>
                      <TableCell className="text-center text-[11px] text-slate-500">
                        {new Date(rc.transDate).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        {rc.isVoided ? (
                          <Badge variant="destructive" className="text-[10px]">Đã bị hủy</Badge>
                        ) : rc.closingSessionCode ? (
                          <Badge className="bg-slate-200 text-slate-800 text-[10px]">Đã chốt ca</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Hợp lệ</Badge>
                        )}
                      </TableCell>
                      {/* CỘT THAO TÁC: TUYỆT ĐỐI CHỈ CÓ NÚT IN LẠI PHIẾU, KHÔNG CÓ NÚT HỦY/XÓA */}
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReprintReceipt(rc)}
                          className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-100"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          In lại
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG XEM TRƯỚC VÀ IN PHIẾU THU TIỀN MẶT */}
      <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {printReceiptData && (
            <CashReceiptPrint
              data={printReceiptData}
              onClose={() => setOpenPrintModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG HIỆN MÃ VIETQR TẠI QUẦY (ĐỂ PHỤ HUYNH QUÉT CHUYỂN KHOẢN TẠI CHỖ) */}
      <Dialog open={openQrModal} onOpenChange={setOpenQrModal}>
        <DialogContent className="max-w-md p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              Mã Chuyển Khoản VietQR Tại Quầy
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500">
            Hướng màn hình cho Phụ huynh dùng App Ngân hàng bất kỳ quét mã. Tiền về tài khoản sẽ tự động báo Ting-ting!
          </p>

          {qrCodeDataUrl && (
            <div className="p-3 bg-white border-2 border-blue-500 rounded-2xl shadow-md inline-block mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="VietQR" className="w-64 h-64 mx-auto" />
            </div>
          )}

          {qrDetails && (
            <div className="bg-slate-50 p-3 rounded-xl border text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Số tiền cần thanh toán:</span>
                <span className="font-bold text-rose-600 text-sm">{formatCurrency(qrDetails.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cú pháp chuyển khoản:</span>
                <span className="font-mono font-bold text-blue-700">{qrDetails.content}</span>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setOpenQrModal(false)} className="w-full text-xs">
              Đã hiểu & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
