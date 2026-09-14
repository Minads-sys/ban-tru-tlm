import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    const classId = searchParams.get("classId") || "ALL";
    const preset = searchParams.get("preset") || "month"; // "today" | "week" | "month"

    // 1. Lấy danh sách lớp để render Dropdown bộ lọc
    const classes = await prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

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

    // Bộ lọc lớp học cho các bảng
    const classFilter = classId && classId !== "ALL" ? { classId } : {};
    const studentClassFilter = classId && classId !== "ALL" ? { student: { classId } } : {};

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
    const bills = await prisma.monthlyBill.findMany({
      where: {
        month,
        year,
        ...studentClassFilter,
      },
      include: {
        transactions: {
          where: { isVoided: false },
          select: { amount: true, paymentMethod: true },
        },
      },
    });

    let totalReceivable = 0;
    let totalCollected = 0;
    let bankTransferAmount = 0;
    let cashAmount = 0;
    let paidStudentsCount = 0;

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

      if (billPaid >= billFinal && billFinal > 0) {
        paidStudentsCount += 1;
      }
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
      financialOverview: {
        totalReceivable,
        totalCollected,
        remainingDebt: Math.max(0, totalReceivable - totalCollected),
        percentCollected,
        paidStudentsCount,
        totalStudentsCount: bills.length,
        bankTransferAmount,
        bankTransferPercent,
        cashAmount,
        cashPercent,
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
