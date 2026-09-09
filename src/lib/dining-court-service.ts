import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";
import { getWeekNumber, getVietnamTodayUTC, isPastCutoffTime, splitVietnameseName, compareVietnameseNames, getSchoolWeekInfo, SchoolWeekInfo } from "@/lib/utils";

export interface StudentMealInfo {
  id: string;
  studentCode: string;
  boardingCode: string;
  fullName: string;
  lastName?: string; // Họ và tên đệm (VD: "ĐÀO QUỐC")
  firstName?: string; // Tên chính (VD: "ANH")
  className: string;
  mealType: "MAN" | "CHAY" | "CHAO";
}

export interface ClassMealSummary {
  classId: string;
  className: string;
  shift: "TIET_4" | "TIET_5";
  totalMeals: number;
  manCount: number;
  chayCount: number;
  chaoCount: number;
  students: StudentMealInfo[];
}

export interface DiningCourt {
  courtNumber: number;
  courtName: string;
  cartNumber: number; // Số thứ tự xe cơm (1 xe chứa 2 sân: Math.ceil(courtNumber / 2))
  cartName: string;   // VD: "Xe 1", "Xe 2", "Xe 3"...
  shift: "TIET_4" | "TIET_5";
  classes: Array<{
    classId: string;
    className: string;
    totalMeals: number;
    manCount: number;
    chayCount: number;
    chaoCount: number;
  }>;
  totalMeals: number;
  manCount: number;
  chayCount: number;
  chaoCount: number;
  isSingleClass: boolean;
  isInIdealRange: boolean; // 40 - 60 suất
  isOverCapacity: boolean; // > 60 suất
  students: StudentMealInfo[];
}

export interface DiningAllocationResult {
  date: string; // YYYY-MM-DD
  dayOfWeekName: string; // Thứ Hai, Thứ Ba...
  lockTime2: string;
  isAfterLockTime: boolean; // true: số liệu đã chốt, false: số liệu tạm
  isConfigured: boolean;    // true: đã tạo phân bổ (tự động hoặc thủ công), false: chưa tạo
  allocationMode?: "AUTO" | "MANUAL";
  updatedAt?: string;
  totalCourts: number;
  totalCarts: number; // Tổng số xe cơm cần dùng (1 xe chứa 2 sân)
  totalClasses: number;
  totalMeals: number;
  unassignedClasses?: {
    TIET_4: ClassMealSummary[];
    TIET_5: ClassMealSummary[];
  };
  availableClasses?: {
    TIET_4: ClassMealSummary[];
    TIET_5: ClassMealSummary[];
  };
  shifts: {
    TIET_4: {
      totalCourts: number;
      totalClasses: number;
      totalMeals: number;
      courts: DiningCourt[];
    };
    TIET_5: {
      totalCourts: number;
      totalClasses: number;
      totalMeals: number;
      courts: DiningCourt[];
    };
  };
}

export const MAX_COURTS_PER_SHIFT = 16;
export const COURT_MAX_CAPACITY = 60;
export const COURT_IDEAL_MIN = 40;
export const COURT_IDEAL_MAX = 60;
export const COURT_TARGET_SUM = 50;

/**
 * Rút trích tên lịch đặc biệt gốc từ classId lớp ảo
 * Ví dụ: "SPECIAL::NN2 Tieng Han::TIET_4 (1)" -> "NN2 Tieng Han"
 */
export function extractSpecialScheduleName(classId: string): string {
  return classId
    .replace(/^SPECIAL::/, "")
    .replace(/::TIET_[45]/, "")
    .replace(/ \(\d+\)$/, "");
}

/**
 * Thuật toán ghép lớp vào sân theo tiêu chuẩn:
 * - Ưu tiên 2 lớp / sân sao cho tổng số suất dao động từ 40 - 60
 * - Sức chứa tối đa 60 suất / sân
 * - Nếu số lớp lẻ hoặc lớp không ghép được thỏa điều kiện thì xếp sân lẻ 1 lớp
 * - Tối đa 16 sân trong 1 tiết ăn
 */
export function pairClassesIntoCourts(
  classes: ClassMealSummary[],
  shift: "TIET_4" | "TIET_5",
  startCourtNumber: number = 1
): DiningCourt[] {
  // Chỉ tính các lớp có học sinh ăn (> 0 suất)
  const available = [...classes.filter((c) => c.totalMeals > 0)];

  // Sắp xếp các lớp theo tên lớp (khối lớp) để các lớp cùng khối ưu tiên gần nhau
  available.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));

  const courts: DiningCourt[] = [];
  const usedClassIds = new Set<string>();

  // 1. Kiểm tra các lớp bản thân đã có số suất lớn trong khoảng 40 - 60 hoặc > 50
  // (Nếu ghép thêm lớp khác sẽ chắc chắn vượt quá 60 suất)
  for (const c of available) {
    if (usedClassIds.has(c.classId)) continue;

    // Nếu lớp có số suất lớn, thử xem có thể ghép với lớp siêu nhỏ nào mà tổng <= 60 không
    const canPairUnder60 = available.some(
      (other) => other.classId !== c.classId && !usedClassIds.has(other.classId) && c.totalMeals + other.totalMeals <= COURT_MAX_CAPACITY
    );

    if (!canPairUnder60 && c.totalMeals >= 42) {
      // Độc lập 1 sân
      usedClassIds.add(c.classId);
      courts.push({
        courtNumber: 0, // Đánh số sau
        courtName: "",
        cartNumber: 0,
        cartName: "",
        shift,
        classes: [
          {
            classId: c.classId,
            className: c.className,
            totalMeals: c.totalMeals,
            manCount: c.manCount,
            chayCount: c.chayCount,
            chaoCount: c.chaoCount,
          },
        ],
        totalMeals: c.totalMeals,
        manCount: c.manCount,
        chayCount: c.chayCount,
        chaoCount: c.chaoCount,
        isSingleClass: true,
        isInIdealRange: c.totalMeals >= COURT_IDEAL_MIN && c.totalMeals <= COURT_IDEAL_MAX,
        isOverCapacity: c.totalMeals > COURT_MAX_CAPACITY,
        students: [...c.students],
      });
    }
  }

  // 2. Tìm cặp 2 lớp sao cho tổng suất nằm trong khoảng [40, 60]
  for (let i = 0; i < available.length; i++) {
    const classA = available[i];
    if (usedClassIds.has(classA.classId)) continue;

    let bestMatchIndex = -1;
    let bestScore = -1; // Càng cao càng tốt

    for (let j = 0; j < available.length; j++) {
      if (i === j) continue;
      const classB = available[j];
      if (usedClassIds.has(classB.classId)) continue;

      const sum = classA.totalMeals + classB.totalMeals;
      // Quy tắc: KHÔNG trộn 2 lớp ảo khác tên lịch trong cùng 1 sân
      const isSpecialA = classA.classId.startsWith("SPECIAL::");
      const isSpecialB = classB.classId.startsWith("SPECIAL::");
      if (isSpecialA && isSpecialB) {
        const nameA = extractSpecialScheduleName(classA.classId);
        const nameB = extractSpecialScheduleName(classB.classId);
        if (nameA !== nameB) continue;
      }

      if (sum >= COURT_IDEAL_MIN && sum <= COURT_MAX_CAPACITY) {
        // Điểm số: ưu tiên tổng gần COURT_TARGET_SUM (50) nhất + cùng khối lớp
        const diffFromTarget = Math.abs(sum - COURT_TARGET_SUM);
        const gradeA = classA.className.replace(/[^0-9]/g, "").slice(0, 2);
        const gradeB = classB.className.replace(/[^0-9]/g, "").slice(0, 2);
        const sameGradeBonus = gradeA === gradeB ? 15 : 0;

        const score = 100 - diffFromTarget * 2 + sameGradeBonus;
        if (score > bestScore) {
          bestScore = score;
          bestMatchIndex = j;
        }
      }
    }

    if (bestMatchIndex !== -1) {
      const classB = available[bestMatchIndex];
      usedClassIds.add(classA.classId);
      usedClassIds.add(classB.classId);

      const totalMeals = classA.totalMeals + classB.totalMeals;
      const manCount = classA.manCount + classB.manCount;
      const chayCount = classA.chayCount + classB.chayCount;
      const chaoCount = classA.chaoCount + classB.chaoCount;

      courts.push({
        courtNumber: 0,
        courtName: "",
        cartNumber: 0,
        cartName: "",
        shift,
        classes: [
          {
            classId: classA.classId,
            className: classA.className,
            totalMeals: classA.totalMeals,
            manCount: classA.manCount,
            chayCount: classA.chayCount,
            chaoCount: classA.chaoCount,
          },
          {
            classId: classB.classId,
            className: classB.className,
            totalMeals: classB.totalMeals,
            manCount: classB.manCount,
            chayCount: classB.chayCount,
            chaoCount: classB.chaoCount,
          },
        ],
        totalMeals,
        manCount,
        chayCount,
        chaoCount,
        isSingleClass: false,
        isInIdealRange: true,
        isOverCapacity: totalMeals > COURT_MAX_CAPACITY,
        students: [...classA.students, ...classB.students],
      });
    }
  }

  // 3. Ghép 3+ lớp nhỏ vào 1 sân (Greedy multi-class grouping)
  // Sắp xếp lớp còn lại theo suất giảm dần, gom vào sân cho đến khi tổng ≤ 60
  const remaining = available.filter((c) => !usedClassIds.has(c.classId));
  remaining.sort((a, b) => b.totalMeals - a.totalMeals); // Lớn trước

  // Helper: kiểm tra 2 lớp có thể cùng sân không (quy tắc không trộn lớp ảo khác tên)
  const canShareCourt = (a: ClassMealSummary, b: ClassMealSummary): boolean => {
    const isSpecialA = a.classId.startsWith("SPECIAL::");
    const isSpecialB = b.classId.startsWith("SPECIAL::");
    if (isSpecialA && isSpecialB) {
      const nameA = extractSpecialScheduleName(a.classId);
      const nameB = extractSpecialScheduleName(b.classId);
      return nameA === nameB;
    }
    return true; // Lớp thường + lớp thường hoặc lớp thường + lớp ảo: OK
  };

  const remainingQueue = [...remaining];
  while (remainingQueue.length > 0) {
    // Lấy lớp lớn nhất còn lại làm hạt nhân
    const seed = remainingQueue.shift()!;
    const courtClasses: ClassMealSummary[] = [seed];
    let courtTotal = seed.totalMeals;
    let courtMan = seed.manCount;
    let courtChay = seed.chayCount;
    let courtChao = seed.chaoCount;
    const courtStudents: StudentMealInfo[] = [...seed.students];
    usedClassIds.add(seed.classId);

    // Thử thêm các lớp tiếp theo (từ nhỏ nhất lên, ưu tiên lấp đầy sân)
    for (let i = remainingQueue.length - 1; i >= 0; i--) {
      const candidate = remainingQueue[i];
      if (courtTotal + candidate.totalMeals <= COURT_MAX_CAPACITY && canShareCourt(seed, candidate)) {
        courtClasses.push(candidate);
        courtTotal += candidate.totalMeals;
        courtMan += candidate.manCount;
        courtChay += candidate.chayCount;
        courtChao += candidate.chaoCount;
        courtStudents.push(...candidate.students);
        usedClassIds.add(candidate.classId);
        remainingQueue.splice(i, 1);
      }
    }

    courts.push({
      courtNumber: 0,
      courtName: "",
      cartNumber: 0,
      cartName: "",
      shift,
      classes: courtClasses.map((c) => ({
        classId: c.classId,
        className: c.className,
        totalMeals: c.totalMeals,
        manCount: c.manCount,
        chayCount: c.chayCount,
        chaoCount: c.chaoCount,
      })),
      totalMeals: courtTotal,
      manCount: courtMan,
      chayCount: courtChay,
      chaoCount: courtChao,
      isSingleClass: courtClasses.length === 1,
      isInIdealRange: courtTotal >= COURT_IDEAL_MIN && courtTotal <= COURT_IDEAL_MAX,
      isOverCapacity: courtTotal > COURT_MAX_CAPACITY,
      students: courtStudents,
    });
  }

  // 4. BƯỚC TỐI ƯU HÓA: Tự động gộp các sân dưới chuẩn (< 40 suất) nếu tổng <= 60 suất
  // Đặc biệt ưu tiên đưa tổng suất về khoảng lý tưởng [40, 60] (Ví dụ: 36 suất + 13 suất = 49 suất)
  let canMergeMore = true;
  while (canMergeMore) {
    canMergeMore = false;
    let bestI = -1;
    let bestJ = -1;
    let bestScore = -1;

    for (let i = 0; i < courts.length; i++) {
      for (let j = i + 1; j < courts.length; j++) {
        const sum = courts[i].totalMeals + courts[j].totalMeals;
        // Kiểm tra quy tắc không trộn lớp ảo khác tên lịch
        const specialClassesI = courts[i].classes.filter((c) => c.classId.startsWith("SPECIAL::"));
        const specialClassesJ = courts[j].classes.filter((c) => c.classId.startsWith("SPECIAL::"));
        if (specialClassesI.length > 0 && specialClassesJ.length > 0) {
          const namesI = new Set(specialClassesI.map((c) => extractSpecialScheduleName(c.classId)));
          const namesJ = new Set(specialClassesJ.map((c) => extractSpecialScheduleName(c.classId)));
          let hasConflict = false;
          for (const n of namesI) {
            for (const m of namesJ) {
              if (n !== m) { hasConflict = true; break; }
            }
            if (hasConflict) break;
          }
          if (hasConflict) continue;
        }
        // Chỉ gộp khi tổng không vượt quá 60 suất và có ít nhất 1 sân đang dưới 40 suất
        if (sum <= COURT_MAX_CAPACITY && (courts[i].totalMeals < COURT_IDEAL_MIN || courts[j].totalMeals < COURT_IDEAL_MIN)) {
          let score = 0;
          if (sum >= COURT_IDEAL_MIN && sum <= COURT_MAX_CAPACITY) {
            // Rất ưu tiên vì đưa cả 2 sân vào khoảng chuẩn lý tưởng [40, 60]
            score = 1000 - Math.abs(sum - COURT_TARGET_SUM) * 10;
          } else {
            // Tổng vẫn < 40 nhưng gộp 2 sân lẻ lại vẫn tốt hơn để rời rạc
            score = 500 + sum;
          }

          if (score > bestScore) {
            bestScore = score;
            bestI = i;
            bestJ = j;
          }
        }
      }
    }

    if (bestI !== -1 && bestJ !== -1) {
      const c1 = courts[bestI];
      const c2 = courts[bestJ];
      const mergedTotalMeals = c1.totalMeals + c2.totalMeals;
      const mergedClasses = [...c1.classes, ...c2.classes];

      const mergedCourt: DiningCourt = {
        courtNumber: 0,
        courtName: "",
        cartNumber: 0,
        cartName: "",
        shift,
        classes: mergedClasses,
        totalMeals: mergedTotalMeals,
        manCount: c1.manCount + c2.manCount,
        chayCount: c1.chayCount + c2.chayCount,
        chaoCount: c1.chaoCount + c2.chaoCount,
        isSingleClass: mergedClasses.length === 1,
        isInIdealRange: mergedTotalMeals >= COURT_IDEAL_MIN && mergedTotalMeals <= COURT_IDEAL_MAX,
        isOverCapacity: mergedTotalMeals > COURT_MAX_CAPACITY,
        students: [...c1.students, ...c2.students],
      };

      courts.splice(bestJ, 1);
      courts.splice(bestI, 1, mergedCourt);
      canMergeMore = true;
    }
  }

  // 5. Giới hạn tối đa 16 sân trong 1 tiết ăn:
  // Nếu số sân vượt quá 16, tiến hành gộp các sân có số suất nhỏ nhất lại với nhau
  while (courts.length > MAX_COURTS_PER_SHIFT) {
    // Sắp xếp tìm 2 sân có tổng suất nhỏ nhất để gộp
    courts.sort((a, b) => a.totalMeals - b.totalMeals);
    const smallest1 = courts[0];
    const smallest2 = courts[1];

    const mergedTotalMeals = smallest1.totalMeals + smallest2.totalMeals;
    const mergedMan = smallest1.manCount + smallest2.manCount;
    const mergedChay = smallest1.chayCount + smallest2.chayCount;
    const mergedChao = smallest1.chaoCount + smallest2.chaoCount;
    const mergedClasses = [...smallest1.classes, ...smallest2.classes];

    const mergedCourt: DiningCourt = {
      courtNumber: 0,
      courtName: "",
      cartNumber: 0,
      cartName: "",
      shift,
      classes: mergedClasses,
      totalMeals: mergedTotalMeals,
      manCount: mergedMan,
      chayCount: mergedChay,
      chaoCount: mergedChao,
      isSingleClass: mergedClasses.length === 1,
      isInIdealRange: mergedTotalMeals >= COURT_IDEAL_MIN && mergedTotalMeals <= COURT_IDEAL_MAX,
      isOverCapacity: mergedTotalMeals > COURT_MAX_CAPACITY,
      students: [...smallest1.students, ...smallest2.students],
    };

    // Loại bỏ 2 sân nhỏ nhất và thay bằng sân gộp
    courts.splice(0, 2, mergedCourt);
  }

  // 6. Đánh số thứ tự sân và xe cơm liên tục
  courts.forEach((court, idx) => {
    const num = startCourtNumber + idx;
    court.courtNumber = num;
    court.courtName = `Sân ${num}`;
    court.cartNumber = Math.ceil(num / 2);
    court.cartName = `Xe ${court.cartNumber}`;

    // Sắp xếp các lớp trong sân theo thứ tự số tự nhiên (VD: 10A3 trước 12A10)
    court.classes.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));

    // Sắp xếp danh sách học sinh: Theo từng LỚP, trong mỗi lớp sắp xếp theo TÊN ABC (A - Z)
    court.students.sort((a, b) => {
      const cmpClass = a.className.localeCompare(b.className, "vi", { numeric: true });
      if (cmpClass !== 0) return cmpClass;
      return compareVietnameseNames(a.fullName, b.fullName);
    });
  });

  return courts;
}

/**
 * Lấy dữ liệu học sinh & lớp ăn bán trú của một ngày
 */
export async function getDayMealClasses(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0: CN, 1: T2, ..., 6: T7

  const dayNames = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  const dayOfWeekName = dayNames[dayOfWeek] || "";

  const dayFieldMap: Record<number, string> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };
  const dayField = dayFieldMap[dayOfWeek];

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["MEAL_LOCK_TIME_2", "CUTOFF_TIME"] } },
  });
  const lockTime2 =
    settings.find((s) => s.key === "MEAL_LOCK_TIME_2")?.value ||
    settings.find((s) => s.key === "CUTOFF_TIME")?.value ||
    "07:00";

  const localToday = getVietnamTodayUTC();
  const isPastDate = date < localToday;
  const isToday = date.getTime() === localToday.getTime();
  const isPastCutoff = isToday ? isPastCutoffTime(lockTime2) : isPastDate;

  const lockedSummariesCount = await prisma.dailyMealSummary.count({
    where: { summaryDate: date, isLocked: true },
  });
  const isLockedInDb = lockedSummariesCount > 0;
  const isAfterLockTime = isLockedInDb || isPastCutoff;

  if (!dayField) {
    return {
      date,
      dateStr,
      dayOfWeekName,
      lockTime2,
      isAfterLockTime,
      dayField: null,
      classSummariesTiet4: [] as ClassMealSummary[],
      classSummariesTiet5: [] as ClassMealSummary[],
      classMap: new Map<string, ClassMealSummary>(),
    };
  }

  const weekNumber = getWeekNumber(date);

  const schedules = await prisma.classWeeklySchedule.findMany({
    where: {
      year: y,
      weekNumber,
      [dayField]: { not: "NONE" },
    },
    include: {
      class: {
        include: {
          students: {
            where: {
              boardingStatus: BoardingStatus.ACTIVE,
            },
            include: {
              user: {
                select: { fullName: true },
              },
            },
            orderBy: [
              { boardingCode: "asc" },
              { studentCode: "asc" },
            ],
          },
        },
      },
    },
  });

  const approvedCancellations = await prisma.mealCancellation.findMany({
    where: {
      cancelDate: date,
      status: CancellationStatus.APPROVED,
    },
    select: { studentId: true },
  });
  const cancelledStudentIds = new Set(approvedCancellations.map((c) => c.studentId));

  const mealOverrides = await prisma.mealOverride.findMany({
    where: { date },
  });
  const overrideMap = new Map(mealOverrides.map((o) => [o.studentId, o.mealType]));

  const classSummariesTiet4: ClassMealSummary[] = [];
  const classSummariesTiet5: ClassMealSummary[] = [];
  const classMap = new Map<string, ClassMealSummary>();

  for (const schedule of schedules) {
    const shift = (schedule as any)[dayField] as "TIET_4" | "TIET_5";
    if (shift !== "TIET_4" && shift !== "TIET_5") continue;

    const students = schedule.class.students;
    const activeStudents = students.filter((s) => !cancelledStudentIds.has(s.id));

    let manCount = 0;
    let chayCount = 0;
    let chaoCount = 0;

    const studentList: StudentMealInfo[] = activeStudents.map((s) => {
      const finalMealType = (overrideMap.get(s.id) || s.mealType) as "MAN" | "CHAY" | "CHAO";
      if (finalMealType === "MAN") manCount++;
      else if (finalMealType === "CHAY") chayCount++;
      else if (finalMealType === "CHAO") chaoCount++;

      const fullName = s.user?.fullName || "Chưa có tên";
      const { lastName, firstName } = splitVietnameseName(fullName);

      return {
        id: s.id,
        studentCode: s.studentCode,
        boardingCode: s.boardingCode || "—",
        fullName,
        lastName,
        firstName,
        className: schedule.class.name,
        mealType: finalMealType,
      };
    });

    const summaryItem: ClassMealSummary = {
      classId: schedule.classId,
      className: schedule.class.name,
      shift,
      totalMeals: activeStudents.length,
      manCount,
      chayCount,
      chaoCount,
      students: studentList,
    };

    classMap.set(schedule.classId, summaryItem);

    if (shift === "TIET_4") {
      classSummariesTiet4.push(summaryItem);
    } else {
      classSummariesTiet5.push(summaryItem);
    }
  }

  // ==================== LỚP ẢO TỪ LỊCH ĂN ĐẶC BIỆT ====================
  // Lấy HS ăn đặc biệt ngày này
  const specialMeals = await prisma.studentSpecialMeal.findMany({
    where: { date },
    include: {
      student: {
        include: {
          user: { select: { fullName: true } },
          class: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Tạo map classId -> schedule để kiểm tra trùng TKB
  const scheduleClassIds = new Set(schedules.map((s) => s.classId));

  // Gom HS đặc biệt theo scheduleName + shift → tạo "lớp ảo"
  const specialGroups = new Map<string, {
    scheduleName: string;
    shift: "TIET_4" | "TIET_5";
    students: StudentMealInfo[];
  }>();

  for (const sm of specialMeals) {
    const student = sm.student;
    if (student.boardingStatus !== BoardingStatus.ACTIVE) continue;
    if (cancelledStudentIds.has(student.id)) continue;

    // Kiểm tra lớp HS đã có TKB ngày này chưa
    if (scheduleClassIds.has(student.classId)) {
      // TRÙNG → HS đã nằm trong sân lớp rồi, bỏ qua
      continue;
    }

    const smShift = sm.shift as "TIET_4" | "TIET_5";
    if (smShift !== "TIET_4" && smShift !== "TIET_5") continue;

    // Gom theo scheduleName + shift
    const groupKey = `${sm.scheduleName}::${smShift}`;
    if (!specialGroups.has(groupKey)) {
      specialGroups.set(groupKey, {
        scheduleName: sm.scheduleName,
        shift: smShift,
        students: [],
      });
    }

    const finalMealType = (overrideMap.get(student.id) || student.mealType) as "MAN" | "CHAY" | "CHAO";
    const fullName = student.user?.fullName || "Chưa có tên";
    const { lastName, firstName } = splitVietnameseName(fullName);

    specialGroups.get(groupKey)!.students.push({
      id: student.id,
      studentCode: student.studentCode,
      boardingCode: student.boardingCode || "—",
      fullName,
      lastName,
      firstName,
      className: student.class?.name || student.classId, // Lớp gốc của HS
      mealType: finalMealType,
    });
  }

  // Chuyển mỗi nhóm thành ClassMealSummary (lớp ảo)
  for (const [, group] of specialGroups) {
    // Nếu > 60 HS → tách thành nhiều lớp ảo
    for (let i = 0; i < group.students.length; i += COURT_MAX_CAPACITY) {
      const batch = group.students.slice(i, i + COURT_MAX_CAPACITY);
      const suffix = group.students.length > COURT_MAX_CAPACITY
        ? ` (${Math.floor(i / COURT_MAX_CAPACITY) + 1})` : "";

      let manCount = 0;
      let chayCount = 0;
      let chaoCount = 0;
      for (const s of batch) {
        if (s.mealType === "MAN") manCount++;
        else if (s.mealType === "CHAY") chayCount++;
        else if (s.mealType === "CHAO") chaoCount++;
      }

      const virtualId = `SPECIAL::${group.scheduleName}::${group.shift}${suffix}`;
      const virtualClass: ClassMealSummary = {
        classId: virtualId,
        className: `Lớp ${group.scheduleName}${suffix}`,
        shift: group.shift,
        totalMeals: batch.length,
        manCount,
        chayCount,
        chaoCount,
        students: batch,
      };

      classMap.set(virtualId, virtualClass);

      if (group.shift === "TIET_4") {
        classSummariesTiet4.push(virtualClass);
      } else {
        classSummariesTiet5.push(virtualClass);
      }
    }
  }

  return {
    date,
    dateStr,
    dayOfWeekName,
    lockTime2,
    isAfterLockTime,
    dayField,
    classSummariesTiet4,
    classSummariesTiet5,
    classMap,
  };
}

/**
 * Lấy toàn bộ phân bổ chia sân cho 1 ngày cụ thể.
 * Nếu đã được tạo trong DailyDiningCourt: load từ database và ánh xạ số học sinh realtime.
 * Nếu chưa tạo: trả về isConfigured = false kèm danh sách các lớp có lịch ăn.
 */
export async function getDiningCourtAllocation(dateStr: string): Promise<DiningAllocationResult> {
  const dayData = await getDayMealClasses(dateStr);
  const { date, dayOfWeekName, lockTime2, isAfterLockTime, classSummariesTiet4, classSummariesTiet5, classMap } = dayData;

  if (!dayData.dayField) {
    // Chủ nhật không có lịch ăn
    return {
      date: dateStr,
      dayOfWeekName,
      lockTime2,
      isAfterLockTime,
      isConfigured: false,
      totalCourts: 0,
      totalCarts: 0,
      totalClasses: 0,
      totalMeals: 0,
      shifts: {
        TIET_4: { totalCourts: 0, totalClasses: 0, totalMeals: 0, courts: [] },
        TIET_5: { totalCourts: 0, totalClasses: 0, totalMeals: 0, courts: [] },
      },
    };
  }

  // Lấy các bản ghi đã lưu trong DailyDiningCourt
  const savedCourts = await prisma.dailyDiningCourt.findMany({
    where: { date },
    orderBy: [
      { shift: "asc" },
      { courtNumber: "asc" },
    ],
  });

  const isConfigured = savedCourts.length > 0;
  const allocationMode = isConfigured ? (savedCourts[0].mode as "AUTO" | "MANUAL") : undefined;
  const updatedAt = isConfigured ? savedCourts[0].updatedAt.toISOString() : undefined;

  let courtsTiet4: DiningCourt[] = [];
  let courtsTiet5: DiningCourt[] = [];

  if (isConfigured) {
    const assignedClassIds = new Set<string>();

    for (const sc of savedCourts) {
      const courtShift = sc.shift as "TIET_4" | "TIET_5";
      const courtClassesInfo: DiningCourt["classes"] = [];
      const courtStudents: StudentMealInfo[] = [];
      let totalMeals = 0;
      let manCount = 0;
      let chayCount = 0;
      let chaoCount = 0;

      for (const cid of sc.classIds) {
        assignedClassIds.add(cid);
        const clsInfo = classMap.get(cid);
        if (clsInfo) {
          courtClassesInfo.push({
            classId: clsInfo.classId,
            className: clsInfo.className,
            totalMeals: clsInfo.totalMeals,
            manCount: clsInfo.manCount,
            chayCount: clsInfo.chayCount,
            chaoCount: clsInfo.chaoCount,
          });
          totalMeals += clsInfo.totalMeals;
          manCount += clsInfo.manCount;
          chayCount += clsInfo.chayCount;
          chaoCount += clsInfo.chaoCount;
          courtStudents.push(...clsInfo.students);
        } else {
          courtClassesInfo.push({
            classId: cid,
            className: cid,
            totalMeals: 0,
            manCount: 0,
            chayCount: 0,
            chaoCount: 0,
          });
        }
      }

      // Xử lý HS đặc biệt (lớp ảo) từ specialStudentIds
      if (sc.specialStudentIds && sc.specialStudentIds.length > 0) {
        // Tìm HS đặc biệt trong classMap (lớp ảo SPECIAL::)
        const specialStudentSet = new Set(sc.specialStudentIds);
        for (const [vId, vClass] of classMap) {
          if (!vId.startsWith("SPECIAL::")) continue;
          if (vClass.shift !== courtShift) continue;
          const matchedStudents = vClass.students.filter((s) => specialStudentSet.has(s.id));
          if (matchedStudents.length > 0) {
            assignedClassIds.add(vId);
            let vMan = 0, vChay = 0, vChao = 0;
            for (const s of matchedStudents) {
              if (s.mealType === "MAN") vMan++;
              else if (s.mealType === "CHAY") vChay++;
              else vChao++;
            }
            courtClassesInfo.push({
              classId: vId,
              className: vClass.className,
              totalMeals: matchedStudents.length,
              manCount: vMan,
              chayCount: vChay,
              chaoCount: vChao,
            });
            totalMeals += matchedStudents.length;
            manCount += vMan;
            chayCount += vChay;
            chaoCount += vChao;
            courtStudents.push(...matchedStudents);
          }
        }
      }

      // Sắp xếp các lớp trong sân theo thứ tự số tự nhiên
      courtClassesInfo.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));
      // Sắp xếp học sinh trong sân theo từng lớp, trong mỗi lớp theo tên A - Z
      courtStudents.sort((a, b) => {
        const cmpClass = a.className.localeCompare(b.className, "vi", { numeric: true });
        if (cmpClass !== 0) return cmpClass;
        return compareVietnameseNames(a.fullName, b.fullName);
      });

      const courtObj: DiningCourt = {
        courtNumber: sc.courtNumber,
        courtName: sc.courtName,
        cartNumber: sc.cartNumber || Math.ceil(sc.courtNumber / 2),
        cartName: sc.cartName || `Xe ${sc.cartNumber || Math.ceil(sc.courtNumber / 2)}`,
        shift: courtShift,
        classes: courtClassesInfo,
        totalMeals,
        manCount,
        chayCount,
        chaoCount,
        isSingleClass: courtClassesInfo.length === 1,
        isInIdealRange: totalMeals >= COURT_IDEAL_MIN && totalMeals <= COURT_IDEAL_MAX,
        isOverCapacity: totalMeals > COURT_MAX_CAPACITY,
        students: courtStudents,
      };

      if (courtShift === "TIET_4") {
        courtsTiet4.push(courtObj);
      } else {
        courtsTiet5.push(courtObj);
      }
    }

    // Kiểm tra xem có lớp nào trong ngày có suất ăn mà chưa được xếp vào sân không
    const unassignedT4 = classSummariesTiet4.filter((c) => c.totalMeals > 0 && !assignedClassIds.has(c.classId));
    const unassignedT5 = classSummariesTiet5.filter((c) => c.totalMeals > 0 && !assignedClassIds.has(c.classId));

    const totalCourts = courtsTiet4.length + courtsTiet5.length;
    const totalCarts = Math.ceil(totalCourts / 2);
    const totalClasses =
      courtsTiet4.reduce((sum, c) => sum + c.classes.length, 0) +
      courtsTiet5.reduce((sum, c) => sum + c.classes.length, 0);
    const totalMeals =
      courtsTiet4.reduce((sum, c) => sum + c.totalMeals, 0) +
      courtsTiet5.reduce((sum, c) => sum + c.totalMeals, 0);

    return {
      date: dateStr,
      dayOfWeekName,
      lockTime2,
      isAfterLockTime,
      isConfigured: true,
      allocationMode,
      updatedAt,
      totalCourts,
      totalCarts,
      totalClasses,
      totalMeals,
      unassignedClasses: {
        TIET_4: unassignedT4,
        TIET_5: unassignedT5,
      },
      availableClasses: {
        TIET_4: classSummariesTiet4,
        TIET_5: classSummariesTiet5,
      },
      shifts: {
        TIET_4: {
          totalCourts: courtsTiet4.length,
          totalClasses: courtsTiet4.reduce((sum, c) => sum + c.classes.length, 0),
          totalMeals: courtsTiet4.reduce((sum, c) => sum + c.totalMeals, 0),
          courts: courtsTiet4,
        },
        TIET_5: {
          totalCourts: courtsTiet5.length,
          totalClasses: courtsTiet5.reduce((sum, c) => sum + c.classes.length, 0),
          totalMeals: courtsTiet5.reduce((sum, c) => sum + c.totalMeals, 0),
          courts: courtsTiet5,
        },
      },
    };
  }

  // Trường hợp CHƯA CÓ CẤU HÌNH PHÂN SÂN TRONG CSDL:
  const totalClasses = classSummariesTiet4.length + classSummariesTiet5.length;
  const totalMeals =
    classSummariesTiet4.reduce((sum, c) => sum + c.totalMeals, 0) +
    classSummariesTiet5.reduce((sum, c) => sum + c.totalMeals, 0);

  return {
    date: dateStr,
    dayOfWeekName,
    lockTime2,
    isAfterLockTime,
    isConfigured: false,
    totalCourts: 0,
    totalCarts: 0,
    totalClasses,
    totalMeals,
    availableClasses: {
      TIET_4: classSummariesTiet4,
      TIET_5: classSummariesTiet5,
    },
    shifts: {
      TIET_4: {
        totalCourts: 0,
        totalClasses: classSummariesTiet4.length,
        totalMeals: classSummariesTiet4.reduce((sum, c) => sum + c.totalMeals, 0),
        courts: [],
      },
      TIET_5: {
        totalCourts: 0,
        totalClasses: classSummariesTiet5.length,
        totalMeals: classSummariesTiet5.reduce((sum, c) => sum + c.totalMeals, 0),
        courts: [],
      },
    },
  };
}

/**
 * TẠO PHÂN BỔ SÂN TỰ ĐỘNG VÀ LƯU VÀO DATABASE
 */
export async function saveAutoDiningCourtAllocation(dateStr: string): Promise<DiningAllocationResult> {
  const dayData = await getDayMealClasses(dateStr);
  const { date, classSummariesTiet4, classSummariesTiet5 } = dayData;

  const courtsTiet4 = pairClassesIntoCourts(classSummariesTiet4, "TIET_4", 1);
  const courtsTiet5 = pairClassesIntoCourts(classSummariesTiet5, "TIET_5", courtsTiet4.length + 1);

  await prisma.$transaction(async (tx) => {
    await tx.dailyDiningCourt.deleteMany({
      where: { date },
    });

    const toCreate = [...courtsTiet4, ...courtsTiet5].map((court) => {
      // Phân biệt lớp thường vs lớp ảo
      const regularClassIds = court.classes
        .filter((c) => !c.classId.startsWith("SPECIAL::"))
        .map((c) => c.classId);
      const specialClasses = court.classes
        .filter((c) => c.classId.startsWith("SPECIAL::"));
      // Lấy student IDs từ các lớp ảo
      const specialStudentIds = specialClasses.length > 0
        ? court.students
          .filter((s) => !regularClassIds.includes(s.className) && specialClasses.some(() => true))
          .filter((s) => {
            // Kiểm tra student thuộc lớp ảo (className của student là lớp gốc, không nằm trong regularClassIds)
            const studentClassId = court.classes.find(
              (c) => !c.classId.startsWith("SPECIAL::") && c.className === s.className
            );
            return !studentClassId; // Student không thuộc lớp thường nào trong sân
          })
          .map((s) => s.id)
        : [];

      return {
        date,
        shift: court.shift,
        courtNumber: court.courtNumber,
        courtName: court.courtName,
        cartNumber: court.cartNumber,
        cartName: court.cartName,
        classIds: regularClassIds,
        specialStudentIds,
        mode: "AUTO",
      };
    });

    if (toCreate.length > 0) {
      await tx.dailyDiningCourt.createMany({
        data: toCreate,
      });
    }
  });

  return await getDiningCourtAllocation(dateStr);
}

export interface ManualCourtInput {
  shift: "TIET_4" | "TIET_5";
  courtNumber?: number;
  courtName?: string;
  cartNumber?: number;
  cartName?: string;
  classIds: string[];
  note?: string;
}

/**
 * TẠO / CẬP NHẬT PHÂN BỔ SÂN THỦ CÔNG VÀ LƯU VÀO DATABASE
 */
export async function saveManualDiningCourtAllocation(
  dateStr: string,
  courtsData: ManualCourtInput[]
): Promise<DiningAllocationResult> {
  const dayData = await getDayMealClasses(dateStr);
  const { date } = dayData;

  // Validate: không để trùng lặp classId giữa các sân trong cùng một ca
  const seenClassesT4 = new Set<string>();
  const seenClassesT5 = new Set<string>();
  for (const c of courtsData) {
    const seen = c.shift === "TIET_4" ? seenClassesT4 : seenClassesT5;
    for (const cid of c.classIds) {
      if (seen.has(cid)) {
        throw new Error(`Lớp ${cid} bị phân bổ trùng lặp ở nhiều hơn 1 sân trong ca ${c.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}.`);
      }
      seen.add(cid);
    }
  }

  // Validate: không để trùng lặp số sân trên toàn trường (giữa các ca)
  const seenCourtNumbers = new Set<number>();
  for (const c of courtsData) {
    if (c.courtNumber && c.courtNumber > 0) {
      if (seenCourtNumbers.has(c.courtNumber)) {
        throw new Error(`Số Sân ${c.courtNumber} bị trùng lặp. Mỗi sân trong ngày phải có số thứ tự duy nhất.`);
      }
      seenCourtNumbers.add(c.courtNumber);
    }
  }

  // Sắp xếp các sân theo ca
  const tiet4Inputs = courtsData.filter((c) => c.shift === "TIET_4");
  const tiet5Inputs = courtsData.filter((c) => c.shift === "TIET_5");

  const normalizedCourts: Array<{
    date: Date;
    shift: string;
    courtNumber: number;
    courtName: string;
    cartNumber: number;
    cartName: string;
    classIds: string[];
    specialStudentIds: string[];
    mode: string;
    note: string | null;
  }> = [];

  // Bộ cấp phát số sân cho các sân chưa có courtNumber
  const usedCourtNumbers = new Set(seenCourtNumbers);
  let nextFallbackNumber = 1;
  const allocateCourtNumber = (c: ManualCourtInput) => {
    if (c.courtNumber && c.courtNumber > 0) {
      return c.courtNumber;
    }
    while (usedCourtNumbers.has(nextFallbackNumber)) {
      nextFallbackNumber++;
    }
    const allocated = nextFallbackNumber++;
    usedCourtNumbers.add(allocated);
    return allocated;
  };

  for (const c of tiet4Inputs) {
    const num = allocateCourtNumber(c);
    const cartNum = c.cartNumber && c.cartNumber > 0 ? c.cartNumber : Math.ceil(num / 2);
    const regularClassIds = c.classIds.filter((cid) => !cid.startsWith("SPECIAL::"));
    const specialClassIds = c.classIds.filter((cid) => cid.startsWith("SPECIAL::"));
    const specialStudentIds: string[] = [];
    for (const sid of specialClassIds) {
      const vClass = dayData.classMap.get(sid);
      if (vClass) {
        specialStudentIds.push(...vClass.students.map((s) => s.id));
      }
    }

    normalizedCourts.push({
      date,
      shift: "TIET_4",
      courtNumber: num,
      courtName: c.courtName || `Sân ${num}`,
      cartNumber: cartNum,
      cartName: c.cartName || `Xe ${cartNum}`,
      classIds: regularClassIds,
      specialStudentIds,
      mode: "MANUAL",
      note: c.note || null,
    });
  }

  for (const c of tiet5Inputs) {
    const num = allocateCourtNumber(c);
    const cartNum = c.cartNumber && c.cartNumber > 0 ? c.cartNumber : Math.ceil(num / 2);
    const regularClassIds = c.classIds.filter((cid) => !cid.startsWith("SPECIAL::"));
    const specialClassIds = c.classIds.filter((cid) => cid.startsWith("SPECIAL::"));
    const specialStudentIds: string[] = [];
    for (const sid of specialClassIds) {
      const vClass = dayData.classMap.get(sid);
      if (vClass) {
        specialStudentIds.push(...vClass.students.map((s) => s.id));
      }
    }

    normalizedCourts.push({
      date,
      shift: "TIET_5",
      courtNumber: num,
      courtName: c.courtName || `Sân ${num}`,
      cartNumber: cartNum,
      cartName: c.cartName || `Xe ${cartNum}`,
      classIds: regularClassIds,
      specialStudentIds,
      mode: "MANUAL",
      note: c.note || null,
    });
  }

  // Sắp xếp các sân trong từng ca theo courtNumber tăng dần
  normalizedCourts.sort((a, b) => {
    if (a.shift !== b.shift) {
      return a.shift === "TIET_4" ? -1 : 1;
    }
    return a.courtNumber - b.courtNumber;
  });

  await prisma.$transaction(async (tx) => {
    await tx.dailyDiningCourt.deleteMany({
      where: { date },
    });

    if (normalizedCourts.length > 0) {
      await tx.dailyDiningCourt.createMany({
        data: normalizedCourts,
      });
    }
  });

  return await getDiningCourtAllocation(dateStr);
}

/**
 * XÓA PHÂN BỔ SÂN CỦA 1 NGÀY
 */
export async function deleteDiningCourtAllocation(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  await prisma.dailyDiningCourt.deleteMany({
    where: { date },
  });

  return { success: true, message: "Đã xóa phân bổ sân cho ngày này" };
}

// ==================== BẢNG MA TRẬN THỐNG KÊ SÂN THEO TUẦN ====================

export interface WeeklyMatrixCell {
  courtName: string;
  courtNumber: number;
  cartName: string;
  shift: string;
}

export interface WeeklyMatrixRow {
  classId: string;
  className: string;
  totalStudents: number;
  courts: Record<string, WeeklyMatrixCell | null>; // dateStr -> cell
}

export interface WeeklyDiningMatrixResult {
  weekInfo: SchoolWeekInfo;
  distinctCourts: string[];
  days: Array<{ dateStr: string; dayOfWeek: number; dayLabel: string; shortDate: string }>;
  rows: WeeklyMatrixRow[];
  hasAnyAllocation: boolean;
  totalCourtsUsed: number;
}

/**
 * LẤY DỮ LIỆU MA TRẬN PHÂN BỔ SÂN THEO TUẦN (THỨ 2 -> THỨ 6)
 */
export async function getWeeklyDiningMatrix(referenceDate: Date | string): Promise<WeeklyDiningMatrixResult> {
  const weekInfo = getSchoolWeekInfo(referenceDate);
  const { startDate, endDate, days } = weekInfo;

  // 1. Lấy tất cả các lớp học
  const allClasses = await prisma.class.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: {
          students: {
            where: { boardingStatus: "ACTIVE" },
          },
        },
      },
    },
  });

  // Sắp xếp tự nhiên theo khối lớp (10A1 -> 12A13)
  allClasses.sort((a, b) => a.id.localeCompare(b.id, "vi", { numeric: true }));

  const [sy, sm, sd] = weekInfo.startDateStr.split("-").map(Number);
  const startUtc = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));

  const [ey, em, ed] = weekInfo.endDateStr.split("-").map(Number);
  const endUtc = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59));

  // 2. Lấy các bản ghi chia sân trong tuần
  const courts = await prisma.dailyDiningCourt.findMany({
    where: {
      date: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    orderBy: [{ date: "asc" }, { courtNumber: "asc" }],
  });

  // 3. Ánh xạ classId + dateStr -> court
  const cellMap = new Map<string, WeeklyMatrixCell>();
  const courtNamesSet = new Set<string>();

  for (const c of courts) {
    const cd = new Date(c.date);
    const dStr = `${cd.getUTCFullYear()}-${String(cd.getUTCMonth() + 1).padStart(2, "0")}-${String(cd.getUTCDate()).padStart(2, "0")}`;
    courtNamesSet.add(c.courtName);
    for (const cid of c.classIds) {
      cellMap.set(`${cid}_${dStr}`, {
        courtName: c.courtName,
        courtNumber: c.courtNumber,
        cartName: c.cartName,
        shift: c.shift,
      });
    }
  }

  // Sắp xếp danh sách sân tự nhiên (SÂN 1 -> SÂN 16)
  const distinctCourts = Array.from(courtNamesSet).sort((a, b) =>
    a.localeCompare(b, "vi", { numeric: true })
  );

  // 4. Lập các hàng ma trận cho từng lớp
  const rows: WeeklyMatrixRow[] = allClasses.map((cls) => {
    const classCourts: Record<string, WeeklyMatrixCell | null> = {};
    for (const day of days) {
      const cell = cellMap.get(`${cls.id}_${day.dateStr}`) || null;
      classCourts[day.dateStr] = cell;
    }
    return {
      classId: cls.id,
      className: cls.name || cls.id,
      totalStudents: cls._count.students,
      courts: classCourts,
    };
  });

  return {
    weekInfo,
    distinctCourts,
    days,
    rows,
    hasAnyAllocation: courts.length > 0,
    totalCourtsUsed: distinctCourts.length,
  };
}

/**
 * TỰ ĐỘNG PHÂN BỔ SÂN CHO CẢ TUẦN (THỨ 2 -> THỨ 6)
 */
export async function autoAllocateWeek(referenceDate: Date | string): Promise<WeeklyDiningMatrixResult> {
  const weekInfo = getSchoolWeekInfo(referenceDate);

  for (const day of weekInfo.days) {
    await saveAutoDiningCourtAllocation(day.dateStr);
  }

  return await getWeeklyDiningMatrix(referenceDate);
}

/**
 * SAO CHÉP PHÂN BỔ SÂN TỪ TUẦN NGUỒN SANG TUẦN ĐÍCH
 */
export async function copyDiningCourtWeek(
  sourceDate: Date | string,
  targetDate: Date | string
): Promise<WeeklyDiningMatrixResult> {
  const sourceWeek = getSchoolWeekInfo(sourceDate);
  const targetWeek = getSchoolWeekInfo(targetDate);

  for (let i = 0; i < 5; i++) {
    const srcDay = sourceWeek.days[i];
    const tgtDay = targetWeek.days[i];

    const [sy, sm, sd] = srcDay.dateStr.split("-").map(Number);
    const srcDateObj = new Date(Date.UTC(sy, sm - 1, sd));

    const [ty, tm, td] = tgtDay.dateStr.split("-").map(Number);
    const tgtDateObj = new Date(Date.UTC(ty, tm - 1, td));

    const sourceCourts = await prisma.dailyDiningCourt.findMany({
      where: { date: srcDateObj },
    });

    await prisma.$transaction(async (tx) => {
      await tx.dailyDiningCourt.deleteMany({
        where: { date: tgtDateObj },
      });

      if (sourceCourts.length > 0) {
        await tx.dailyDiningCourt.createMany({
          data: sourceCourts.map((c) => ({
            date: tgtDateObj,
            shift: c.shift,
            courtNumber: c.courtNumber,
            courtName: c.courtName,
            cartNumber: c.cartNumber,
            cartName: c.cartName,
            classIds: c.classIds,
            mode: "MANUAL",
            note: `Sao chép từ tuần ${sourceWeek.schoolWeekNumber}`,
          })),
        });
      }
    });
  }

  return await getWeeklyDiningMatrix(targetDate);
}

/**
 * ĐIỀU CHỈNH SÂN CỦA 1 LỚP TRONG 1 NGÀY CỤ THỂ
 */
export async function updateClassCourtCell(
  dateStr: string,
  classId: string,
  newCourtName: string | null
): Promise<void> {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));

  const existingCourts = await prisma.dailyDiningCourt.findMany({
    where: { date: dateObj },
  });

  if (existingCourts.length === 0) {
    throw new Error("Ngày này chưa được tạo phân bổ sân. Vui lòng tạo phân bổ trước khi chỉnh sửa.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Xóa classId khỏi bất kỳ sân nào trước đó
    for (const court of existingCourts) {
      if (court.classIds.includes(classId)) {
        const nextClasses = court.classIds.filter((id) => id !== classId);
        await tx.dailyDiningCourt.update({
          where: { id: court.id },
          data: { classIds: nextClasses },
        });
      }
    }

    // 2. Nếu gán vào sân mới (newCourtName != null)
    if (newCourtName) {
      const targetCourt = existingCourts.find((c) => c.courtName === newCourtName);
      if (targetCourt) {
        const updatedIds = Array.from(new Set([...targetCourt.classIds, classId]));
        await tx.dailyDiningCourt.update({
          where: { id: targetCourt.id },
          data: { classIds: updatedIds },
        });
      } else {
        // Tìm số thứ tự sân từ tên sân
        const numMatch = newCourtName.match(/\d+/);
        const courtNumber = numMatch ? parseInt(numMatch[0], 10) : existingCourts.length + 1;
        const cartNumber = Math.ceil(courtNumber / 2);
        await tx.dailyDiningCourt.create({
          data: {
            date: dateObj,
            shift: "TIET_4",
            courtNumber,
            courtName: newCourtName,
            cartNumber,
            cartName: `Xe ${cartNumber}`,
            classIds: [classId],
            mode: "MANUAL",
          },
        });
      }
    }
  });
}

/**
 * XÓA PHÂN BỔ SÂN CỦA CẢ TUẦN
 */
export async function deleteWeeklyDiningAllocation(referenceDate: Date | string): Promise<void> {
  const weekInfo = getSchoolWeekInfo(referenceDate);
  const [sy, sm, sd] = weekInfo.startDateStr.split("-").map(Number);
  const startUtc = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));

  const [ey, em, ed] = weekInfo.endDateStr.split("-").map(Number);
  const endUtc = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59));

  await prisma.dailyDiningCourt.deleteMany({
    where: {
      date: {
        gte: startUtc,
        lte: endUtc,
      },
    },
  });
}
