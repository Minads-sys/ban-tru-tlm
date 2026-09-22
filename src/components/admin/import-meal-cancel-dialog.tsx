'use client';

import React, { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Loader2, Search, X } from 'lucide-react';
import { validateMealCancelImport, importMealCancellations } from '@/app/admin/meal-cancel/actions';
import type { ValidateRowResult } from '@/app/admin/meal-cancel/actions';
import { parseMealCancelExcel } from '@/lib/excel';
import Swal from 'sweetalert2';

interface ImportMealCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ImportMealCancelDialog({
  open,
  onOpenChange,
  cutoffTime,
  onSuccess
}: ImportMealCancelDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [validationResults, setValidationResults] = useState<ValidateRowResult[] | null>(null);
  const [resolvedStudents, setResolvedStudents] = useState<Map<number, string>>(new Map());
  const [step, setStep] = useState<'upload' | 'result'>('upload');
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setReason('');
      setCustomReason('');
      setValidationResults(null);
      setResolvedStudents(new Map());
      setStep('upload');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  const isPastCutoff = () => {
    const vnTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const [hours, minutes] = (cutoffTime || '07:00').split(':').map(Number);
    return !isNaN(hours) && (vnTime.getHours() > hours || (vnTime.getHours() === hours && vnTime.getMinutes() >= (minutes || 0)));
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const pastCutoff = isPastCutoff();
  const finalReason = reason === 'Khác' ? customReason.trim() : reason;
  const canSubmit = file && finalReason && !pastCutoff && !isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/excel/template?type=meal-cancel', '_blank');
  };

  const handleValidate = async () => {
    if (!canSubmit || !file) return;

    startTransition(async () => {
      try {
        const buffer = await file.arrayBuffer();
        const parseResult = await parseMealCancelExcel(new Uint8Array(buffer));
        
        if (!parseResult.isValid) {
          Swal.fire({
            title: 'Lỗi đọc file',
            text: parseResult.errors[0]?.message || 'Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại định dạng file.',
            icon: 'error',
            confirmButtonText: 'Đóng'
          });
          return;
        }

        if (!parseResult.data || parseResult.data.length === 0) {
          Swal.fire({
            title: 'File trống',
            text: 'Không tìm thấy dữ liệu trong file Excel.',
            icon: 'warning',
            confirmButtonText: 'Đóng'
          });
          return;
        }

        const response = await validateMealCancelImport(parseResult.data);
        setValidationResults(response.rows);
        setStep('result');
      } catch (err: any) {
        console.error('Validation error:', err);
        Swal.fire({
          title: 'Lỗi hệ thống',
          text: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
          icon: 'error',
          confirmButtonText: 'Đóng'
        });
      }
    });
  };

  const handleResolveAmbiguous = (rowIndex: number, studentId: string) => {
    setResolvedStudents(prev => {
      const next = new Map(prev);
      next.set(rowIndex, studentId);
      return next;
    });
  };

  const handleImport = () => {
    if (!validationResults || isPending) return;

    const studentIds: string[] = [];

    validationResults.forEach((row, index) => {
      if (row.status === 'OK' && row.matchedStudentId) {
        studentIds.push(row.matchedStudentId);
      } else if (row.status === 'AMBIGUOUS' && resolvedStudents.has(index)) {
        studentIds.push(resolvedStudents.get(index)!);
      }
    });

    if (studentIds.length === 0) {
      Swal.fire('Cảnh báo', 'Không có suất ăn nào hợp lệ để cắt.', 'warning');
      return;
    }

    startTransition(async () => {
      try {
        const response = await importMealCancellations(studentIds, finalReason);
        if (response.success) {
          Swal.fire({
            title: 'Thành công',
            text: `Đã cắt ${studentIds.length} suất ăn thành công!`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          onSuccess?.();
          onOpenChange(false);
        } else {
          Swal.fire({
            title: 'Lỗi',
            text: response.error || 'Có lỗi xảy ra khi import cắt suất.',
            icon: 'error',
            confirmButtonText: 'Đóng'
          });
        }
      } catch (error) {
        console.error('Import error:', error);
        Swal.fire({
          title: 'Lỗi',
          text: 'Đã xảy ra lỗi hệ thống khi import cắt suất.',
          icon: 'error',
          confirmButtonText: 'Đóng'
        });
      }
    });
  };

  const summary = useMemo(() => {
    let totalOk = 0;
    let totalWarning = 0;
    let totalError = 0;
    let totalAmbiguous = 0;

    validationResults?.forEach(r => {
      if (r.status === 'OK') totalOk++;
      else if (r.status === 'WARNING') totalWarning++;
      else if (r.status === 'ERROR') totalError++;
      else if (r.status === 'AMBIGUOUS') totalAmbiguous++;
    });

    return { totalOk, totalWarning, totalError, totalAmbiguous };
  }, [validationResults]);

  const validCount = summary.totalOk + resolvedStudents.size;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isPending) onOpenChange(val); }}>
      <DialogContent className={step === 'result' ? 'max-w-4xl max-h-[90vh] flex flex-col' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Import cắt suất hàng loạt</DialogTitle>
          <DialogDescription>
            Import danh sách học sinh cần cắt suất ăn cho ngày hôm nay từ file Excel.
          </DialogDescription>
        </DialogHeader>

        {pastCutoff && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5" />
            <span>Đã quá giờ chốt suất ({cutoffTime}), không thể import cắt suất cho hôm nay.</span>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'upload' ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                <p className="font-medium text-slate-700">Ngày cắt suất: Hôm nay {todayStr}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lý do cắt suất <span className="text-red-500">*</span></label>
                <Select value={reason} onValueChange={setReason} disabled={pastCutoff || isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Chọn lý do --" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                    <SelectItem value="Khác">Khác...</SelectItem>
                  </SelectContent>
                </Select>
                {reason === 'Khác' && (
                  <Input
                    className="mt-2"
                    placeholder="Nhập lý do khác..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    disabled={pastCutoff || isPending}
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">File Excel <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    disabled={pastCutoff || isPending}
                    className="cursor-pointer"
                  />
                  <Button variant="outline" type="button" onClick={downloadTemplate} disabled={isPending}>
                    <Download className="h-4 w-4 mr-2" />
                    Tải mẫu
                  </Button>
                </div>
                {file && (
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <FileSpreadsheet className="h-4 w-4" /> {file.name}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden space-y-4">
              <div className="flex gap-4 p-3 bg-slate-50 border rounded-md shadow-sm">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Hợp lệ: {summary.totalOk}
                </Badge>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Bỏ qua: {summary.totalWarning}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Lỗi: {summary.totalError}
                </Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                  <HelpCircle className="h-4 w-4" /> Cần chọn: {summary.totalAmbiguous}
                </Badge>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center">Dòng</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Ngày sinh</TableHead>
                      <TableHead className="w-16 text-center">KQ</TableHead>
                      <TableHead className="w-1/3">Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults?.map((row, idx) => (
                      <TableRow key={idx} className={row.status === 'ERROR' ? 'bg-red-50/50' : row.status === 'AMBIGUOUS' ? 'bg-purple-50/50' : undefined}>
                        <TableCell className="text-center font-medium">{row.rowIndex}</TableCell>
                        <TableCell>{row.hoTen}</TableCell>
                        <TableCell>{row.lop}</TableCell>
                        <TableCell>{row.ngaySinh}</TableCell>
                        <TableCell className="text-center">
                          {row.status === 'OK' && <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />}
                          {row.status === 'WARNING' && <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />}
                          {row.status === 'ERROR' && <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />}
                          {row.status === 'AMBIGUOUS' && <HelpCircle className="h-5 w-5 text-purple-500 mx-auto" />}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className={
                              row.status === 'OK' ? 'text-green-700' :
                              row.status === 'WARNING' ? 'text-yellow-700' :
                              row.status === 'ERROR' ? 'text-red-700' : 'text-purple-700'
                            }>
                              {row.message}
                            </span>
                            
                            {row.status === 'OK' && row.matchedBoardingCode && (
                              <div className="mt-1 text-xs text-slate-500">
                                Mã bán trú: <span className="font-medium text-slate-700">{row.matchedBoardingCode}</span>
                              </div>
                            )}

                            {row.status === 'AMBIGUOUS' && row.candidates && row.candidates.length > 0 && (
                              <div className="mt-2">
                                <Select 
                                  value={resolvedStudents.get(idx) || ""} 
                                  onValueChange={(val) => handleResolveAmbiguous(idx, val)}
                                  disabled={isPending}
                                >
                                  <SelectTrigger className="h-8 text-xs border-purple-200 focus:ring-purple-500">
                                    <SelectValue placeholder="-- Chọn học sinh chính xác --" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {row.candidates.map(c => (
                                      <SelectItem key={c.studentId} value={c.studentId} className="text-xs">
                                        {c.fullName} - Lớp {row.lop} - {c.boardingCode} - Sinh {c.birthDate} {c.parentPhone ? `- SĐT: ${c.parentPhone}` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {(!validationResults || validationResults.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Không có dữ liệu
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Hủy
          </Button>
          
          {step === 'upload' ? (
            <Button onClick={handleValidate} disabled={!canSubmit}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kiểm tra hợp lệ
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={validCount === 0 || isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận Import ({validCount} suất)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
