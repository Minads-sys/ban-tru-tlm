'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { approveCancellation, rejectCancellation } from '@/app/admin/meal-cancel/actions';

interface ApprovalActionsProps {
  id: string;
}

export function ApprovalActions({ id }: ApprovalActionsProps) {
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
      }
      setActionType(null);
    });
  };

  const handleReject = () => {
    setActionType('reject');
    setErrorMsg(null);
    startTransition(async () => {
      const res = await rejectCancellation(id);
      if (!res.success) {
        setErrorMsg(res.error || 'Có lỗi xảy ra');
      }
      setActionType(null);
    });
  };

  return (
    <div className="flex flex-col gap-1 items-end sm:items-center">
      <div className="flex items-center gap-2">
        {/* Nút Duyệt - Green */}
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 px-3 font-medium text-xs shadow-sm transition-colors"
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
          className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 h-8 px-3 font-medium text-xs shadow-sm transition-colors"
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
