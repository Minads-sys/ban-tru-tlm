import prisma from "@/lib/db";
import { BoardingStatus, CancellationStatus } from "@prisma/client";
import { getWeekNumber, getVietnamTodayUTC, isPastCutoffTime } from "@/lib/utils";

export interface StudentMealInfo {
  id: string;
  studentCode: string;
  fullName: string;
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
  isInIdealRange: boolean; // 40 - 55 suất
  students: StudentMealInfo[];
}

export interface DiningAllocationResult {
  date: string; // YYYY-MM-DD
  dayOfWeekName: string; // Thứ Hai, Thứ Ba...
  lockTime2: string;
  isAfterLockTime: boolean; // true: số liệu đã chốt, false: số liệu tạm
  totalCourts: number;
  totalClasses: number;
  totalMeals: number;
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

/**
 * Thuật toán ghép lớp vào sân theo tiêu chuẩn:
 * - Ưu tiên 2 lớp / sân sao cho tổng số suất dao động từ 40 - 55
 * - Nếu số lớp lẻ hoặc lớp không ghép được thỏa điều kiện thì xếp sân lẻ 1 lớp
 * - Tối đa 16 sân trong 1 tiết ăn
 */
export function pairClassesIntoCourts(
  classes: ClassMealSummary[],
  shift: "TIET_4" | "TIET_5"
): DiningCourt[] {
  // Chỉ tính các lớp có học sinh ăn (> 0 suất)
  const available = [...classes.filter((c) => c.totalMeals > 0)];

  // Sắp xếp các lớp theo tên lớp (khối lớp) để các lớp cùng khối ưu tiên gần nhau
  available.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));

  const courts: DiningCourt[] = [];
  const usedClassIds = new Set<string>();

  // 1. Kiểm tra các lớp bản thân đã có số suất lớn trong khoảng 40 - 55 hoặc > 50
  // (Nếu ghép thêm lớp khác sẽ chắc chắn vượt quá 55 suất)
  for (const c of available) {
    if (usedClassIds.has(c.classId)) continue;

    // Nếu lớp có >= 42 suất, thử xem có thể ghép với lớp siêu nhỏ (< 13 suất) không
    const canPairUnder55 = available.some(
      (other) => other.classId !== c.classId && !usedClassIds.has(other.classId) && c.totalMeals + other.totalMeals <= 55
    );

    if (!canPairUnder55 && c.totalMeals >= 38) {
      // Độc lập 1 sân
      usedClassIds.add(c.classId);
      courts.push({
        courtNumber: 0, // Đánh số sau
        courtName: "",
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
        isInIdealRange: c.totalMeals >= 40 && c.totalMeals <= 55,
        students: [...c.students],
      });
    }
  }

  // 2. Tìm cặp 2 lớp sao cho tổng suất nằm trong khoảng [40, 55]
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
      if (sum >= 40 && sum <= 55) {
        // Điểm số: ưu tiên tổng gần 48 nhất + cùng khối lớp
        const diffFromTarget = Math.abs(sum - 48);
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
        students: [...classA.students, ...classB.students],
      });
    }
  }

  // 3. Các lớp còn lại chưa ghép được vào khoảng [40, 55]:
  // Ghép các cặp còn lại với nhau (nếu còn >= 2 lớp)
  const remaining = available.filter((c) => !usedClassIds.has(c.classId));
  for (let i = 0; i < remaining.length; i += 2) {
    if (i + 1 < remaining.length) {
      const classA = remaining[i];
      const classB = remaining[i + 1];
      const totalMeals = classA.totalMeals + classB.totalMeals;
      const manCount = classA.manCount + classB.manCount;
      const chayCount = classA.chayCount + classB.chayCount;
      const chaoCount = classA.chaoCount + classB.chaoCount;

      courts.push({
        courtNumber: 0,
        courtName: "",
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
        isInIdealRange: totalMeals >= 40 && totalMeals <= 55,
        students: [...classA.students, ...classB.students],
      });
    } else {
      // Lớp lẻ cuối cùng ("sân lẻ thì lấy 1 lớp")
      const classSingle = remaining[i];
      courts.push({
        courtNumber: 0,
        courtName: "",
        shift,
        classes: [
          {
            classId: classSingle.classId,
            className: classSingle.className,
            totalMeals: classSingle.totalMeals,
            manCount: classSingle.manCount,
            chayCount: classSingle.chayCount,
            chaoCount: classSingle.chaoCount,
          },
        ],
        totalMeals: classSingle.totalMeals,
        manCount: classSingle.manCount,
        chayCount: classSingle.chayCount,
        chaoCount: classSingle.chaoCount,
        isSingleClass: true,
        isInIdealRange: classSingle.totalMeals >= 40 && classSingle.totalMeals <= 55,
        students: [...classSingle.students],
      });
    }
  }

  // 4. Giới hạn tối đa 16 sân trong 1 tiết ăn:
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

    const mergedCourt: DiningCourt = {
      courtNumber: 0,
      courtName: "",
      shift,
      classes: [...smallest1.classes, ...smallest2.classes],
      totalMeals: mergedTotalMeals,
      manCount: mergedMan,
      chayCount: mergedChay,
      chaoCount: mergedChao,
      isSingleClass: false,
      isInIdealRange: mergedTotalMeals >= 40 && mergedTotalMeals <= 55,
      students: [...smallest1.students, ...smallest2.students],
    };

    // Loại bỏ 2 sân nhỏ nhất và thay bằng sân gộp
    courts.splice(0, 2, mergedCourt);
  }

  // 5. Đánh số thứ tự sân: Sân 1, Sân 2, Sân 3...
  courts.forEach((court, idx) => {
    court.courtNumber = idx + 1;
    court.courtName = `Sân ${idx + 1}`;
    // Sắp xếp danh sách học sinh theo lớp rồi theo tên
    court.students.sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className, "vi");
      return a.fullName.localeCompare(b.fullName, "vi");
    });
  });

  return courts;
}

/**
 * Lấy toàn bộ phân bổ chia sân cho 1 ngày cụ thể
 */
export async function getDiningCourtAllocation(dateStr: string): Promise<DiningAllocationResult> {
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

  // Lấy cấu hình giờ chốt MEAL_LOCK_TIME_2
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["MEAL_LOCK_TIME_2", "CUTOFF_TIME"] } },
  });
  const lockTime2 =
    settings.find((s) => s.key === "MEAL_LOCK_TIME_2")?.value ||
    settings.find((s) => s.key === "CUTOFF_TIME")?.value ||
    "07:00";

  // Xác định trạng thái trước/sau giờ chốt
  const localToday = getVietnamTodayUTC();
  const isPastDate = date < localToday;
  const isToday = date.getTime() === localToday.getTime();
  const isAfterLockTime = isToday ? isPastCutoffTime(lockTime2) : isPastDate;

  if (!dayField) {
    // Chủ nhật không có lịch ăn
    return {
      date: dateStr,
      dayOfWeekName,
      lockTime2,
      isAfterLockTime,
      totalCourts: 0,
      totalClasses: 0,
      totalMeals: 0,
      shifts: {
        TIET_4: { totalCourts: 0, totalClasses: 0, totalMeals: 0, courts: [] },
        TIET_5: { totalCourts: 0, totalClasses: 0, totalMeals: 0, courts: [] },
      },
    };
  }

  const weekNumber = getWeekNumber(date);

  // Lấy thời khóa biểu các lớp có lịch ăn ngày này
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
            orderBy: {
              studentCode: "asc",
            },
          },
        },
      },
    },
  });

  // Lấy danh sách cắt suất đã duyệt của ngày này
  const approvedCancellations = await prisma.mealCancellation.findMany({
    where: {
      cancelDate: date,
      status: CancellationStatus.APPROVED,
    },
    select: { studentId: true },
  });
  const cancelledStudentIds = new Set(approvedCancellations.map((c) => c.studentId));

  // Lấy danh sách đổi món của ngày này
  const mealOverrides = await prisma.mealOverride.findMany({
    where: { date },
  });
  const overrideMap = new Map(mealOverrides.map((o) => [o.studentId, o.mealType]));

  // Phân bổ danh sách học sinh và số suất từng lớp
  const classSummariesTiet4: ClassMealSummary[] = [];
  const classSummariesTiet5: ClassMealSummary[] = [];

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

      return {
        id: s.id,
        studentCode: s.studentCode,
        fullName: s.user?.fullName || "Chưa có tên",
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

    if (shift === "TIET_4") {
      classSummariesTiet4.push(summaryItem);
    } else {
      classSummariesTiet5.push(summaryItem);
    }
  }

  // Chạy thuật toán chia sân cho từng tiết
  const courtsTiet4 = pairClassesIntoCourts(classSummariesTiet4, "TIET_4");
  const courtsTiet5 = pairClassesIntoCourts(classSummariesTiet5, "TIET_5");

  const totalCourts = courtsTiet4.length + courtsTiet5.length;
  const totalClasses = classSummariesTiet4.length + classSummariesTiet5.length;
  const totalMeals =
    courtsTiet4.reduce((sum, c) => sum + c.totalMeals, 0) +
    courtsTiet5.reduce((sum, c) => sum + c.totalMeals, 0);

  return {
    date: dateStr,
    dayOfWeekName,
    lockTime2,
    isAfterLockTime,
    totalCourts,
    totalClasses,
    totalMeals,
    shifts: {
      TIET_4: {
        totalCourts: courtsTiet4.length,
        totalClasses: classSummariesTiet4.length,
        totalMeals: courtsTiet4.reduce((sum, c) => sum + c.totalMeals, 0),
        courts: courtsTiet4,
      },
      TIET_5: {
        totalCourts: courtsTiet5.length,
        totalClasses: classSummariesTiet5.length,
        totalMeals: courtsTiet5.reduce((sum, c) => sum + c.totalMeals, 0),
        courts: courtsTiet5,
      },
    },
  };
}
