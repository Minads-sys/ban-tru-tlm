import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isTestClassId, prismaExcludeTestClasses, prismaExcludeTestStudents } from "@/lib/test-classes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    const classId = searchParams.get("classId") || "ALL";
    const preset = searchParams.get("preset") || "month"; // "today" | "week" | "month"

    // 1. Lấy danh sách lớp để render Dropdown bộ lọc (loại trừ các lớp test như T01)
    const rawClasses = await prisma.class.findMany({
      where: {
        id: prismaExcludeTestClasses,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const classes = rawClasses.filter((c) => !isTestClassId(c.id));

    // 2. Xác định khoảng thời gian truy vấn
    let startDate: Date;
    let endDate: Date;

    if (preset === "today") {
      startDate = new Date(year, month - 1, now.getDate(), 0, 0, 0, 0);
      endDate = new Date(year, month - 1, now.getDate(), 23, 59, 59, 999);
    } else if (preset === "week") {
      // 7 ngày gần nhất hoặc tuần hiện tại
      const dayOfWeek = now.getDay(); // 0: CN, 1: T2...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      startDate = monday;
      endDate = sunday;
    } else {
      // Mặc định cả tháng
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }

    // Bộ lọc lớp học cho các bảng: Loại trừ toàn bộ các lớp test khỏi mọi tính toán báo cáo
    const classFilter = classId && classId !== "ALL"
      ? { classId }
      : { classId: prismaExcludeTestClasses };
    const studentClassFilter = classId && classId !== "ALL"
      ? { student: { classId } }
      : { student: prismaExcludeTestStudents };

    // =========================================================================
    // A. BIỂU ĐỒ 1: SUẤT ĂN & CẮT SUẤT THEO NGÀY (DAILY TREND)
    // =========================================================================
    const dailySummaries = await prisma.dailyMealSummary.findMany({
      where: {
        summaryDate: {
          gte: startDate,
          lte: endDate,
        },
        ...classFilter,
      },
      orderBy: { summaryDate: "asc" },
    });

    // Nhóm theo ngày YYYY-MM-DD
    const dailyMap = new Map<
      string,
      {
        dateStr: string;
        label: string;
        dayName: string;
        totalRegistered: number;
        totalCanceled: number;
        finalTotal: number;
        finalMan: number;
        finalChay: number;
        finalChao: number;
      }
    >();

    for (const item of dailySummaries) {
      const d = new Date(item.summaryDate);
      const dateKey = d.toISOString().split("T")[0];
      const dayOfWeek = d.getDay();
      const dayNames = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      const dayName = dayNames[dayOfWeek];
      const label = `${dayName} (${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")})`;

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          dateStr: dateKey,
          label,
          dayName,
          totalRegistered: 0,
          totalCanceled: 0,
          finalTotal: 0,
          finalMan: 0,
          finalChay: 0,
          finalChao: 0,
        });
      }

      const rec = dailyMap.get(dateKey)!;
      rec.totalRegistered += item.totalScheduleRegistered;
      rec.totalCanceled += item.totalCanceled;
      rec.finalMan += item.finalMan;
      rec.finalChay += item.finalChay;
      rec.finalChao += item.finalChao;
      rec.finalTotal += (item.finalMan + item.finalChay + item.finalChao);
    }

    const dailyTrend = Array.from(dailyMap.values()).map((rec) => {
      const cancelRate = rec.totalRegistered > 0
        ? Math.round((rec.totalCanceled / rec.totalRegistered) * 1000) / 10
        : 0;
      return {
        ...rec,
        cancelRate,
      };
    });

    // =========================================================================
    // B. BIỂU ĐỒ 2: BIẾN ĐỘNG SĨ SỐ THEO THÁNG (NET GROWTH - 6 THÁNG GẦN NHẤT)
    // =========================================================================
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(year, month - 1 - i, 1);
      const m = targetDate.getMonth() + 1;
      const y = targetDate.getFullYear();
      const mStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const mEnd = new Date(y, m, 0, 23, 59, 59, 999);

      const [newCount, cancelledCount] = await Promise.all([
        prisma.student.count({
          where: {
            boardingRegisteredAt: {
              gte: mStart,
              lte: mEnd,
            },
            ...classFilter,
          },
        }),
        prisma.student.count({
          where: {
            boardingCancelledAt: {
              gte: mStart,
              lte: mEnd,
            },
            ...classFilter,
          },
        }),
      ]);

      monthlyGrowth.push({
        monthKey: `${y}-${String(m).padStart(2, "0")}`,
        label: `Tháng ${m}/${y}`,
        month: m,
        year: y,
        newStudents: newCount,
        cancelledStudents: cancelledCount,
        netGrowth: newCount - cancelledCount,
      });
    }

    // =========================================================================
    // C. BIỂU ĐỒ 3: CƠ CẤU LOẠI SUẤT ĂN (DONUT CHART)
    // =========================================================================
    let totalMan = 0;
    let totalChay = 0;
    let totalChao = 0;

    if (dailyTrend.length > 0) {
      for (const d of dailyTrend) {
        totalMan += d.finalMan;
        totalChay += d.finalChay;
        totalChao += d.finalChao;
      }
    } else {
      // Nếu chưa có nhật ký ăn trong khoảng thời gian, thống kê theo sở thích của học sinh Active
      const activeStudents = await prisma.student.groupBy({
        by: ["mealType"],
        where: {
          boardingStatus: "ACTIVE",
          ...classFilter,
        },
        _count: { id: true },
      });
      for (const st of activeStudents) {
        if (st.mealType === "MAN") totalMan += st._count.id;
        else if (st.mealType === "CHAY") totalChay += st._count.id;
        else if (st.mealType === "CHAO") totalChao += st._count.id;
      }
    }

    const totalMealsAll = totalMan + totalChay + totalChao;
    const mealDistribution = [
      {
        name: "Suất Mặn",
        key: "MAN",
        count: totalMan,
        percentage: totalMealsAll > 0 ? Math.round((totalMan / totalMealsAll) * 1000) / 10 : 0,
        color: "#2563eb",
      },
      {
        name: "Suất Chay",
        key: "CHAY",
        count: totalChay,
        percentage: totalMealsAll > 0 ? Math.round((totalChay / totalMealsAll) * 1000) / 10 : 0,
        color: "#10b981",
      },
      {
        name: "Suất Cháo",
        key: "CHAO",
        count: totalChao,
        percentage: totalMealsAll > 0 ? Math.round((totalChao / totalMealsAll) * 1000) / 10 : 0,
        color: "#f59e0b",
      },
    ];

    // =========================================================================
    // D. BIỂU ĐỒ 4: TOP LÝ DO CẮT SUẤT PHỔ BIẾN (HORIZONTAL BAR)
    // =========================================================================
    const cancellations = await prisma.mealCancellation.findMany({
      where: {
        cancelDate: {
          gte: startDate,
          lte: endDate,
        },
        ...studentClassFilter,
      },
      select: { reason: true },
    });

    const reasonCountMap = new Map<string, number>();
    for (const c of cancellations) {
      let r = (c.reason || "Lý do khác").trim();
      // Chuẩn hóa một số cụm từ thông dụng nếu cần
      if (r.toLowerCase().includes("ốm") || r.toLowerCase().includes("bệnh") || r.toLowerCase().includes("sốt")) {
        r = "Nghỉ ốm / Khám bệnh";
      } else if (r.toLowerCase().includes("việc gia đình") || r.toLowerCase().includes("về quê") || r.toLowerCase().includes("bận việc")) {
        r = "Việc gia đình / Về quê";
      } else if (r.toLowerCase().includes("về nhà ăn") || r.toLowerCase().includes("ăn trưa ở nhà")) {
        r = "Về nhà ăn trưa";
      } else if (r.toLowerCase().includes("ngoại khóa") || r.toLowerCase().includes("thi") || r.toLowerCase().includes("hsg")) {
        r = "Thi cử / Ngoại khóa";
      }
      reasonCountMap.set(r, (reasonCountMap.get(r) || 0) + 1);
    }

    const totalCancellationsCount = cancellations.length;
    const sortedReasons = Array.from(reasonCountMap.entries())
      .sort((a, b) => b[1] - a[1]);

    // Lấy top 4, phần còn lại gom vào "Lý do khác"
    const topReasonsRaw = sortedReasons.slice(0, 4);
    const otherReasonsCount = sortedReasons.slice(4).reduce((sum, item) => sum + item[1], 0);

    const topCancellationReasons = topReasonsRaw.map(([reason, count]) => ({
      reason,
      count,
      percentage: totalCancellationsCount > 0 ? Math.round((count / totalCancellationsCount) * 100) : 0,
    }));

    if (otherReasonsCount > 0) {
      topCancellationReasons.push({
        reason: "Lý do khác",
        count: otherReasonsCount,
        percentage: totalCancellationsCount > 0 ? Math.round((otherReasonsCount / totalCancellationsCount) * 100) : 0,
      });
    }

    // =========================================================================
    // E. TIẾN ĐỘ THU TIỀN ĂN & KÊNH THANH TOÁN (BILLING PROGRESS)
    // =========================================================================
    // 1. Lấy đơn giá suất ăn từ cài đặt hệ thống (mặc định 45.000đ)
    const unitPriceSetting = await prisma.systemSetting.findUnique({
      where: { key: "MEAL_UNIT_PRICE" },
    });
    const defaultUnitPrice = unitPriceSetting ? parseFloat(unitPriceSetting.value) : 45000;

    const bills = await prisma.monthlyBill.findMany({
      where: {
        month,
        year,
        ...studentClassFilter,
      },
      include: {
        student: {
          select: {
            id: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
        transactions: {
          where: { isVoided: false },
          select: { amount: true, paymentMethod: true },
        },
      },
    });

    const mealUnitPrice = bills.length > 0 && bills[0].unitPrice ? Number(bills[0].unitPrice) : defaultUnitPrice;

    let totalReceivable = 0;
    let totalCollected = 0;
    let bankTransferAmount = 0;
    let cashAmount = 0;
    let paidStudentsCount = 0;
    let unpaidStudentsCount = 0;
    let totalRemainingDebt = 0;

    // Khởi tạo map thống kê công nợ theo từng lớp
    const classDebtMap = new Map<string, {
      classId: string;
      className: string;
      totalStudents: number;
      paidStudents: number;
      unpaidStudents: number;
      totalReceivable: number;
      totalCollected: number;
      remainingDebt: number;
      percentCollected: number;
    }>();

    for (const c of classes) {
      if (classId && classId !== "ALL" && c.id !== classId) continue;
      classDebtMap.set(c.id, {
        classId: c.id,
        className: c.name || c.id,
        totalStudents: 0,
        paidStudents: 0,
        unpaidStudents: 0,
        totalReceivable: 0,
        totalCollected: 0,
        remainingDebt: 0,
        percentCollected: 0,
      });
    }

    for (const b of bills) {
      const billFinal = Number(b.finalAmount);
      totalReceivable += billFinal;

      let billPaid = 0;
      for (const t of b.transactions) {
        const amt = Number(t.amount);
        billPaid += amt;
        totalCollected += amt;
        if (t.paymentMethod === "BANK_TRANSFER") {
          bankTransferAmount += amt;
        } else {
          cashAmount += amt;
        }
      }

      const debt = Math.max(0, billFinal - billPaid);
      totalRemainingDebt += debt;

      if (billPaid >= billFinal && billFinal > 0) {
        paidStudentsCount += 1;
      } else if (debt > 0) {
        unpaidStudentsCount += 1;
      }

      // Nhóm theo lớp
      const clsId = b.student?.classId || "OTHER";
      const clsName = b.student?.class?.name || b.student?.classId || "Khác";
      if (!classDebtMap.has(clsId)) {
        classDebtMap.set(clsId, {
          classId: clsId,
          className: clsName,
          totalStudents: 0,
          paidStudents: 0,
          unpaidStudents: 0,
          totalReceivable: 0,
          totalCollected: 0,
          remainingDebt: 0,
          percentCollected: 0,
        });
      }
      const cRec = classDebtMap.get(clsId)!;
      cRec.totalStudents += 1;
      cRec.totalReceivable += billFinal;
      cRec.totalCollected += billPaid;
      cRec.remainingDebt += debt;
      if (billPaid >= billFinal && billFinal > 0) {
        cRec.paidStudents += 1;
      } else if (debt > 0) {
        cRec.unpaidStudents += 1;
      }
    }

    const classDebtSummary = Array.from(classDebtMap.values())
      .map((c) => ({
        ...c,
        percentCollected: c.totalReceivable > 0
          ? Math.round((c.totalCollected / c.totalReceivable) * 1000) / 10
          : (c.totalStudents > 0 && c.remainingDebt === 0 ? 100 : 0),
      }))
      .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

    // Nếu chưa tạo hóa đơn (bills.length === 0), tạm tính dự kiến thu theo Thời khóa biểu của học sinh ACTIVE
    let isEstimatedFromSchedule = false;
    if (bills.length === 0) {
      const numDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const dayFieldMap: Record<number, "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"> = {
        1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday",
      };
      const getWkNumber = (d: Date, targetYear: number): number => {
        const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
        return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
      };

      const [schedules, activeStudents] = await Promise.all([
        prisma.classWeeklySchedule.findMany({ where: { year } }),
        prisma.student.findMany({
          where: { boardingStatus: "ACTIVE", ...classFilter },
          select: { id: true, classId: true, mealStartDate: true },
        }),
      ]);

      const schedMap = new Map<string, (typeof schedules)[0]>();
      schedules.forEach((s) => schedMap.set(`${s.classId}_${s.year}_${s.weekNumber}`, s));

      let totalPlannedDays = 0;
      for (const st of activeStudents) {
        for (let day = 1; day <= numDaysInMonth; day++) {
          const date = new Date(Date.UTC(year, month - 1, day));
          if (st.mealStartDate && date < new Date(st.mealStartDate)) continue;
          const dow = date.getUTCDay();
          if (dow === 0) continue;
          const df = dayFieldMap[dow];
          if (!df) continue;
          const wn = getWkNumber(date, year);
          const sch = schedMap.get(`${st.classId}_${year}_${wn}`);
          if (sch && sch[df] && sch[df] !== "NONE") {
            totalPlannedDays++;
          }
        }
      }

      if (totalPlannedDays > 0) {
        totalReceivable = totalPlannedDays * mealUnitPrice;
        isEstimatedFromSchedule = true;
      }
      totalRemainingDebt = Math.max(0, totalReceivable - totalCollected);
    }

    const percentCollected = totalReceivable > 0
      ? Math.round((totalCollected / totalReceivable) * 1000) / 10
      : 0;

    const totalPaymentTx = bankTransferAmount + cashAmount;
    const bankTransferPercent = totalPaymentTx > 0
      ? Math.round((bankTransferAmount / totalPaymentTx) * 100)
      : 0;
    const cashPercent = totalPaymentTx > 0 ? 100 - bankTransferPercent : 0;

    // =========================================================================
    // F. CÁC CHỈ SỐ KPI TỔNG HỢP (EXECUTIVE KPI CARDS)
    // =========================================================================
    const [currentNewStudents, currentCancelledStudents, totalActiveStudents] = await Promise.all([
      prisma.student.count({
        where: {
          boardingRegisteredAt: { gte: startDate, lte: endDate },
          ...classFilter,
        },
      }),
      prisma.student.count({
        where: {
          boardingCancelledAt: { gte: startDate, lte: endDate },
          ...classFilter,
        },
      }),
      prisma.student.count({
        where: {
          boardingStatus: "ACTIVE",
          ...classFilter,
        },
      }),
    ]);

    const totalMealsCount = dailyTrend.reduce((sum, d) => sum + d.finalTotal, 0);
    const totalServedMealsAmount = totalMealsCount * mealUnitPrice;
    const totalScheduleRegisteredCount = dailyTrend.reduce((sum, d) => sum + d.totalRegistered, 0);
    const overallCancellationRate = totalScheduleRegisteredCount > 0
      ? Math.round((totalCancellationsCount / totalScheduleRegisteredCount) * 1000) / 10
      : 0;

    return NextResponse.json({
      success: true,
      meta: {
        month,
        year,
        classId,
        preset,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      classes,
      kpis: {
        totalMeals: totalMealsCount,
        cancellationRate: overallCancellationRate,
        totalCancellations: totalCancellationsCount,
        newStudents: currentNewStudents,
        cancelledStudents: currentCancelledStudents,
        netGrowth: currentNewStudents - currentCancelledStudents,
        totalActiveStudents,
      },
      dailyTrend,
      monthlyGrowth,
      mealDistribution,
      topCancellationReasons,
      classDebtSummary,
      financialOverview: {
        totalReceivable, // 1. Tổng tiền dự kiến thu
        totalServedMealsAmount, // 2. Tổng tiền số suất ăn đã phục vụ
        totalCollected, // 3. Tổng tiền học sinh đã thanh toán
        remainingDebt: totalRemainingDebt, // 4. Tổng tiền dự kiến còn phải thu
        unitPrice: mealUnitPrice,
        totalMealsServed: totalMealsCount,
        percentCollected,
        paidStudentsCount,
        unpaidStudentsCount,
        totalStudentsCount: bills.length || (isEstimatedFromSchedule ? totalActiveStudents : 0),
        bankTransferAmount,
        bankTransferPercent,
        cashAmount,
        cashPercent,
        isEstimatedFromSchedule,
      },
    });
  } catch (error) {
    console.error("Error generating statistics report:", error);
    return NextResponse.json(
      { error: "Lỗi khi tổng hợp dữ liệu báo cáo thống kê", details: String(error) },
      { status: 500 }
    );
  }
}
