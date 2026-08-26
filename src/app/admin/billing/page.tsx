"use client";

import { useState, useEffect, useCallback } from "react";
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
  Layers,
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
    studentCode: string;
    boardingCode: string;
    mealType: string;
    user: { fullName: string };
    class: { id: string; name: string };
    mealCancellations?: { cancelDate: string }[];
  };
}

interface BillStats {
  totalBills: number;
  totalAmount: string;
  paidCount: number;
  unpaidCount: number;
}

export default function BillingPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bills, setBills] = useState<BillData[]>([]);
  const [stats, setStats] = useState<BillStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
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

  // Phân trang server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const ITEMS_PER_PAGE = 30;

  // Progress bar cho tạo hàng loạt
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentClass: string;
  } | null>(null);

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
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (Array.isArray(data)) {
        setClasses(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch {
      // Fallback: lấy từ students
      try {
        const res = await fetch("/api/students?status=ACTIVE");
        const data = await res.json();
        const uniqueClasses = new Map<string, string>();
        data.forEach((s: { classId: string; class: { name: string } }) => {
          uniqueClasses.set(s.classId, s.class.name);
        });
        setClasses(
          Array.from(uniqueClasses.entries()).map(([id, name]) => ({ id, name }))
        );
      } catch {
        // ignore
      }
    }
  };

  // Fetch hóa đơn với phân trang server-side
  const fetchBills = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      if (classes.length === 0) await fetchClasses();
      if (Object.keys(settings).length === 0) await fetchSettings();

      let url = `/api/billing?month=${month}&year=${year}&page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (classFilter !== "all") url += `&classId=${classFilter}`;
      if (statusFilter !== "all") url += `&paymentStatus=${statusFilter}`;
      const res = await fetch(url);
      const result = await res.json();

      if (result.data) {
        setBills(result.data);
        setTotalPages(result.totalPages || 1);
        setTotalRecords(result.total || 0);
        setStats(result.stats || null);
        setCurrentPage(page);
      } else {
        // Fallback cho format cũ
        setBills(Array.isArray(result) ? result : []);
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải danh sách hóa đơn", "error");
    } finally {
      setLoading(false);
    }
  }, [month, year, classFilter, statusFilter, classes.length, settings]);

  // Tạo hóa đơn cho 1 lớp
  const generateBillsForClass = async (targetClassId: string, className: string) => {
    const result = await Swal.fire({
      title: "Xác nhận",
      html: `Tạo hóa đơn tháng <b>${month}/${year}</b> cho lớp <b>${className}</b>?`,
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
        body: JSON.stringify({ month, year, classId: targetClassId }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchBills(1);
      } else {
        Swal.fire("Lỗi", data.error || "Lỗi khi tạo hóa đơn", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tạo hóa đơn", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Tạo hóa đơn TẤT CẢ - chạy tuần tự từng lớp với progress
  const generateBillsAll = async () => {
    // Đảm bảo đã load classes
    if (classes.length === 0) await fetchClasses();

    if (classes.length === 0) {
      Swal.fire("Lỗi", "Không tìm thấy danh sách lớp", "error");
      return;
    }

    const result = await Swal.fire({
      title: "Xác nhận tạo hóa đơn tất cả",
      html: `Tạo hóa đơn tháng <b>${month}/${year}</b> cho <b>${classes.length} lớp</b>.<br/><br/>Hệ thống sẽ xử lý <b>tuần tự từng lớp</b> để tránh quá tải.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Bắt đầu tạo",
      cancelButtonText: "Hủy"
    });
    if (!result.isConfirmed) return;

    setGenerating(true);
    setBatchProgress({ current: 0, total: classes.length, currentClass: "" });

    let successCount = 0;
    let totalStudents = 0;
    const errors: string[] = [];

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      setBatchProgress({ current: i + 1, total: classes.length, currentClass: cls.name });

      try {
        const res = await fetch("/api/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, year, classId: cls.id }),
        });
        const data = await res.json();
        if (res.ok) {
          successCount++;
          totalStudents += data.count || 0;
        } else {
          errors.push(`${cls.name}: ${data.error}`);
        }
      } catch {
        errors.push(`${cls.name}: Lỗi kết nối`);
      }
    }

    setBatchProgress(null);
    setGenerating(false);

    if (errors.length > 0) {
      Swal.fire({
        title: "Hoàn tất (có lỗi)",
        html: `Đã tạo <b>${totalStudents}</b> hóa đơn cho <b>${successCount}/${classes.length}</b> lớp.<br/><br/><b>Lỗi:</b><br/>${errors.join("<br/>")}`,
        icon: "warning",
      });
    } else {
      Swal.fire(
        "Thành công",
        `Đã tạo/cập nhật ${totalStudents} hóa đơn cho tất cả ${successCount} lớp tháng ${month}/${year}`,
        "success"
      );
    }

    fetchBills(1);
  };

  // In phiếu - chỉ in trang hiện tại
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
        fetchBills(currentPage);
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

  // Load classes on mount
  useEffect(() => {
    fetchClasses();
    fetchSettings();
  }, []);

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
              <Button onClick={() => fetchBills(1)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải dữ liệu"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nút hành động */}
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        {/* Tạo theo lớp */}
        {classFilter !== "all" ? (
          <Button
            onClick={() => {
              const cls = classes.find(c => c.id === classFilter);
              if (cls) generateBillsForClass(cls.id, cls.name);
            }}
            disabled={generating}
            variant="default"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Tạo hóa đơn lớp {classes.find(c => c.id === classFilter)?.name} — T{month}/{year}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Select
              onValueChange={(val) => {
                const cls = classes.find(c => c.id === val);
                if (cls) generateBillsForClass(cls.id, cls.name);
              }}
              disabled={generating}
            >
              <SelectTrigger className="w-[250px]">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  <span>Tạo hóa đơn theo lớp...</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tạo tất cả */}
        <Button
          onClick={generateBillsAll}
          disabled={generating}
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Layers className="h-4 w-4 mr-2" />
          )}
          Tạo tất cả ({classes.length} lớp)
        </Button>

        <Button onClick={printBills} variant="outline" disabled={bills.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          In phiếu trang hiện tại
        </Button>
      </div>

      {/* Progress bar */}
      {batchProgress && (
        <Card className="mb-4 no-print border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">
                Đang tạo hóa đơn: Lớp {batchProgress.currentClass}
              </span>
              <span className="text-sm font-semibold text-blue-700">
                {batchProgress.current}/{batchProgress.total} lớp
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {Math.round((batchProgress.current / batchProgress.total) * 100)}% hoàn thành
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tổng hợp */}
      {stats && stats.totalBills > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 no-print">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Tổng hóa đơn</p>
              <p className="text-2xl font-bold">{stats.totalBills}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Đã thanh toán</p>
              <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Chưa thanh toán</p>
              <p className="text-2xl font-bold text-red-600">{stats.unpaidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Tổng tiền</p>
              <p className="text-xl font-bold text-blue-600">{formatVND(stats.totalAmount)}</p>
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
            {totalRecords > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{totalRecords} hóa đơn</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table wrapperClassName="max-h-[65vh]">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm shadow-slate-200">
              <TableRow>
                <TableHead>STT</TableHead>
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
              {bills.map((bill, idx) => (
                <TableRow key={bill.id}>
                  <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
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
                  <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                    <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Chưa có dữ liệu. Bấm &quot;Tải dữ liệu&quot; để xem hóa đơn.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Phân trang server-side */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-600">
                Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalRecords)} / {totalRecords} hóa đơn
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchBills(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Trước
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchBills(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =============== PHIẾU IN (Chỉ render bills trang hiện tại) =============== */}
      <div className="absolute -z-50 opacity-0 print:static print:z-auto print:opacity-100 print:w-full print:m-0 print:p-0 print-bw" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A5 portrait;
              margin: 6mm;
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
            className={`w-full max-w-[148mm] mx-auto p-4 print:p-0 flex flex-col ${idx < arr.length - 1 ? "print-break" : ""}`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="pr-2">
                <h1 className="text-[15px] font-bold uppercase leading-tight">{settings.SCHOOL_NAME || "TRƯỜNG TIỂU HỌC BAN TRÚ"}</h1>
                {settings.SCHOOL_ADDRESS && <p className="text-[11px] mt-1">{settings.SCHOOL_ADDRESS}</p>}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <Barcode
                  value={`PT${bill.month}${bill.year}${bill.student.boardingCode || bill.student.studentCode}`}
                  height={30}
                  width={1.2}
                  fontSize={10}
                  margin={0}
                  displayValue={true}
                />
              </div>
            </div>

            <div className="border-t-[1.5px] border-black my-1"></div>

            <div className="text-center mb-1">
              <h2 className="text-[16px] font-bold mb-0.5">PHIẾU THANH TOÁN SUẤT ĂN BÁN TRÚ</h2>
              <p className="text-[12px] italic">Tháng {bill.month} / {bill.year}</p>
            </div>

            <div className="border-t-[1.5px] border-black my-1"></div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[12px] mb-1 leading-relaxed">
              <div className="space-y-1">
                <p className="flex"><span className="font-bold w-20 shrink-0">Mã Bán Trú:</span> <span>{bill.student.boardingCode || "Chưa cấp"}</span></p>
                <p className="flex"><span className="font-bold w-20 shrink-0">Họ tên:</span> <span>{bill.student.user.fullName}</span></p>
                <p className="flex"><span className="font-bold w-20 shrink-0">Lớp:</span> <span>{bill.student.class.name}</span></p>
                <p className="flex"><span className="font-bold w-20 shrink-0">Loại suất:</span> <span>{bill.student.mealType === "MAN" ? "Mặn" : bill.student.mealType === "CHAY" ? "Chay" : "Cháo"}</span></p>
              </div>
              <div className="space-y-1">
                <p className="flex"><span className="font-bold w-36 shrink-0">Số ngày ăn dự kiến:</span> <span>{bill.scheduleMealDays} ngày</span></p>
                <p className="flex"><span className="font-bold w-36 shrink-0">Số ngày cắt suất:</span> <span>{bill.canceledDays} ngày</span></p>
                <div className="flex">
                  <span className="font-bold w-36 shrink-0">Trừ tiền tháng trước:</span>
                  <div className="flex flex-col">
                    <span>{formatVND(bill.previousDeduction)}</span>
                    <span className="text-[11px] italic text-gray-700">(Hủy suất ăn của tháng {bill.month === 1 ? 12 : bill.month - 1}/{bill.month === 1 ? bill.year - 1 : bill.year})</span>
                  </div>
                </div>
                <p className="flex"><span className="font-bold w-36 shrink-0">Đơn giá:</span> <span>{formatVND(bill.unitPrice)}/suất</span></p>
              </div>
            </div>

            <div className="border-t-[1.5px] border-black my-1"></div>

            {bill.student.mealCancellations && bill.student.mealCancellations.length > 0 ? (
              <div className="mb-1 text-[11px] border border-black p-1 rounded-sm print:rounded-none">
                <p className="font-bold mb-0.5">Chi tiết các ngày đã duyệt cắt suất:</p>
                <div className="flex flex-wrap gap-1">
                  {bill.student.mealCancellations.map((c, i) => (
                    <span key={i} className="px-1 py-0.5 border border-black rounded-sm print:rounded-none">
                      {new Date(c.cancelDate).toLocaleDateString('vi-VN')}
                    </span>
                  ))}
                </div>
              </div>
            ) : <div className="mb-1"></div>}

            <div className="border-[1.5px] border-black py-1 my-1 text-center">
              <p className="text-[16px] font-bold mb-0">
                SỐ TIỀN CẦN NỘP: {formatVND(bill.finalAmount)}
              </p>
              <p className="text-[11px] italic">
                (Bằng chữ: {numberToVietnameseWords(Number(bill.finalAmount))})
              </p>
            </div>

            <div className="mt-1 pt-1.5 border-2 border-dashed border-black p-1.5 flex items-center shrink-0 rounded-sm print:rounded-none">
              {bill.qrCodeUrl && (
                <div className="shrink-0 mr-3 border border-black p-1">
                  <img
                    src={bill.qrCodeUrl}
                    alt={`QR thanh toán ${bill.student.boardingCode || bill.student.studentCode}`}
                    className="w-[115px] h-[115px] object-contain"
                    loading="eager"
                  />
                </div>
              )}
              <div className="flex-1">
                <p className="text-[14px] font-bold mb-1 uppercase">1. Quét mã QR để thanh toán (Khuyến khích)</p>
                <p className="text-[11px] mb-2">2. Nếu không quét được QR, vui lòng chuyển khoản thủ công và <b>BẮT BUỘC</b> nhập đúng nội dung sau:</p>
                <span className="font-bold text-[15px] inline-block px-3 py-1.5 border-[2px] border-black bg-gray-100 print:bg-transparent">
                  BSTLM {bill.student.boardingCode || bill.student.studentCode} T{bill.month}
                </span>
                <div className="mt-2 p-1.5 border border-black border-dashed bg-yellow-50 print:bg-transparent">
                  <p className="text-[11px] font-bold uppercase print:text-black">
                    ⚠️ LƯU Ý QUAN TRỌNG:
                  </p>
                  <p className="text-[10px] font-semibold mt-0.5">
                    - Hệ thống gạch nợ tự động bằng máy. <br/>
                    - Tuyệt đối <span className="underline">không sửa hoặc thêm</span> bất kỳ chữ nào vào nội dung chuyển khoản. Ghi sai cú pháp sẽ khiến hệ thống không nhận diện được và học sinh vẫn bị tính là <b>CHƯA NỘP TIỀN</b>.
                  </p>
                </div>
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
