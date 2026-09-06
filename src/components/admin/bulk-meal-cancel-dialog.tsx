'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarX,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  CheckSquare,
  Square,
  Clock,
  Loader2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  getBulkActionStudentStatus,
  bulkCreateAndApproveCancellations,
} from '@/app/admin/meal-cancel/actions';
import Swal from 'sweetalert2';

interface BulkMealCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: { id: string; name: string }[];
  cutoffTime: string;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Nghỉ ốm / Đi khám bệnh',
  'Đi dã ngoại / Hoạt động ngoại khóa',
  'Lớp nghỉ học',
  'Phụ huynh có đơn xin nghỉ phép',
  'Tham gia thi đấu / Học sinh giỏi',
];

export function BulkMealCancelDialog({
  open,
  onOpenChange,
  classes,
  cutoffTime,
  onSuccess,
}: BulkMealCancelDialogProps) {
  // Current Vietnam Date
  const getTodayStr = () => {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [cancelDate, setCancelDate] = useState<string>(getTodayStr());
  const [reason, setReason] = useState<string>('Đi dã ngoại / Hoạt động ngoại khóa');
  const [autoApprove, setAutoApprove] = useState<boolean>(true);
  const [bypassCutoff, setBypassCutoff] = useState<boolean>(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [statusData, setStatusData] = useState<any>(null);

  const [isSubmitting, startSubmitTransition] = useTransition();

  // Load student status when class or date changes
  useEffect(() => {
    if (!open || !selectedClassId || !cancelDate) return;

    let isMounted = true;
    setIsLoadingStatus(true);
    setStatusData(null);

    getBulkActionStudentStatus(selectedClassId, cancelDate)
      .then((res) => {
        if (!isMounted) return;
        setIsLoadingStatus(false);
        if (res.success && res.data) {
          setStatusData(res.data);
          // By default, select all active students who are not already cancelled
          const eligibleIds = res.data.students
            .filter((s: any) => !s.cancellation || s.cancellation.status === 'REJECTED')
            .map((s: any) => s.id);
          setSelectedStudentIds(new Set(eligibleIds));
        } else {
          setStatusData(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoadingStatus(false);
        console.error('Error fetching student status:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [open, selectedClassId, cancelDate]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!statusData?.students) return [];
    if (!searchQuery.trim()) return statusData.students;
    const q = searchQuery.toLowerCase();
    return statusData.students.filter(
      (s: any) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.studentCode?.toLowerCase().includes(q) ||
        s.boardingCode?.toLowerCase().includes(q)
    );
  }, [statusData, searchQuery]);

  // Select all / Deselect all
  const handleToggleSelectAll = () => {
    if (!statusData?.students) return;
    const allIds = statusData.students.map((s: any) => s.id);
    if (selectedStudentIds.size === allIds.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(allIds));
    }
  };

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Submit Handler
  const handleSubmit = () => {
    if (selectedStudentIds.size === 0) {
      Swal.fire('Thông báo', 'Vui lòng chọn ít nhất 1 học sinh để cắt suất.', 'warning');
      return;
    }

    if (!reason.trim()) {
      Swal.fire('Thông báo', 'Vui lòng nhập lý do cắt suất.', 'warning');
      return;
    }

    if (statusData?.isSunday) {
      Swal.fire('Lỗi', 'Không thể cắt suất vào ngày Chủ nhật.', 'error');
      return;
    }

    if (statusData?.isOutOfSchoolYear) {
      Swal.fire('Lỗi', 'Ngày chọn không nằm trong thời gian của Năm học hiện tại.', 'error');
      return;
    }

    if (!statusData?.hasSchedule) {
      Swal.fire(
        'Không có lịch ăn',
        'Lớp này không có lịch ăn bán trú vào ngày đã chọn theo Thời khóa biểu.',
        'error'
      );
      return;
    }

    if (statusData?.isPastMorningCutoff && !bypassCutoff) {
      Swal.fire({
        icon: 'warning',
        title: 'Đã quá giờ chốt sổ',
        text: `Thời điểm này đã quá giờ chốt sáng (${statusData.cutoffMorning}) hoặc ngày đã qua. Vui lòng tích chọn "Xác nhận duyệt ngoại lệ" để tiếp tục.`,
      });
      return;
    }

    const className = classes.find((c) => c.id === selectedClassId)?.name || selectedClassId;

    Swal.fire({
      title: `${autoApprove ? 'Tạo & Duyệt' : 'Tạo'} cắt suất hàng loạt?`,
      html: `
        <div class="text-left text-sm space-y-1.5 p-2 bg-slate-50 rounded border">
          <div>- Lớp: <strong>${className}</strong></div>
          <div>- Ngày cắt: <strong>${cancelDate}</strong></div>
          <div>- Số lượng: <strong>${selectedStudentIds.size} học sinh</strong></div>
          <div>- Lý do: <strong>${reason.trim()}</strong></div>
          <div>- Trạng thái: <strong class="${autoApprove ? 'text-emerald-700' : 'text-amber-600'}">${autoApprove ? 'Duyệt ngay lập tức (APPROVED)' : 'Chờ duyệt (PENDING)'}</strong></div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý thực hiện',
      cancelButtonText: 'Hủy bỏ',
    }).then((result) => {
      if (result.isConfirmed) {
        startSubmitTransition(async () => {
          const res = await bulkCreateAndApproveCancellations({
            classId: selectedClassId,
            studentIds: Array.from(selectedStudentIds),
            cancelDate,
            reason: reason.trim(),
            autoApprove,
            bypassCutoff,
          });

          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'Thành công',
              text: res.message,
              timer: 2000,
              showConfirmButton: false,
            });
            onOpenChange(false);
            if (onSuccess) onSuccess();
          } else {
            Swal.fire('Thao tác thất bại', res.error || 'Có lỗi xảy ra', 'error');
          }
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <CalendarX className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Tạo &amp; Duyệt Cắt Suất Ăn Hàng Loạt
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Dành cho Giáo viên / Quản lý cắt suất theo lớp cho nhiều học sinh cùng lúc, hỗ trợ duyệt ngay lập tức.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Controls Bar: Class & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Chọn Lớp học: <span className="text-rose-500">*</span>
              </label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full bg-white h-9 text-xs">
                  <SelectValue placeholder="Chọn lớp..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      Lớp {c.name} ({c.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Ngày cắt suất: <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={cancelDate}
                onChange={(e) => setCancelDate(e.target.value)}
                className="h-9 text-xs bg-white"
              />
            </div>
          </div>

          {/* Validation Warnings */}
          {isLoadingStatus ? (
            <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Đang kiểm tra thời khóa biểu và danh sách học sinh...</span>
            </div>
          ) : statusData ? (
            <div className="space-y-2">
              {statusData.isSunday && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Ngày Chủ nhật:</strong> Hệ thống không phục vụ ăn bán trú. Vui lòng chọn ngày trong tuần (Thứ 2 - Thứ 7).
                  </span>
                </div>
              )}

              {statusData.isOutOfSchoolYear && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Ngoài năm học:</strong> Ngày được chọn không nằm trong thời gian của Năm học hiện tại.
                  </span>
                </div>
              )}

              {!statusData.isSunday && !statusData.hasSchedule && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Cảnh báo TKB:</strong> Lớp không có lịch ăn bán trú vào ngày này theo Thời khóa biểu tuần.
                  </span>
                </div>
              )}

              {statusData.isPastMorningCutoff && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      Đã quá giờ chốt sáng ({statusData.cutoffMorning}) hoặc ngày đã qua!
                    </div>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Thao tác sau giờ chốt cần xác nhận duyệt ngoại lệ để phục vụ đối soát.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={bypassCutoff}
                        onChange={(e) => setBypassCutoff(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>Xác nhận duyệt ngoại lệ sau giờ chốt sổ</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Reason Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Lý do cắt suất: <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Chọn gợi ý nhanh hoặc nhập tùy chỉnh</span>
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    reason === r
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="h-9 text-xs bg-white"
            />
          </div>

          {/* Student Selection Section */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  disabled={!statusData?.students || statusData.students.length === 0}
                  className="h-7 text-xs px-2.5 bg-white hover:bg-slate-50 border-slate-300"
                >
                  {statusData?.students && selectedStudentIds.size === statusData.students.length ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-blue-600 mr-1" />
                      Bỏ chọn tất cả
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5 text-slate-400 mr-1" />
                      Chọn tất cả ({statusData?.students?.length || 0})
                    </>
                  )}
                </Button>

                <span className="text-xs text-slate-600">
                  Đã chọn:{' '}
                  <strong className="text-blue-700 font-bold">{selectedStudentIds.size}</strong> /{' '}
                  {statusData?.students?.length || 0} học sinh
                </span>
              </div>

              {/* Quick Search in modal */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lọc tên, mã HS..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
            </div>

            {/* Students Table/List */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-56 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {isLoadingStatus
                    ? 'Đang tải danh sách...'
                    : 'Không tìm thấy học sinh nào phù hợp.'}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2 w-28 font-semibold text-slate-700">Mã HS / BT</th>
                      <th className="p-2 font-semibold text-slate-700">Họ và tên</th>
                      <th className="p-2 w-44 font-semibold text-slate-700">Trạng thái ngày chọn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s: any) => {
                      const isSelected = selectedStudentIds.has(s.id);
                      const isCancelled = !!s.cancellation;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleToggleStudent(s.id)}
                          className={`cursor-pointer transition-colors hover:bg-blue-50/50 ${
                            isSelected ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStudent(s.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 font-mono text-[11px] text-slate-600">
                            {s.studentCode}
                            {s.boardingCode && (
                              <div className="text-[10px] text-slate-400">{s.boardingCode}</div>
                            )}
                          </td>
                          <td className="p-2 font-medium text-slate-800">
                            {s.fullName}
                          </td>
                          <td className="p-2">
                            {isCancelled ? (
                              s.cancellation.status === 'APPROVED' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] px-1.5 py-0 border-emerald-300">
                                  Đã duyệt cắt suất
                                </Badge>
                              ) : s.cancellation.status === 'PENDING' ? (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0 border-amber-300">
                                  Chờ duyệt
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 text-[10px] px-1.5 py-0">
                                  Đã từ chối trước đó
                                </Badge>
                              )
                            ) : s.override ? (
                              <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px] px-1.5 py-0">
                                Đổi món: {s.override.mealType}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Bình thường</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Auto-Approve Switch Checkbox */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-emerald-900">
                  Tự động duyệt ngay lập tức (APPROVED)
                </div>
                <div className="text-[11px] text-emerald-700">
                  Đơn sẽ được duyệt ngay bởi tài khoản của bạn mà không cần qua danh sách chờ.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs h-9 text-slate-600"
          >
            Đóng
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              isLoadingStatus ||
              selectedStudentIds.size === 0 ||
              statusData?.isSunday ||
              statusData?.isOutOfSchoolYear ||
              !statusData?.hasSchedule
            }
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-4 gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarX className="h-4 w-4" />
            )}
            <span>
              {autoApprove ? 'Tạo & Duyệt' : 'Tạo'} Cắt Suất ({selectedStudentIds.size} HS)
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
