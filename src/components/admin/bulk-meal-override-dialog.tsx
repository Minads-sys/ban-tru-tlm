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
  RefreshCw,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  Clock,
  Loader2,
  AlertCircle,
  Utensils,
  Ban,
  CheckCircle,
} from 'lucide-react';
import {
  getBulkActionStudentStatus,
  bulkOverrideMeals,
} from '@/app/admin/meal-cancel/actions';
import Swal from 'sweetalert2';

interface BulkMealOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: { id: string; name: string }[];
  cutoffTime: string;
  onSuccess?: () => void;
}

type MealType = 'MAN' | 'CHAY' | 'CHAO';

const MEAL_OPTIONS: { type: MealType; label: string; desc: string; icon: string; color: string }[] = [
  {
    type: 'MAN',
    label: 'Cơm Mặn',
    desc: 'Thực đơn mặn tiêu chuẩn hàng ngày',
    icon: '🍗',
    color: 'border-orange-200 bg-orange-50/50 hover:bg-orange-50 text-orange-950',
  },
  {
    type: 'CHAY',
    label: 'Cơm Chay',
    desc: 'Thực đơn chay thanh đạm định kỳ',
    icon: '🥗',
    color: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950',
  },
  {
    type: 'CHAO',
    label: 'Cháo Dinh Dưỡng',
    desc: 'Dành cho học sinh ốm / dưỡng bệnh',
    icon: '🥣',
    color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-950',
  },
];

export function BulkMealOverrideDialog({
  open,
  onOpenChange,
  classes,
  cutoffTime,
  onSuccess,
}: BulkMealOverrideDialogProps) {
  // Current Vietnam Tomorrow
  const getTomorrowStr = () => {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [targetDate, setTargetDate] = useState<string>(getTomorrowStr());
  const [selectedMealType, setSelectedMealType] = useState<MealType>('CHAY');
  const [bypassCutoff, setBypassCutoff] = useState<boolean>(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [statusData, setStatusData] = useState<any>(null);

  const [isSubmitting, startSubmitTransition] = useTransition();

  // Load student status when class or date changes
  useEffect(() => {
    if (!open || !selectedClassId || !targetDate) return;

    let isMounted = true;
    setIsLoadingStatus(true);
    setStatusData(null);

    getBulkActionStudentStatus(selectedClassId, targetDate)
      .then((res) => {
        if (!isMounted) return;
        setIsLoadingStatus(false);
        if (res.success && res.data) {
          setStatusData(res.data);
          // By default, select all eligible students (students WITHOUT an active cancellation)
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
  }, [open, selectedClassId, targetDate]);

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

  // Eligible students (not cancelled)
  const eligibleStudents = useMemo(() => {
    if (!statusData?.students) return [];
    return statusData.students.filter(
      (s: any) => !s.cancellation || s.cancellation.status === 'REJECTED'
    );
  }, [statusData]);

  // Select all / Deselect all eligible
  const handleToggleSelectAll = () => {
    const eligibleIds = eligibleStudents.map((s: any) => s.id);
    if (selectedStudentIds.size === eligibleIds.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleIds));
    }
  };

  const handleToggleStudent = (id: string, isBlocked: boolean) => {
    if (isBlocked) return;
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
      Swal.fire('Thông báo', 'Vui lòng chọn ít nhất 1 học sinh để đổi món.', 'warning');
      return;
    }

    if (statusData?.isSunday) {
      Swal.fire('Lỗi', 'Không thể đổi món vào ngày Chủ nhật.', 'error');
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

    if (statusData?.isPastAfternoonCutoff && !bypassCutoff) {
      Swal.fire({
        icon: 'warning',
        title: 'Đã quá giờ khóa sổ đổi món',
        text: `Thời điểm này đã quá giờ khóa sổ chiều (${statusData.cutoffAfternoon}) hoặc là ngày hôm nay/quá khứ. Vui lòng tích chọn "Xác nhận đổi món ngoại lệ" để tiếp tục.`,
      });
      return;
    }

    const className = classes.find((c) => c.id === selectedClassId)?.name || selectedClassId;
    const mealLabel = MEAL_OPTIONS.find((m) => m.type === selectedMealType)?.label || selectedMealType;

    Swal.fire({
      title: `Đổi món hàng loạt sang ${mealLabel}?`,
      html: `
        <div class="text-left text-sm space-y-1.5 p-2 bg-slate-50 rounded border">
          <div>- Lớp: <strong>${className}</strong></div>
          <div>- Ngày áp dụng: <strong>${targetDate}</strong></div>
          <div>- Món chuyển sang: <strong class="text-blue-700">${mealLabel}</strong></div>
          <div>- Số lượng: <strong>${selectedStudentIds.size} học sinh</strong></div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý đổi món',
      cancelButtonText: 'Hủy bỏ',
    }).then((result) => {
      if (result.isConfirmed) {
        startSubmitTransition(async () => {
          const res = await bulkOverrideMeals({
            classId: selectedClassId,
            studentIds: Array.from(selectedStudentIds),
            date: targetDate,
            mealType: selectedMealType,
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
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Đổi Món Ăn Bán Trú Hàng Loạt
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Thay đổi loại suất ăn (Cơm mặn, Cơm chay, Cháo) theo lớp cho nhiều học sinh cùng lúc.
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
                Ngày áp dụng: <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-9 text-xs bg-white"
              />
            </div>
          </div>

          {/* Validation Warnings */}
          {isLoadingStatus ? (
            <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Đang kiểm tra thời khóa biểu và trạng thái học sinh...</span>
            </div>
          ) : statusData ? (
            <div className="space-y-2">
              {statusData.isSunday && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Ngày Chủ nhật:</strong> Hệ thống không phục vụ ăn bán trú. Vui lòng chọn ngày trong tuần.
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

              {statusData.isPastAfternoonCutoff && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      Đã qua giờ khóa sổ chiều ({statusData.cutoffAfternoon}) hoặc ngày đã qua!
                    </div>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Thao tác đổi món sau giờ chốt cần sự xác nhận ngoại lệ của Quản lý / Giáo viên.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={bypassCutoff}
                        onChange={(e) => setBypassCutoff(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>Xác nhận đổi món ngoại lệ sau giờ chốt sổ</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Meal Type Selection Cards */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Chọn Món ăn chuyển sang: <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {MEAL_OPTIONS.map((opt) => {
                const isSelected = selectedMealType === opt.type;
                return (
                  <div
                    key={opt.type}
                    onClick={() => setSelectedMealType(opt.type)}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                        : `${opt.color} hover:border-slate-300`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{opt.icon}</span>
                      {isSelected ? (
                        <CheckCircle className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                      )}
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
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
                  disabled={eligibleStudents.length === 0}
                  className="h-7 text-xs px-2.5 bg-white hover:bg-slate-50 border-slate-300"
                >
                  {eligibleStudents.length > 0 && selectedStudentIds.size === eligibleStudents.length ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-indigo-600 mr-1" />
                      Bỏ chọn tất cả
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5 text-slate-400 mr-1" />
                      Chọn tất cả ({eligibleStudents.length})
                    </>
                  )}
                </Button>

                <span className="text-xs text-slate-600">
                  Đã chọn:{' '}
                  <strong className="text-indigo-700 font-bold">{selectedStudentIds.size}</strong> /{' '}
                  {eligibleStudents.length} học sinh đủ điều kiện
                </span>
              </div>

              {/* Search */}
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

            {/* Students Table */}
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
                      <th className="p-2 w-48 font-semibold text-slate-700">Tình trạng suất ăn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s: any) => {
                      const isCancelled =
                        s.cancellation &&
                        (s.cancellation.status === 'APPROVED' || s.cancellation.status === 'PENDING');
                      const isSelected = selectedStudentIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleToggleStudent(s.id, isCancelled)}
                          className={`transition-colors ${
                            isCancelled
                              ? 'bg-rose-50/40 opacity-70 cursor-not-allowed'
                              : isSelected
                              ? 'bg-indigo-50/30 cursor-pointer hover:bg-indigo-50/50'
                              : 'cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isCancelled}
                              onChange={() => handleToggleStudent(s.id, isCancelled)}
                              className={`rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 ${
                                isCancelled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                              }`}
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
                              <div className="flex items-center gap-1.5 text-rose-700 font-medium text-[11px]">
                                <Ban className="h-3.5 w-3.5 text-rose-500" />
                                <span>Đã cắt suất ({s.cancellation.status})</span>
                              </div>
                            ) : s.override ? (
                              <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-[10px] px-1.5 py-0 border-indigo-300">
                                Đang chọn: {s.override.mealType}
                              </Badge>
                            ) : (
                              <span className="text-slate-500 text-[11px]">
                                Mặc định: {s.mealType || 'MAN'}
                              </span>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>
              Đổi sang{' '}
              {MEAL_OPTIONS.find((m) => m.type === selectedMealType)?.label || selectedMealType} (
              {selectedStudentIds.size} HS)
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
