'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { approveCancellation, rejectCancellation } from '@/app/admin/meal-cancel/actions';
import Swal from 'sweetalert2';

interface ApprovalActionsProps {
  id: string;
  studentName?: string;
  onSuccess?: () => void;
}

export function ApprovalActions({ id, studentName, onSuccess }: ApprovalActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = () => {
    setActionType('approve');
    setErrorMsg(null);
    startTransition(async () => {
      const res = await approveCancellation(id);
      if (!res.success) {
        setErrorMsg(res.error || 'Có lỗi xảy ra');
        Swal.fire({
          icon: 'error',
          title: 'Lỗi',
          text: res.error || 'Có lỗi xảy ra khi duyệt',
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Đã duyệt',
          text: studentName ? `Đã duyệt cắt suất cho ${studentName}` : 'Đã duyệt thành công',
          timer: 1500,
          showConfirmButton: false,
        });
        if (onSuccess) onSuccess();
      }
      setActionType(null);
    });
  };

  const handleReject = async () => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Từ chối yêu cầu cắt suất?',
      text: studentName ? `Học sinh: ${studentName}` : undefined,
      input: 'text',
      inputLabel: 'Lý do từ chối (bắt buộc)',
      inputPlaceholder: 'Ví dụ: Học sinh đi học bình thường, không có phép...',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xác nhận từ chối',
      cancelButtonText: 'Hủy bỏ',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Vui lòng nhập lý do từ chối!';
        }
      },
    });

    if (isConfirmed && reason) {
      setActionType('reject');
      setErrorMsg(null);
      startTransition(async () => {
        const res = await rejectCancellation(id, reason);
        if (!res.success) {
          setErrorMsg(res.error || 'Có lỗi xảy ra');
          Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: res.error || 'Có lỗi xảy ra khi từ chối',
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Đã từ chối',
            text: 'Đã từ chối yêu cầu cắt suất thành công',
            timer: 1500,
            showConfirmButton: false,
          });
          if (onSuccess) onSuccess();
        }
        setActionType(null);
      });
    }
  };

  return (
    <div className="flex flex-col gap-1 items-end sm:items-center">
      <div className="flex items-center gap-2">
        {/* Nút Duyệt - Green */}
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 px-3 font-medium text-xs shadow-sm transition-colors cursor-pointer"
        >
          {isPending && actionType === 'approve' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          <span>Duyệt</span>
        </Button>

        {/* Nút Từ chối - Red */}
        <Button
          size="sm"
          variant="destructive"
          onClick={handleReject}
          disabled={isPending}
          className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 h-8 px-3 font-medium text-xs shadow-sm transition-colors cursor-pointer"
        >
          {isPending && actionType === 'reject' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <span>Từ chối</span>
        </Button>
      </div>

      {errorMsg && (
        <span className="text-[11px] font-medium text-red-600 animate-in fade-in">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
