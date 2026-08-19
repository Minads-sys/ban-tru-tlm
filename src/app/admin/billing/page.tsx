"use client";

import { useState } from "react";
import Swal from "sweetalert2";

import { numberToVietnameseWords } from "@/lib/utils";
import Barcode from "react-barcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Printer,
  FileDown,
  Loader2,
  Calculator,
  CreditCard,
} from "lucide-react";

interface BillData {
  id: string;
  studentId: string;
  month: number;
  year: number;
  scheduleMealDays: number;
  canceledDays: number;
  netPayableDays: number;
  unitPrice: string;
  totalAmount: string;
  previousDeduction: string;
  finalAmount: string;
  paymentStatus: string;
  qrCodeUrl: string | null;
  student: {
    id: string;
    mealType: string;
    user: { fullName: string };
    class: { id: string; name: string };
    mealCancellations?: { cancelDate: string }[];
  };
}

export default function BillingPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bills, setBills] = useState<BillData[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [printBillId, setPrintBillId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<BillData | null>(null);
  const [editForm, setEditForm] = useState({
    scheduleMealDays: 0,
    canceledDays: 0,
    unitPrice: 0,
    previousDeduction: 0,
    paymentStatus: "UNPAID"
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch danh sách lớp
  const fetchClasses = async () => {
    const res = await fetch("/api/students?status=ACTIVE");
    const data = await res.json();
    const uniqueClasses = new Map<string, string>();
    data.forEach((s: { classId: string; class: { name: string } }) => {
      uniqueClasses.set(s.classId, s.class.name);
    });
    setClasses(
      Array.from(uniqueClasses.entries()).map(([id, name]) => ({ id, name }))
    );
  };

  // Fetch hóa đơn
  const fetchBills = async () => {
    setLoading(true);
    try {
      if (classes.length === 0) await fetchClasses();
      if (Object.keys(settings).length === 0) await fetchSettings();
      
      let url = `/api/billing?month=${month}&year=${year}`;
      if (classFilter !== "all") url += `&classId=${classFilter}`;
      if (statusFilter !== "all") url += `&paymentStatus=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setBills(data);
      setCurrentPage(1);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải danh sách hóa đơn", "error");
    } finally {
      setLoading(false);
    }
  };

  // Tạo hóa đơn hàng loạt
  const generateBills = async () => {
    const result = await Swal.fire({
      title: "Xác nhận",
      text: `Bạn có muốn tạo hóa đơn tháng ${month}/${year} cho tất cả học sinh đang ăn bán trú?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Tạo hóa đơn",
      cancelButtonText: "Hủy"
    });
    if (!result.isConfirmed) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchBills();
      } else {
        Swal.fire("Lỗi", data.error, "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tạo hóa đơn", "error");
    } finally {
      setGenerating(false);
    }
  };

  // In phiếu hàng loạt
  const printBills = () => {
    setPrintBillId("ALL");
    setTimeout(() => window.print(), 800);
  };

  const printSingleBill = (id: string) => {
    setPrintBillId(id);
    setTimeout(() => window.print(), 800);
  };

  const openEditModal = (bill: BillData) => {
    setEditingBill(bill);
    setEditForm({
      scheduleMealDays: bill.scheduleMealDays,
      canceledDays: bill.canceledDays,
      unitPrice: parseInt(bill.unitPrice),
      previousDeduction: parseInt(bill.previousDeduction),
      paymentStatus: bill.paymentStatus,
    });
  };

  const saveEditBill = async () => {
    if (!editingBill) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBill.id,
          ...editForm
        })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", "Đã cập nhật hóa đơn", "success");
        setEditingBill(null);
        fetchBills();
      } else {
        Swal.fire("Lỗi", data.error, "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi lưu hóa đơn", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const formatVND = (amount: string | number) => {
    const num = typeof amount === "string" ? parseInt(amount) : amount;
    return new Intl.NumberFormat("vi-VN").format(num) + "đ";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-100 text-green-700">Đã thanh toán</Badge>;
      case "PARTIAL":
        return <Badge className="bg-yellow-100 text-yellow-700">Thanh toán 1 phần</Badge>;
      case "SETTLED":
        return <Badge className="bg-blue-100 text-blue-700">Đã quyết toán</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700">Chưa thanh toán</Badge>;
    }
  };

  // Tổng hợp
  const totalFinal = bills.reduce((sum, b) => sum + parseInt(b.finalAmount), 0);
  const totalPaid = bills.filter((b) => b.paymentStatus === "PAID").length;
  const totalUnpaid = bills.filter((b) => b.paymentStatus === "UNPAID").length;

  const ITEMS_PER_PAGE = 25;
  const totalPages = Math.ceil(bills.length / ITEMS_PER_PAGE);
  const paginatedBills = bills.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 no-print flex items-center gap-2">
        <Receipt className="h-6 w-6 text-blue-600" />
        Hóa đơn & Thanh toán
      </h1>

      {/* Bộ lọc */}
      <Card className="mb-6 no-print">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label>Tháng</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Năm</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Lớp</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="UNPAID">Chưa TT</SelectItem>
                  <SelectItem value="PAID">Đã TT</SelectItem>
                  <SelectItem value="PARTIAL">TT 1 phần</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchBills} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải dữ liệu"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nút hành động */}
      <div className="flex gap-3 mb-4 no-print">
        <Button onClick={generateBills} disabled={generating} variant="default">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Calculator className="h-4 w-4 mr-2" />
          )}
          Tạo hóa đơn tháng {month}/{year}
        </Button>
        <Button onClick={printBills} variant="outline" disabled={bills.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          In phiếu hàng loạt
        </Button>
      </div>

      {/* Tổng hợp */}
      {bills.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 no-print">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Tổng hóa đơn</p>
              <p className="text-2xl font-bold">{bills.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Đã thanh toán</p>
              <p className="text-2xl font-bold text-green-600">{totalPaid}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Chưa thanh toán</p>
              <p className="text-2xl font-bold text-red-600">{totalUnpaid}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Tổng tiền</p>
              <p className="text-xl font-bold text-blue-600">{formatVND(totalFinal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bảng hóa đơn */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Danh sách hóa đơn tháng {month}/{year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>STT</TableHead>
                <TableHead>Mã HS</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="text-center">Ngày ăn</TableHead>
                <TableHead className="text-center">Ngày cắt</TableHead>
                <TableHead className="text-right">Trừ T.trước</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBills.map((bill, idx) => (
                <TableRow key={bill.id}>
                  <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                  <TableCell className="font-mono">{bill.studentId}</TableCell>
                  <TableCell>{bill.student.user.fullName}</TableCell>
                  <TableCell>{bill.student.class.name}</TableCell>
                  <TableCell className="text-center">{bill.netPayableDays}</TableCell>
                  <TableCell className="text-center">{bill.canceledDays}</TableCell>
                  <TableCell className="text-right">{formatVND(bill.previousDeduction)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVND(bill.finalAmount)}
                  </TableCell>
                  <TableCell>{statusBadge(bill.paymentStatus)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => printSingleBill(bill.id)}
                      >
                        In phiếu
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openEditModal(bill)}
                      >
                        Sửa phiếu
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {bills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-400 py-8">
                    <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Chưa có dữ liệu. Bấm &quot;Tải dữ liệu&quot; để xem hóa đơn.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-4 mt-4">
              <span className="text-sm text-gray-600">
                Trang {currentPage} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =============== PHIẾU IN HÀNG LOẠT HOẶC CÁ NHÂN (Chỉ hiện khi in) =============== */}
      <div className="absolute -z-50 opacity-0 print:static print:z-auto print:opacity-100 print:w-full print:m-0 print:p-0 print-bw" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            .print-bw, .print-bw * {
              color: #000 !important;
              border-color: #000 !important;
              background-color: transparent !important;
            }
          }
        `}} />
        {bills.filter((b) => printBillId === "ALL" || b.id === printBillId).map((bill, idx, arr) => (
          <div
            key={bill.id}
            className={`p-4 w-full max-w-[148mm] mx-auto ${idx < arr.length - 1 ? "print-break" : ""}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="pr-2">
                <h1 className="text-lg font-bold uppercase leading-tight">{settings.SCHOOL_NAME || "TRƯỜNG TIỂU HỌC BAN TRÚ"}</h1>
                {settings.SCHOOL_ADDRESS && <p className="text-xs mt-1">{settings.SCHOOL_ADDRESS}</p>}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <Barcode 
                  value={`PT${bill.month}${bill.year}${bill.studentId.split('-').pop()}`} 
                  height={40} 
                  width={1.5} 
                  fontSize={13} 
                  margin={0} 
                  displayValue={true} 
                />
              </div>
            </div>

            <div className="text-center mb-3 border-b-2 border-black pb-2">
              <h2 className="text-base font-bold mt-1 mb-1">PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ</h2>
              <p className="text-sm italic">Tháng {bill.month} / {bill.year}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 text-sm border-b border-black pb-3">
              <div className="space-y-2">
                <p><span className="font-semibold inline-block w-24">Mã HS:</span> {bill.studentId}</p>
                <p><span className="font-semibold inline-block w-24">Họ tên:</span> {bill.student.user.fullName}</p>
                <p><span className="font-semibold inline-block w-24">Lớp:</span> {bill.student.class.name}</p>
                <p><span className="font-semibold inline-block w-24">Loại suất:</span> {bill.student.mealType === "MAN" ? "Mặn" : bill.student.mealType === "CHAY" ? "Chay" : "Cháo"}</p>
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold inline-block w-44">Số ngày ăn dự kiến:</span> {bill.scheduleMealDays} ngày</p>
                <p><span className="font-semibold inline-block w-44">Số ngày cắt suất:</span> {bill.canceledDays} ngày</p>
                <div>
                  <span className="font-semibold inline-block w-44">Trừ tiền tháng trước:</span> 
                  {formatVND(bill.previousDeduction)}
                  <p className="text-sm text-gray-500 italic mt-1">
                    (Hủy suất ăn của tháng {bill.month === 1 ? 12 : bill.month - 1}/{bill.month === 1 ? bill.year - 1 : bill.year})
                  </p>
                </div>
                <p><span className="font-semibold inline-block w-32">Đơn giá:</span> {formatVND(bill.unitPrice)}/suất</p>
              </div>
            </div>

            {bill.student.mealCancellations && bill.student.mealCancellations.length > 0 && (
              <div className="mb-3 text-xs bg-gray-50 p-2 rounded print:bg-transparent print:border print:border-black print:rounded-lg">
                <p className="font-semibold mb-1">Chi tiết các ngày đã duyệt cắt suất:</p>
                <div className="flex flex-wrap gap-1">
                  {bill.student.mealCancellations.map((c, i) => (
                    <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
                      {new Date(c.cancelDate).toLocaleDateString('vi-VN')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-2 border-black py-2 my-3 text-center bg-gray-100 print:bg-transparent print:rounded-none rounded-lg">
              <p className="text-lg font-bold mb-0.5">
                SỐ TIỀN CẦN NỘP: {formatVND(bill.finalAmount)}
              </p>
              <p className="text-sm italic">
                (Bằng chữ: {numberToVietnameseWords(Number(bill.finalAmount))})
              </p>
            </div>

            <div className="mt-4 border-2 border-dashed border-gray-400 print:border-black p-3 rounded-lg flex items-center">
              {bill.qrCodeUrl && (
                <div className="shrink-0 mr-4 border border-gray-200 print:border-black p-1 bg-white">
                  <img
                    src={bill.qrCodeUrl}
                    alt={`QR thanh toán ${bill.studentId}`}
                    className="w-40 h-40 object-contain"
                    loading="eager"
                  />
                </div>
              )}
              <div>
                <p className="text-base font-bold mb-2">QUÉT MÃ QR ĐỂ THANH TOÁN TỰ ĐỘNG</p>
                <p className="text-sm mb-1">
                  Hoặc chuyển khoản thủ công với nội dung (Bắt buộc):
                </p>
                <span className="font-bold text-lg inline-block mt-1 px-3 py-1 border-2 border-black bg-gray-100 print:bg-transparent">
                  BSTLM {bill.studentId} T{bill.month}
                </span>
                <p className="text-xs mt-3 italic text-gray-700 print:text-black">
                  * Vui lòng nhập ĐÚNG nội dung chuyển khoản để hệ thống tự động gạch nợ.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingBill} onOpenChange={(open) => !open && setEditingBill(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sửa hóa đơn</DialogTitle>
          </DialogHeader>
          {editingBill && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Số ngày ăn dự kiến</Label>
                <Input 
                  type="number" 
                  value={editForm.scheduleMealDays} 
                  onChange={(e) => setEditForm({...editForm, scheduleMealDays: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Số ngày cắt suất</Label>
                <Input 
                  type="number" 
                  value={editForm.canceledDays} 
                  onChange={(e) => setEditForm({...editForm, canceledDays: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Đơn giá</Label>
                <Input 
                  type="number" 
                  value={editForm.unitPrice} 
                  onChange={(e) => setEditForm({...editForm, unitPrice: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Trừ tiền tháng trước</Label>
                <Input 
                  type="number" 
                  value={editForm.previousDeduction} 
                  onChange={(e) => setEditForm({...editForm, previousDeduction: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select value={editForm.paymentStatus} onValueChange={(val) => setEditForm({...editForm, paymentStatus: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">Chưa thanh toán</SelectItem>
                    <SelectItem value="PARTIAL">Thanh toán 1 phần</SelectItem>
                    <SelectItem value="PAID">Đã thanh toán</SelectItem>
                    <SelectItem value="SETTLED">Đã quyết toán</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBill(null)}>Hủy</Button>
            <Button onClick={saveEditBill} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
