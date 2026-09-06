"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Shield,
  Clock,
  Layers,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Laptop,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  module: string;
  description: string;
  targetId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const MODULE_OPTIONS = [
  { value: "ALL", label: "Tất cả Phân hệ" },
  { value: "STUDENTS", label: "Học sinh" },
  { value: "CLASSES", label: "Lớp học" },
  { value: "SCHEDULE", label: "Thời khóa biểu" },
  { value: "MEALS", label: "Suất ăn & Duyệt hủy" },
  { value: "BILLING", label: "Hóa đơn & Thu tiền" },
  { value: "SETTINGS", label: "Cài đặt hệ thống" },
  { value: "AUTH", label: "Xác thực & Tài khoản" },
  { value: "SYSTEM", label: "Hệ thống chung" },
];

const ACTION_OPTIONS = [
  { value: "ALL", label: "Tất cả Hành động" },
  { value: "CREATE", label: "Tạo mới (CREATE)" },
  { value: "UPDATE", label: "Cập nhật (UPDATE)" },
  { value: "DELETE", label: "Xóa (DELETE)" },
  { value: "IMPORT", label: "Import Excel" },
  { value: "APPROVE", label: "Phê duyệt (APPROVE)" },
  { value: "REJECT", label: "Từ chối (REJECT)" },
  { value: "VOID", label: "Hủy phiếu thu (VOID)" },
  { value: "RESET", label: "Đặt lại (RESET)" },
  { value: "LOGIN", label: "Đăng nhập (LOGIN)" },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });
  const [totalToday, setTotalToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal xem chi tiết metadata
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(
    async (targetPage = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", targetPage.toString());
        params.set("limit", "25");

        if (moduleFilter !== "ALL") params.set("module", moduleFilter);
        if (actionFilter !== "ALL") params.set("action", actionFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setPagination(data.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
          setTotalToday(data.stats?.totalToday || 0);
        }
      } catch (error) {
        console.error("Lỗi khi tải nhật ký:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [moduleFilter, actionFilter, searchQuery, startDate, endDate]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
            Tạo mới
          </Badge>
        );
      case "UPDATE":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
            Cập nhật
          </Badge>
        );
      case "DELETE":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300">
            Xóa
          </Badge>
        );
      case "IMPORT":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300">
            Import Excel
          </Badge>
        );
      case "APPROVE":
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300">
            Phê duyệt
          </Badge>
        );
      case "REJECT":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300">
            Từ chối
          </Badge>
        );
      case "VOID":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
            Hủy phiếu
          </Badge>
        );
      case "RESET":
        return <Badge variant="destructive">Đặt lại dữ liệu</Badge>;
      case "LOGIN":
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300">
            Đăng nhập
          </Badge>
        );
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const renderModuleBadge = (module: string) => {
    const labels: Record<string, { name: string; color: string }> = {
      STUDENTS: { name: "Học sinh", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      CLASSES: { name: "Lớp học", color: "bg-sky-50 text-sky-700 border-sky-200" },
      SCHEDULE: { name: "Thời khóa biểu", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
      MEALS: { name: "Suất ăn", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      BILLING: { name: "Hóa đơn & Tiền", color: "bg-green-50 text-green-700 border-green-200" },
      SETTINGS: { name: "Cài đặt", color: "bg-amber-50 text-amber-700 border-amber-200" },
      AUTH: { name: "Xác thực", color: "bg-violet-50 text-violet-700 border-violet-200" },
      SYSTEM: { name: "Hệ thống", color: "bg-rose-50 text-rose-700 border-rose-200" },
    };

    const conf = labels[module] || { name: module, color: "bg-slate-50 text-slate-700 border-slate-200" };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${conf.color}`}>
        {conf.name}
      </span>
    );
  };

  const renderRoleBadge = (role: string | null) => {
    if (!role) return null;
    const roleColors: Record<string, string> = {
      ADMIN: "bg-red-50 text-red-700 border-red-200",
      BOARDING_MANAGER: "bg-purple-50 text-purple-700 border-purple-200",
      ACCOUNTANT: "bg-amber-50 text-amber-700 border-amber-200",
      BOARDING_STAFF: "bg-blue-50 text-blue-700 border-blue-200",
      CASHIER: "bg-emerald-50 text-emerald-700 border-emerald-200",
      TEACHER: "bg-teal-50 text-teal-700 border-teal-200",
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${roleColors[role] || "bg-slate-50 text-slate-600"}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <History className="h-7 w-7 text-blue-600" />
            Nhật ký thao tác hệ thống (Audit Log)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ghi nhận và lưu vết toàn bộ hoạt động quản lý, phân quyền và thay đổi dữ liệu trên hệ thống.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchLogs(pagination.page)}
          disabled={isLoading}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Tổng số thao tác đã ghi</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {pagination.total.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Hoạt động trong ngày hôm nay</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {totalToday.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Trạng thái ghi lưu vết</p>
              <p className="text-sm font-semibold text-emerald-600 mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Hoạt động bình thường
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Filter className="h-4 w-4 text-blue-600" />
            Bộ lọc & Tìm kiếm
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Tìm nội dung, người thao tác, mã đối tượng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            {/* Module Filter */}
            <div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                aria-label="Chọn phân hệ nghiệp vụ"
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Chọn loại hành động thao tác"
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div>
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="w-full h-10 text-slate-600"
              >
                Đặt lại bộ lọc
              </Button>
            </div>
          </div>

          {/* Date range filters */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <Calendar className="h-3.5 w-3.5" /> Lọc theo thời gian:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Từ:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Đến:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 dark:bg-slate-800/70">
                <TableHead className="w-44">Thời gian</TableHead>
                <TableHead className="w-48">Người thực hiện</TableHead>
                <TableHead className="w-32">Phân hệ</TableHead>
                <TableHead className="w-32">Hành động</TableHead>
                <TableHead>Nội dung chi tiết</TableHead>
                <TableHead className="w-32 text-right">Địa chỉ IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Đang tải danh sách nhật ký...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Không tìm thấy bản ghi nhật ký nào phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                          {log.userName || "Hệ thống"}
                        </span>
                        <div>{renderRoleBadge(log.userRole)}</div>
                      </div>
                    </TableCell>
                    <TableCell>{renderModuleBadge(log.module)}</TableCell>
                    <TableCell>{renderActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {log.description}
                        {log.metadata && (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="ml-2 text-[11px] text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
                          >
                            <Info className="h-3 w-3" /> Chi tiết
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-slate-500">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-xs text-slate-500">
            <div>
              Hiển thị{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              -{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              trong tổng số{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {pagination.total.toLocaleString("vi-VN")}
              </span>{" "}
              thao tác
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <span className="px-2 font-medium">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="h-8 px-2"
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Metadata Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-blue-600" />
              Chi tiết nhật ký thao tác
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Thời gian:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateTime(selectedLog.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Người thực hiện:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.userName} ({selectedLog.userRole || "Chưa rõ"})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Hành động:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.action} ({selectedLog.module})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Địa chỉ IP:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedLog.ipAddress || "Không xác định"}
                  </p>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Nội dung thao tác:
                </span>
                <p className="mt-1 p-2.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.metadata && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Dữ liệu bổ sung (JSON Metadata):
                  </span>
                  <pre className="mt-1 p-3 bg-slate-950 text-slate-200 rounded-md overflow-x-auto text-[11px] font-mono max-h-60">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.metadata), null, 2);
                      } catch {
                        return selectedLog.metadata;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
