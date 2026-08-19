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
    totalSummary: {
      totalRegistered: number;
      totalCanceled: number;
      finalMan: number;
      finalChay: number;
      finalChao: number;
      finalTotal: number;
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
      isLocked: boolean;
    }>;
  } | null>(null);

  // Báo cáo công nợ
  interface DebtReportBill {
    studentId: string;
    student: {
      user: { fullName: string };
      class: { name: string };
    };
    finalAmount: string;
    paymentStatus: string;
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
        `/api/billing?month=${reportMonth}&year=${reportYear}&paymentStatus=UNPAID`
      );
      const data = await res.json();
      setDebtReport(data);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải báo cáo công nợ", "error");
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
              {/* Tổng hợp */}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lớp</TableHead>
                        <TableHead className="text-center">Đăng ký</TableHead>
                        <TableHead className="text-center">Cắt suất</TableHead>
                        <TableHead className="text-center">Mặn</TableHead>
                        <TableHead className="text-center">Chay</TableHead>
                        <TableHead className="text-center">Cháo</TableHead>
                        <TableHead className="text-center">Tổng</TableHead>
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
                          <TableCell className="text-center">{cs.finalMan}</TableCell>
                          <TableCell className="text-center">{cs.finalChay}</TableCell>
                          <TableCell className="text-center">{cs.finalChao}</TableCell>
                          <TableCell className="text-center font-bold">{cs.finalTotal}</TableCell>
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
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 font-medium">
                    Tổng: {debtReport.length} học sinh chưa thanh toán -{" "}
                    {new Intl.NumberFormat("vi-VN").format(
                      debtReport.reduce(
                        (sum, b) => sum + parseInt(b.finalAmount),
                        0
                      )
                    )}
                    đ
                  </p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>STT</TableHead>
                    <TableHead>Mã HS</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtReport.map((bill, idx) => (
                    <TableRow key={bill.studentId}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono">{bill.studentId}</TableCell>
                      <TableCell>{bill.student.user.fullName}</TableCell>
                      <TableCell>{bill.student.class.name}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {new Intl.NumberFormat("vi-VN").format(parseInt(bill.finalAmount))}đ
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-red-100 text-red-700">Chưa TT</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {debtReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        Không có công nợ hoặc chưa tải dữ liệu
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
