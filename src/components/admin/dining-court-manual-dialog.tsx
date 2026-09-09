'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Utensils,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { DiningAllocationResult, ClassMealSummary, ManualCourtInput } from '@/lib/dining-court-service';
import Swal from 'sweetalert2';

interface ManualCourtItem {
  id: string; // id tạm thời cho UI
  shift: 'TIET_4' | 'TIET_5';
  courtNumber: number;
  courtName: string;
  cartNumber: number;
  cartName: string;
  classIds: string[];
}

interface DiningCourtManualDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: DiningAllocationResult;
  selectedDate: string;
  onSaved: () => void;
}

export function DiningCourtManualDialog({
  isOpen,
  onClose,
  data,
  selectedDate,
  onSaved,
}: DiningCourtManualDialogProps) {
  const [activeShift, setActiveShift] = useState<'TIET_4' | 'TIET_5'>('TIET_4');
  const [courts, setCourts] = useState<ManualCourtItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Tạo map tra cứu nhanh thông tin lớp học từ availableClasses (hỗ trợ theo ca để tránh đè dữ liệu)
  const classMap = useMemo(() => {
    const map = new Map<string, ClassMealSummary>();
    if (data?.availableClasses) {
      data.availableClasses.TIET_4.forEach((c) => {
        map.set(c.classId, c);
        map.set(`${c.classId}::TIET_4`, c);
      });
      data.availableClasses.TIET_5.forEach((c) => {
        if (!map.has(c.classId)) {
          map.set(c.classId, c);
        }
        map.set(`${c.classId}::TIET_5`, c);
      });
    }
    return map;
  }, [data]);

  // Khởi tạo danh sách sân khi mở dialog
  useEffect(() => {
    if (!isOpen || !data) return;

    const initialCourts: ManualCourtItem[] = [];

    // Nếu ngày đã có phân bổ sân thì load từ data hiện tại
    if (data.isConfigured) {
      data.shifts.TIET_4.courts.forEach((c, idx) => {
        initialCourts.push({
          id: `court-t4-${c.courtNumber}-${idx}`,
          shift: 'TIET_4',
          courtNumber: c.courtNumber,
          courtName: c.courtName || `Sân ${c.courtNumber}`,
          cartNumber: c.cartNumber || Math.ceil(c.courtNumber / 2),
          cartName: c.cartName || `Xe ${c.cartNumber || Math.ceil(c.courtNumber / 2)}`,
          classIds: c.classes.map((cls) => cls.classId),
        });
      });

      data.shifts.TIET_5.courts.forEach((c, idx) => {
        initialCourts.push({
          id: `court-t5-${c.courtNumber}-${idx}`,
          shift: 'TIET_5',
          courtNumber: c.courtNumber,
          courtName: c.courtName || `Sân ${c.courtNumber}`,
          cartNumber: c.cartNumber || Math.ceil(c.courtNumber / 2),
          cartName: c.cartName || `Xe ${c.cartNumber || Math.ceil(c.courtNumber / 2)}`,
          classIds: c.classes.map((cls) => cls.classId),
        });
      });
    } else {
      // Nếu chưa có cấu hình: tự khởi tạo 1 sân mẫu cho mỗi tiết nếu tiết đó có lớp
      const t4Classes = data.availableClasses?.TIET_4 || [];
      const t5Classes = data.availableClasses?.TIET_5 || [];

      if (t4Classes.length > 0) {
        initialCourts.push({
          id: `court-t4-1-${Date.now()}`,
          shift: 'TIET_4',
          courtNumber: 1,
          courtName: 'Sân 1',
          cartNumber: 1,
          cartName: 'Xe 1',
          classIds: [],
        });
      }

      if (t5Classes.length > 0) {
        const startT5Num = initialCourts.length + 1;
        initialCourts.push({
          id: `court-t5-${startT5Num}-${Date.now()}`,
          shift: 'TIET_5',
          courtNumber: startT5Num,
          courtName: `Sân ${startT5Num}`,
          cartNumber: Math.ceil(startT5Num / 2),
          cartName: `Xe ${Math.ceil(startT5Num / 2)}`,
          classIds: [],
        });
      }
    }

    setCourts(initialCourts);
  }, [isOpen, data]);

  // Các lớp thuộc ca đang chọn
  const shiftClasses = useMemo(() => {
    if (!data?.availableClasses) return [];
    return activeShift === 'TIET_4' ? data.availableClasses.TIET_4 : data.availableClasses.TIET_5;
  }, [data, activeShift]);

  // Các sân thuộc ca đang chọn
  const currentShiftCourts = useMemo(() => {
    return courts.filter((c) => c.shift === activeShift);
  }, [courts, activeShift]);

  // Tập hợp các classId đã được gán vào sân ở ca hiện tại
  const assignedClassIds = useMemo(() => {
    const set = new Set<string>();
    currentShiftCourts.forEach((c) => {
      c.classIds.forEach((id) => set.add(id));
    });
    return set;
  }, [currentShiftCourts]);

  // Các lớp chưa được xếp vào sân nào ở ca này
  const unassignedClasses = useMemo(() => {
    return shiftClasses.filter((c) => !assignedClassIds.has(c.classId));
  }, [shiftClasses, assignedClassIds]);

  // Thêm sân mới cho ca hiện tại
  // Thêm sân mới cho ca hiện tại (tự động gán số sân nhỏ nhất chưa dùng từ 1 đến 16)
  const handleAddCourt = () => {
    const shiftCourts = courts.filter((c) => c.shift === activeShift);
    if (shiftCourts.length >= 16) {
      Swal.fire('Thông báo', 'Mỗi tiết học chỉ được phân tối đa 16 sân ăn.', 'warning');
      return;
    }

    // Tìm số sân nhỏ nhất chưa sử dụng trên toàn trường từ 1 đến 16
    const usedNums = new Set(courts.map((c) => c.courtNumber));
    let newCourtNumber = 1;
    while (usedNums.has(newCourtNumber) && newCourtNumber <= 16) {
      newCourtNumber++;
    }
    const newCartNumber = Math.ceil(newCourtNumber / 2);

    const newCourt: ManualCourtItem = {
      id: `court-${activeShift}-${Date.now()}`,
      shift: activeShift,
      courtNumber: newCourtNumber,
      courtName: `Sân ${newCourtNumber}`,
      cartNumber: newCartNumber,
      cartName: `Xe ${newCartNumber}`,
      classIds: [],
    };

    setCourts((prev) => [...prev, newCourt]);
  };

  // Xóa sân
  const handleDeleteCourt = (courtId: string) => {
    setCourts((prev) => prev.filter((c) => c.id !== courtId));
  };

  // Đánh số thứ tự sân và xe cơm liên tục cho cả Tiết 4 và Tiết 5
  const renumberCourts = (list: ManualCourtItem[]): ManualCourtItem[] => {
    const t4 = list.filter((c) => c.shift === 'TIET_4');
    const t5 = list.filter((c) => c.shift === 'TIET_5');

    let num = 1;
    const result: ManualCourtItem[] = [];

    t4.forEach((c) => {
      const cart = Math.ceil(num / 2);
      result.push({
        ...c,
        courtNumber: num,
        courtName: `Sân ${num}`,
        cartNumber: cart,
        cartName: `Xe ${cart}`,
      });
      num++;
    });

    t5.forEach((c) => {
      const cart = Math.ceil(num / 2);
      result.push({
        ...c,
        courtNumber: num,
        courtName: `Sân ${num}`,
        cartNumber: cart,
        cartName: `Xe ${cart}`,
      });
      num++;
    });

    return result;
  };

  // Thay đổi số sân (TỰ ĐỘNG HOÁN ĐỔI nếu số sân đã có sân khác sử dụng để tránh trùng)
  const handleChangeCourtNumber = (courtId: string, targetNum: number) => {
    setCourts((prev) => {
      const currentCourt = prev.find((c) => c.id === courtId);
      if (!currentCourt || currentCourt.courtNumber === targetNum) return prev;

      const oldNum = currentCourt.courtNumber;
      const targetCartNum = Math.ceil(targetNum / 2);
      const oldCartNum = Math.ceil(oldNum / 2);

      // Tìm xem targetNum đã có sân nào dùng chưa (kể cả cùng ca hoặc ca khác)
      const existingWithTarget = prev.find((c) => c.courtNumber === targetNum && c.id !== courtId);

      if (existingWithTarget) {
        // Tự động hoán đổi số sân giữa 2 sân
        const targetShiftLabel = existingWithTarget.shift === 'TIET_4' ? 'Tiết 4' : 'Tiết 5';
        const currentShiftLabel = currentCourt.shift === 'TIET_4' ? 'Tiết 4' : 'Tiết 5';

        const updated = prev.map((c) => {
          if (c.id === courtId) {
            return {
              ...c,
              courtNumber: targetNum,
              courtName: `Sân ${targetNum}`,
              cartNumber: targetCartNum,
              cartName: `Xe ${targetCartNum}`,
            };
          }
          if (c.id === existingWithTarget.id) {
            return {
              ...c,
              courtNumber: oldNum,
              courtName: `Sân ${oldNum}`,
              cartNumber: oldCartNum,
              cartName: `Xe ${oldCartNum}`,
            };
          }
          return c;
        });

        Swal.fire({
          icon: 'info',
          title: 'Đã hoán đổi số Sân!',
          html: `<div class="text-xs text-slate-600 text-left">
            Đã hoán đổi: <b>Sân ${oldNum}</b> (${currentShiftLabel}) ⇄ <b>Sân ${targetNum}</b> (${targetShiftLabel}).<br/>
            Số xe cơm cũng đã tự động cập nhật tương ứng theo quy chuẩn.
          </div>`,
          timer: 2500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });

        return updated;
      } else {
        // Số sân chưa ai dùng, chỉ cập nhật sân hiện tại
        const updated = prev.map((c) => {
          if (c.id === courtId) {
            return {
              ...c,
              courtNumber: targetNum,
              courtName: `Sân ${targetNum}`,
              cartNumber: targetCartNum,
              cartName: `Xe ${targetCartNum}`,
            };
          }
          return c;
        });

        Swal.fire({
          icon: 'success',
          title: `Đã đổi thành Sân ${targetNum}`,
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });

        return updated;
      }
    });
  };

  // Thay đổi số xe cơm
  const handleChangeCartNumber = (courtId: string, targetCartNum: number) => {
    setCourts((prev) =>
      prev.map((c) => {
        if (c.id === courtId) {
          return {
            ...c,
            cartNumber: targetCartNum,
            cartName: `Xe ${targetCartNum}`,
          };
        }
        return c;
      })
    );
  };

  // Lấy tên hiển thị của lớp học
  const getClassName = (id: string, shift: 'TIET_4' | 'TIET_5') => {
    const cls = classMap.get(`${id}::${shift}`) || classMap.get(id);
    return cls?.className || id;
  };

  // Đánh lại số thứ tự sân và xe cơm (sắp xếp khoa học theo thứ tự lớp học & ca học)
  const handleRenumber = async () => {
    const confirm = await Swal.fire({
      title: 'Đánh lại số Sân & Xe?',
      text: 'Hệ thống sẽ sắp xếp lại toàn bộ sân theo khối lớp và đánh lại số thứ tự liên tục từ Sân 1. Bạn có chắc chắn?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý đánh lại',
      cancelButtonText: 'Hủy bỏ',
    });
    if (!confirm.isConfirmed) return;

    // Sắp xếp các lớp bên trong từng sân theo thứ tự tự nhiên (VD: 10A1 trước 10A2)
    const sortClassesInsideCourts = (list: ManualCourtItem[]): ManualCourtItem[] => {
      return list.map((c) => ({
        ...c,
        classIds: [...c.classIds].sort((aId, bId) => {
          const nameA = getClassName(aId, c.shift);
          const nameB = getClassName(bId, c.shift);
          return nameA.localeCompare(nameB, 'vi', { numeric: true });
        }),
      }));
    };

    // Sắp xếp các sân trong từng ca theo lớp đại diện đầu tiên
    const sortCourtByClass = (courtA: ManualCourtItem, courtB: ManualCourtItem) => {
      if (courtA.classIds.length === 0 && courtB.classIds.length === 0) return 0;
      if (courtA.classIds.length === 0) return 1; // Sân trống về sau
      if (courtB.classIds.length === 0) return -1;

      const getFirstClassName = (court: ManualCourtItem) => {
        const sortedNames = court.classIds
          .map((id) => getClassName(id, court.shift))
          .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
        return sortedNames[0] || '';
      };

      const nameA = getFirstClassName(courtA);
      const nameB = getFirstClassName(courtB);
      return nameA.localeCompare(nameB, 'vi', { numeric: true });
    };

    const t4 = sortClassesInsideCourts(courts.filter((c) => c.shift === 'TIET_4')).sort(sortCourtByClass);
    const t5 = sortClassesInsideCourts(courts.filter((c) => c.shift === 'TIET_5')).sort(sortCourtByClass);

    const renumbered = renumberCourts([...t4, ...t5]);
    setCourts(renumbered);

    Swal.fire({
      icon: 'success',
      title: 'Đã đánh lại số Sân & Xe!',
      text: 'Các sân đã được sắp xếp khoa học theo thứ tự lớp học và đánh lại số liên tục.',
      timer: 1800,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  };

  // Di chuyển sân lên hoặc xuống trong cùng ca học
  const handleMoveCourt = (courtId: string, direction: 'UP' | 'DOWN') => {
    const shiftCourts = courts.filter((c) => c.shift === activeShift);
    const otherCourts = courts.filter((c) => c.shift !== activeShift);
    const index = shiftCourts.findIndex((c) => c.id === courtId);
    if (index === -1) return;

    if (direction === 'UP' && index > 0) {
      const temp = shiftCourts[index - 1];
      shiftCourts[index - 1] = shiftCourts[index];
      shiftCourts[index] = temp;
    } else if (direction === 'DOWN' && index < shiftCourts.length - 1) {
      const temp = shiftCourts[index + 1];
      shiftCourts[index + 1] = shiftCourts[index];
      shiftCourts[index] = temp;
    } else {
      return;
    }

    const updated =
      activeShift === 'TIET_4'
        ? [...shiftCourts, ...otherCourts]
        : [...otherCourts, ...shiftCourts];

    setCourts(updated);
  };

  // Thêm lớp vào sân
  const handleAddClassToCourt = (courtId: string, classId: string) => {
    if (!classId) return;
    setCourts((prev) =>
      prev.map((c) => {
        if (c.id === courtId) {
          if (c.classIds.includes(classId)) return c;
          return {
            ...c,
            classIds: [...c.classIds, classId],
          };
        }
        return c;
      })
    );
  };

  // Gỡ lớp khỏi sân
  const handleRemoveClassFromCourt = (courtId: string, classId: string) => {
    setCourts((prev) =>
      prev.map((c) => {
        if (c.id === courtId) {
          return {
            ...c,
            classIds: c.classIds.filter((id) => id !== classId),
          };
        }
        return c;
      })
    );
  };

  // Lưu phân bổ sân thủ công
  const handleSave = async () => {
    // Kiểm tra xem có sân nào có lớp không
    const courtsWithClasses = courts.filter((c) => c.classIds.length > 0);
    if (courtsWithClasses.length === 0) {
      Swal.fire('Lỗi', 'Vui lòng xếp ít nhất một lớp học vào sân ăn trước khi lưu.', 'error');
      return;
    }

    // Kiểm tra các lớp còn tồn đọng chưa xếp
    const allAssigned = new Set<string>();
    courts.forEach((c) => c.classIds.forEach((id) => allAssigned.add(id)));

    const remainingT4 = (data.availableClasses?.TIET_4 || []).filter((c) => !allAssigned.has(c.classId));
    const remainingT5 = (data.availableClasses?.TIET_5 || []).filter((c) => !allAssigned.has(c.classId));
    const totalRemaining = remainingT4.length + remainingT5.length;

    if (totalRemaining > 0) {
      const confirm = await Swal.fire({
        title: 'Còn lớp chưa được xếp sân!',
        text: `Hiện vẫn còn ${totalRemaining} lớp chưa được xếp vào sân ăn (Tiết 4: ${remainingT4.length} lớp, Tiết 5: ${remainingT5.length} lớp). Bạn có chắc chắn muốn lưu cấu hình này?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Vẫn lưu cấu hình',
        cancelButtonText: 'Quay lại xếp tiếp',
      });

      if (!confirm.isConfirmed) return;
    }

    // Chuẩn hóa payload
    const payloadCourts: ManualCourtInput[] = courtsWithClasses.map((c) => ({
      shift: c.shift,
      courtNumber: c.courtNumber,
      courtName: c.courtName,
      cartNumber: c.cartNumber,
      cartName: c.cartName,
      classIds: c.classIds,
    }));

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dining-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          action: 'MANUAL',
          courts: payloadCourts,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Lỗi khi lưu phân bổ sân thủ công');
      }

      Swal.fire({
        icon: 'success',
        title: 'Đã lưu phân bổ sân thành công!',
        timer: 1500,
        showConfirmButton: false,
      });

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving manual dining courts:', error);
      Swal.fire('Lỗi', error instanceof Error ? error.message : 'Không thể lưu phân bổ sân', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-5 bg-white border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Phân Bổ Chia Sân Thủ Công
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Tùy chỉnh xếp lớp vào từng sân ăn. Sức chứa tối đa khuyến nghị: 60 suất / sân.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
              Ngày: {selectedDate}
            </Badge>
          </div>
        </DialogHeader>

        {/* Thanh chọn ca học (Tiết 4 / Tiết 5) */}
        <div className="bg-white px-5 py-2.5 border-b flex items-center justify-between gap-3 shrink-0">
          <Tabs value={activeShift} onValueChange={(val) => setActiveShift(val as 'TIET_4' | 'TIET_5')}>
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="TIET_4" className="text-xs font-semibold data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                Tiết 4 (Ca 1) - {data?.availableClasses?.TIET_4.length || 0} lớp
              </TabsTrigger>
              <TabsTrigger value="TIET_5" className="text-xs font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                Tiết 5 (Ca 2) - {data?.availableClasses?.TIET_5.length || 0} lớp
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRenumber}
              className="text-xs h-8 cursor-pointer gap-1 hover:bg-slate-100 font-medium"
              title="Sắp xếp các sân theo thứ tự khối lớp và đánh lại số sân & xe liên tục"
            >
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span>Đánh lại số Sân &amp; Xe</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddCourt}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer gap-1 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm sân ({activeShift === 'TIET_4' ? 'Tiết 4' : 'Tiết 5'})</span>
            </Button>
          </div>
        </div>

        {/* Thân giao diện: 2 cột (Cột trái: Lớp chưa xếp - Cột phải: Danh sách các sân) */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* CỘT TRÁI: CÁC LỚP CHƯA XẾP VÀO SÂN (4 CỘT) */}
          <div className="md:col-span-4 space-y-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Lớp chưa xếp ({unassignedClasses.length})
                </span>
                <Badge variant="outline" className="text-[11px] font-bold text-amber-700 bg-amber-50 border-amber-200">
                  {unassignedClasses.reduce((sum, c) => sum + c.totalMeals, 0)} suất
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Bấm nút chọn lớp tại mỗi sân hoặc gán trực tiếp để xếp lớp vào sân.
              </p>

              {unassignedClasses.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-emerald-200 rounded-lg bg-emerald-50/50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-emerald-800">Đã xếp xong toàn bộ lớp!</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Không còn lớp nào bị bỏ sót ở ca này.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                  {unassignedClasses.map((cls) => (
                    <div
                      key={cls.classId}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-sm text-slate-800">{cls.className}</span>
                        <div className="text-[11px] text-slate-500">
                          Mặn: {cls.manCount} | Chay: {cls.chayCount} | Cháo: {cls.chaoCount}
                        </div>
                      </div>
                      <span className="font-bold text-xs px-2 py-1 bg-white rounded border border-slate-200 text-blue-700 shadow-2xs">
                        {cls.totalMeals} suất
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hướng dẫn tiêu chuẩn */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Tiêu chuẩn chia sân ăn:</span>
              </div>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-800">
                <li>Sức chứa chuẩn: <strong>40 - 60 suất / sân</strong>.</li>
                <li>Khuyến nghị tối đa: <strong>60 suất / sân</strong>.</li>
                <li>1 Xe cơm phục vụ 2 sân liên tiếp (Sân 1-2: Xe 1, Sân 3-4: Xe 2).</li>
              </ul>
            </div>
          </div>

          {/* CỘT PHẢI: DANH SÁCH CÁC SÂN CỦA CA HIỆN TẠI (8 CỘT) */}
          <div className="md:col-span-8 space-y-4">
            {currentShiftCourts.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-300">
                <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Chưa có sân nào cho {activeShift === 'TIET_4' ? 'Tiết 4' : 'Tiết 5'}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Bấm nút "+ Thêm sân" ở góc trên bên phải để bắt đầu tạo sân và phân lớp.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCourt}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Thêm sân đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {currentShiftCourts.map((court, idx) => {
                  // Tính tổng suất của sân
                  const courtMeals = court.classIds.reduce((sum, cid) => {
                    const cls = classMap.get(`${cid}::${court.shift}`) || classMap.get(cid);
                    return sum + (cls ? cls.totalMeals : 0);
                  }, 0);

                  const isOver = courtMeals > 60;
                  const isIdeal = courtMeals >= 40 && courtMeals <= 60;
                  const percent = Math.min(100, Math.round((courtMeals / 60) * 100));

                  return (
                    <div
                      key={court.id}
                      className={`bg-white rounded-xl border transition-shadow shadow-2xs overflow-hidden ${
                        isOver ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'
                      }`}
                    >
                      {/* Tiêu đề sân */}
                      <div className="px-4 py-2.5 bg-slate-50/80 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Dropdown chọn trực tiếp số sân */}
                          <div className="flex items-center gap-1 bg-slate-900 text-white rounded-md px-1.5 py-0.5 border border-slate-800 shadow-2xs">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sân:</span>
                            <select
                              value={court.courtNumber}
                              onChange={(e) => handleChangeCourtNumber(court.id, Number(e.target.value))}
                              className="bg-transparent text-white font-extrabold text-xs cursor-pointer focus:outline-none pr-0.5"
                              title="Bấm để đổi số Sân (nếu trùng số sân đã có, hệ thống sẽ tự động hoán đổi)"
                            >
                              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n} className="bg-white text-slate-900 font-semibold">
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Dropdown chọn số xe cơm */}
                          <div className="flex items-center gap-1 bg-rose-50 text-rose-700 rounded-md px-1.5 py-0.5 border border-rose-200 shadow-2xs">
                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Xe:</span>
                            <select
                              value={court.cartNumber}
                              onChange={(e) => handleChangeCartNumber(court.id, Number(e.target.value))}
                              className="bg-transparent text-rose-700 font-extrabold text-xs cursor-pointer focus:outline-none pr-0.5"
                              title="Bấm để đổi số Xe cơm phục vụ sân này"
                            >
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n} className="bg-white text-slate-900 font-semibold">
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-xs text-slate-500 font-medium">
                            ({court.classIds.length} lớp)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Trạng thái sức chứa */}
                          {court.classIds.length > 0 && (
                            <>
                              {isOver ? (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Vượt 60 suất!</span>
                                </Badge>
                              ) : isIdeal ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                                  Chuẩn (40-60)
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                                  Dưới 40
                                </Badge>
                              )}
                            </>
                          )}

                          <span className={`text-xs font-extrabold px-2 py-0.5 rounded border ${
                            isOver
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isIdeal
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {courtMeals}/60 suất
                          </span>

                          {/* Bộ nút di chuyển thứ tự sân lên / xuống */}
                          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveCourt(court.id, 'UP')}
                              disabled={idx === 0}
                              className="h-6 w-6 text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                              title="Di chuyển sân lên trên (tự động cập nhật số Sân)"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveCourt(court.id, 'DOWN')}
                              disabled={idx === currentShiftCourts.length - 1}
                              className="h-6 w-6 text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                              title="Di chuyển sân xuống dưới (tự động cập nhật số Sân)"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCourt(court.id)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Xóa sân này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Thanh đo sức chứa trực quan */}
                      <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isOver ? 'bg-rose-500' : isIdeal ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Thân sân: Danh sách lớp đã gán & Dropdown thêm lớp */}
                      <div className="p-3.5 space-y-3">
                        {/* Lớp đã gán */}
                        <div className="flex flex-wrap items-center gap-2">
                          {court.classIds.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Chưa có lớp nào trong sân này.</span>
                          ) : (
                            court.classIds.map((cid) => {
                              const cls = classMap.get(`${cid}::${court.shift}`) || classMap.get(cid);
                              return (
                                <div
                                  key={cid}
                                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md text-xs font-medium"
                                >
                                  <span className="font-bold">{cls?.className || cid}</span>
                                  <span className="text-[11px] text-blue-700">({cls?.totalMeals || 0} suất)</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveClassFromCourt(court.id, cid)}
                                    className="text-blue-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                    title="Gỡ lớp khỏi sân"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Dropdown thêm lớp vào sân */}
                        {unassignedClasses.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                            <span className="text-xs text-slate-500 shrink-0 font-medium">+ Thêm lớp vào sân:</span>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddClassToCourt(court.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none"
                            >
                              <option value="" disabled>
                                -- Chọn lớp để thêm ({unassignedClasses.length} lớp còn lại) --
                              </option>
                              {unassignedClasses.map((cls) => (
                                <option key={cls.classId} value={cls.classId}>
                                  Lớp {cls.className} ({cls.totalMeals} suất)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chân Dialog */}
        <DialogFooter className="p-4 bg-white border-t shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Info className="h-4 w-4 text-blue-500" />
            <span>
              Tổng số: <strong>{courts.length} sân</strong> ({courts.filter((c) => c.shift === 'TIET_4').length} Tiết 4,{' '}
              {courts.filter((c) => c.shift === 'TIET_5').length} Tiết 5)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || courts.filter((c) => c.classIds.length > 0).length === 0}
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Đang lưu phân bổ...' : 'Lưu phân bổ sân'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
