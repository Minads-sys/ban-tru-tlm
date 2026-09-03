"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart3,
  Printer,
  Loader2,
  ChefHat,
  CreditCard,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Báo cáo suất ăn hàng ngày
  const [dailyReport, setDailyReport] = useState<{
    date: string;
    lockTime2: string;
    isFullyLocked: boolean;
    isExpectedLocked: boolean;
    totalSummary: {
      totalRegistered: number;
      totalCanceled: number;
      finalMan: number;
      finalChay: number;
      finalChao: number;
      finalTotal: number;
      expectedMan: number;
      expectedChay: number;
      expectedChao: number;
      expectedTotal: number;
    };
    classSummaries: Array<{
      classId: string;
      className: string;
      totalRegistered: number;
      totalCanceled: number;
      finalMan: number;
      finalChay: number;
      finalChao: number;
      finalTotal: number;
      expectedMan: number;
      expectedChay: number;
      expectedChao: number;
      expectedTotal: number;
      isLocked: boolean;
      expectedLockedAt: string | null;
    }>;
  } | null>(null);

  // Helper check if report is past lock time 2 (chốt chính thức)
  const isPastLockTime2 = () => {
    if (!dailyReport) return false;
    const now = new Date();
    const vnTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnNow = new Date(vnTimeStr);
    
    // Convert report date
    const [y, m, d] = dailyReport.date.split("-").map(Number);
    const rDate = new Date(y, m - 1, d);
    
    const today = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
    
    if (rDate < today) return true; // Quá khứ
    if (rDate > today) return false; // Tương lai
    
    // Hôm nay, so sánh giờ phút
    const [hours, minutes] = dailyReport.lockTime2.split(":").map(Number);
    if (vnNow.getHours() > hours) return true;
    if (vnNow.getHours() === hours && vnNow.getMinutes() >= minutes) return true;
    
    return false;
  };

  const handleManualLock = async (type: "EXPECTED" | "FINAL") => {
    try {
      const confirmMsg = type === "EXPECTED" 
        ? "Bạn có chắc chắn muốn CHỐT DỰ KIẾN (Lần 1) với dữ liệu hiện tại?" 
        : "Bạn có chắc chắn muốn CHỐT CHÍNH THỨC (Lần 2) với dữ liệu hiện tại? Số liệu này sẽ được khóa để chia ăn và tính tiền.";
      
      const confirm = await Swal.fire({
        title: "Xác nhận",
        text: confirmMsg,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Đồng ý",
        cancelButtonText: "Hủy",
      });

      if (!confirm.isConfirmed) return;

      setLoading(true);
      const res = await fetch("/api/daily-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate, type }),
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire("Thành công", data.message, "success");
        fetchDailyReport();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể chốt suất", "error");
      }
    } catch (error) {
      Swal.fire("Lỗi", "Lỗi kết nối", "error");
    } finally {
      setLoading(false);
    }
  };

  // Các state và fetch function khác giữ nguyên
  // Báo cáo công nợ
  interface DebtReportBill {
    id: string;
    studentId: string;
    student: {
      studentCode: string;
      boardingCode?: string | null;
      user: { fullName: string };
      class?: { name: string } | null;
    };
    finalAmount: string | number;
    paymentStatus: string;
    transactions?: Array<{
      id: string;
      amount: string | number;
      transDate: string;
    }>;
  }
  const [debtReport, setDebtReport] = useState<DebtReportBill[]>([]);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-meals?date=${reportDate}`);
      const data = await res.json();
      setDailyReport(data);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/billing?month=${reportMonth}&year=${reportYear}&limit=5000`
      );
      const json = await res.json();
      const rawBills: any[] = Array.isArray(json) ? json : (json?.data || []);
      // Lọc các học sinh chưa thanh toán (UNPAID) hoặc thanh toán 1 phần (PARTIAL)
      const debts = rawBills.filter(
        (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
      );
      setDebtReport(debts);
    } catch (err) {
      console.error("Lỗi khi tải báo cáo công nợ:", err);
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo công nợ", "error");
    } finally {
      setLoading(false);
    }
  };

  // Báo cáo nợ quá hạn đa tháng
  interface OverdueDebt {
    studentId: string;
    studentName: string;
    className: string;
    unpaidCount: number;
    totalDebt: number;
    months: string[];
  }
  const [overdueReport, setOverdueReport] = useState<OverdueDebt[]>([]);

  const fetchOverdueReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/overdue-debt");
      const data = await res.json();
      if (data.success) {
        setOverdueReport(data.data);
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo nợ quá hạn", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 no-print flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        Báo cáo & Thống kê
      </h1>

      <Tabs defaultValue="daily" className="no-print">
        <TabsList className="mb-4">
          <TabsTrigger value="daily">
            <ChefHat className="h-4 w-4 mr-1" />
            Suất ăn hàng ngày
          </TabsTrigger>
          <TabsTrigger value="debt">
            <CreditCard className="h-4 w-4 mr-1" />
            Công nợ
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Nợ quá hạn
          </TabsTrigger>
        </TabsList>

        {/* ============ BÁO CÁO SUẤT ĂN HÀNG NGÀY ============ */}
        <TabsContent value="daily">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end">
                <div>
                  <Label>Ngày báo cáo</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
                <Button onClick={fetchDailyReport} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Xem báo cáo
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  In
                </Button>
              </div>
            </CardContent>
          </Card>

          {dailyReport && (
            <>
              {/* Vùng nút bấm chốt sổ thủ công */}
              <div className="flex gap-4 mb-4 justify-end">
                {!dailyReport.isFullyLocked && (
                  <Button variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => handleManualLock("EXPECTED")}>
                    {dailyReport.isExpectedLocked ? "Cập nhật lại Số Dự Kiến" : "Chốt số Dự Kiến (Lần 1)"}
                  </Button>
                )}
                {(!dailyReport.isFullyLocked && isPastLockTime2()) && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleManualLock("FINAL")}>
                    Chốt Chính Thức (Lần 2)
                  </Button>
                )}
              </div>

              {/* Tổng hợp */}
              <div className="flex items-center gap-2 mb-3 mt-4">
                <h2 className="text-lg font-semibold text-slate-800">Tổng hợp toàn trường</h2>
                {dailyReport.classSummaries.length === 0 ? (
                  <Badge className="bg-slate-100 text-slate-500 border-slate-200">Không có dữ liệu</Badge>
                ) : dailyReport.isFullyLocked ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300">Đã chốt sổ ngày ăn</Badge>
                ) : dailyReport.isExpectedLocked ? (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300">Đã chốt suất dự kiến đi chợ</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300">Chưa chốt</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Đăng ký</p>
                    <p className="text-xl font-bold">
                      {dailyReport.totalSummary.totalRegistered}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Cắt suất</p>
                    <p className="text-xl font-bold text-red-600">
                      {dailyReport.totalSummary.totalCanceled}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Mặn</p>
                    <p className="text-xl font-bold text-orange-600">
                      {dailyReport.totalSummary.finalMan}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Chay</p>
                    <p className="text-xl font-bold text-green-600">
                      {dailyReport.totalSummary.finalChay}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Cháo</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {dailyReport.totalSummary.finalChao}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="pt-3 text-center">
                    <p className="text-xs text-gray-500">Tổng suất</p>
                    <p className="text-xl font-bold text-blue-600">
                      {dailyReport.totalSummary.finalTotal}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chi tiết theo lớp */}
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiết theo lớp - Ngày {reportDate}</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Kiểm tra nếu chưa qua giờ chốt và chưa khóa thì ẩn chi tiết */}
                  {(!dailyReport.isFullyLocked && !isPastLockTime2()) ? (
                    <div className="py-12 text-center border-2 border-dashed border-yellow-200 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-yellow-700 mb-1">Đang chờ chốt số liệu thực tế</h3>
                      <p className="text-yellow-600 max-w-md mx-auto">
                        Bảng chia thức ăn chi tiết của từng lớp đang bị ẩn để tránh sai sót. Dữ liệu sẽ tự động mở khóa sau thời gian chốt chính thức lúc <strong>{dailyReport.lockTime2}</strong>.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lớp</TableHead>
                          <TableHead className="text-center">Đăng ký</TableHead>
                          <TableHead className="text-center">Cắt suất</TableHead>
                          <TableHead className="text-center bg-orange-50">Mặn</TableHead>
                          <TableHead className="text-center bg-green-50">Chay</TableHead>
                          <TableHead className="text-center bg-yellow-50">Cháo</TableHead>
                          <TableHead className="text-center font-bold">Tổng suất</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReport.classSummaries.map((cs) => (
                          <TableRow key={cs.classId}>
                            <TableCell className="font-medium">{cs.className}</TableCell>
                            <TableCell className="text-center">{cs.totalRegistered}</TableCell>
                            <TableCell className="text-center text-red-600">
                              {cs.totalCanceled}
                            </TableCell>
                            <TableCell className="text-center bg-orange-50">{cs.finalMan}</TableCell>
                            <TableCell className="text-center bg-green-50">{cs.finalChay}</TableCell>
                            <TableCell className="text-center bg-yellow-50">{cs.finalChao}</TableCell>
                            <TableCell className="text-center font-bold text-blue-600">{cs.finalTotal}</TableCell>
                            <TableCell className="text-center">
                              {cs.isLocked ? (
                                <Badge className="bg-green-100 text-green-700">Đã chốt</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700">Chưa chốt</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============ BÁO CÁO CÔNG NỢ ============ */}
        <TabsContent value="debt">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end">
                <div>
                  <Label>Tháng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={reportMonth}
                    onChange={(e) => setReportMonth(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Năm</Label>
                  <Input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                  />
                </div>
                <Button onClick={fetchDebtReport} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Xem công nợ
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  In
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Danh sách chưa thanh toán - Tháng {reportMonth}/{reportYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtReport.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <p className="text-red-700 font-medium">
                    Tổng: <strong>{debtReport.length}</strong> học sinh chưa hoàn tất công nợ
                  </p>
                  <p className="text-red-700 font-bold text-base">
                    Tổng nợ:{" "}
                    {new Intl.NumberFormat("vi-VN").format(
                      debtReport.reduce((sum, b) => {
                        const paid = (b.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
                        return sum + Math.max(0, Number(b.finalAmount) - paid);
                      }, 0)
                    )}
                    đ
                  </p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">STT</TableHead>
                    <TableHead>Mã BT / HS</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead className="text-right">Đã nộp</TableHead>
                    <TableHead className="text-right font-bold text-red-600">Còn nợ</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtReport.map((bill, idx) => {
                    const billTotal = Number(bill.finalAmount);
                    const paidAmount = (bill.transactions || []).reduce((s, t) => s + Number(t.amount), 0);
                    const remaining = Math.max(0, billTotal - paidAmount);
                    const isPartial = bill.paymentStatus === "PARTIAL";

                    return (
                      <TableRow key={bill.id || bill.studentId || idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {bill.student.boardingCode ? (
                            <span className="font-bold text-blue-700">{bill.student.boardingCode}</span>
                          ) : (
                            bill.student.studentCode
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{bill.student.user?.fullName}</TableCell>
                        <TableCell>{bill.student.class?.name || "—"}</TableCell>
                        <TableCell className="text-right text-slate-600">
                          {new Intl.NumberFormat("vi-VN").format(billTotal)}đ
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">
                          {paidAmount > 0 ? `-${new Intl.NumberFormat("vi-VN").format(paidAmount)}đ` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {new Intl.NumberFormat("vi-VN").format(remaining)}đ
                        </TableCell>
                        <TableCell className="text-center">
                          {isPartial ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">Đã nộp 1 phần</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-300">Chưa TT</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {debtReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                        Không có công nợ hoặc chưa tải dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ BÁO CÁO NỢ QUÁ HẠN ============ */}
        <TabsContent value="overdue">
          <Card className="mb-4 border-red-200">
            <CardHeader className="bg-red-50 border-b border-red-100">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Cảnh báo Học sinh Nợ quá hạn (Từ 2 tháng trở lên)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 mb-4">
                <Button onClick={fetchOverdueReport} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Quét Nợ Xấu
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-center">Số tháng nợ</TableHead>
                    <TableHead>Chi tiết các tháng</TableHead>
                    <TableHead className="text-right">Tổng dư nợ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueReport.map((st, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold">{st.studentName}</TableCell>
                      <TableCell>{st.className}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-600 hover:bg-red-700">{st.unpaidCount} tháng</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {st.months.join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 text-lg">
                        {new Intl.NumberFormat("vi-VN").format(st.totalDebt)}đ
                      </TableCell>
                    </TableRow>
                  ))}
                  {overdueReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        Bấm "Quét Nợ Xấu" để kiểm tra. Hệ thống sẽ hiển thị các học sinh nợ từ 2 tháng trở lên.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
