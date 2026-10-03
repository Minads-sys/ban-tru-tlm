/**
 * special-meal-resolver.ts
 * Module chuẩn hóa logic giải quyết xung đột ca ăn giữa Lịch thường niên & Lịch đặc biệt.
 *
 * Nguyên tắc nghiệp vụ đã thống nhất:
 * 1. Nếu lớp gốc KHÔNG có lịch ăn bán trú (NONE):
 *    -> Tính suất ăn theo Nhóm đặc biệt, ngồi tại Sân của Nhóm, cộng thêm 1 ngày vào phiếu thu (isExtraBillDay = true).
 * 2. Nếu lớp gốc CÓ lịch ăn bán trú và CÙNG CA ĂN với nhóm đặc biệt:
 *    -> Học sinh ngồi ăn cùng lớp gốc, không tách riêng, không tính trùng khay (action = REGULAR_CLASS).
 * 3. Nếu lớp gốc CÓ lịch ăn bán trú nhưng KHÁC CA ĂN với nhóm đặc biệt:
 *    -> BẮT BUỘC TÁCH HỌC SINH: Lớp gốc bị trừ 1 suất ở ca của lớp, học sinh chuyển sang ăn ở ca của Nhóm đặc biệt (action = SPLIT_TO_SPECIAL).
 *       Hóa đơn vẫn tính là 1 ngày ăn trong tháng (không cộng thêm tiền), nhưng Bếp và Sân ăn chia đúng giờ.
 */

import { ScheduleType } from "@prisma/client";

export type ShiftType = "TIET_4" | "TIET_5";
export type ClassShiftType = ShiftType | "NONE" | string;
export type SpecialShiftType = ScheduleType | ShiftType | "NONE" | null | undefined;

export interface MealResolution {
  action: "REGULAR_CLASS" | "SPECIAL_ONLY" | "SPLIT_TO_SPECIAL" | "NO_MEAL";
  assignedShift: ShiftType | null;
  diningTarget: "CLASS" | "SPECIAL_GROUP" | "NONE";
  isExtraBillDay: boolean; // Có tính thêm 1 ngày vào phiếu thu không
  deductFromClassShift: ShiftType | null; // Ca của lớp gốc bị trừ 1 suất
}

export function resolveStudentMealForDate(
  classShift: ClassShiftType,
  specialShift: SpecialShiftType
): MealResolution {
  const normSpecial: ShiftType | null =
    specialShift === "TIET_4" || specialShift === "TIET_5" ? specialShift : null;
  const normClass: "TIET_4" | "TIET_5" | "NONE" =
    classShift === "TIET_4" || classShift === "TIET_5" ? classShift : "NONE";

  // TH 0: Không có lịch nào
  if (normClass === "NONE" && !normSpecial) {
    return {
      action: "NO_MEAL",
      assignedShift: null,
      diningTarget: "NONE",
      isExtraBillDay: false,
      deductFromClassShift: null,
    };
  }

  // TH 1: Không có lịch đặc biệt -> Ăn theo lớp thường niên
  if (!normSpecial) {
    return {
      action: "REGULAR_CLASS",
      assignedShift: normClass === "NONE" ? null : normClass,
      diningTarget: "CLASS",
      isExtraBillDay: false,
      deductFromClassShift: null,
    };
  }

  // TH 2: Lớp không ăn (NONE), chỉ có lịch đặc biệt
  if (normClass === "NONE") {
    return {
      action: "SPECIAL_ONLY",
      assignedShift: normSpecial,
      diningTarget: "SPECIAL_GROUP",
      isExtraBillDay: true, // Lớp không có lịch, đây là ngày ăn phát sinh thêm
      deductFromClassShift: null,
    };
  }

  // TH 3: Cả 2 cùng có lịch và CÙNG CA ĂN -> Ăn cùng lớp gốc
  if (normClass === normSpecial) {
    return {
      action: "REGULAR_CLASS",
      assignedShift: normClass,
      diningTarget: "CLASS",
      isExtraBillDay: false, // Đã tính theo lịch lớp, không tính thêm
      deductFromClassShift: null,
    };
  }

  // TH 4 & 5: Cả 2 cùng có lịch nhưng KHÁC CA ĂN -> Tách khỏi lớp gốc sang Nhóm đặc biệt
  return {
    action: "SPLIT_TO_SPECIAL",
    assignedShift: normSpecial,
    diningTarget: "SPECIAL_GROUP",
    isExtraBillDay: false, // Vẫn là 1 ngày ăn trong tháng của học sinh
    deductFromClassShift: normClass, // Lớp gốc bị trừ 1 suất ở ca của lớp
  };
}
