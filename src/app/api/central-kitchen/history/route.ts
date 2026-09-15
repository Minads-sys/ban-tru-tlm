import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseDateToUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp startDate và endDate (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const startDate = parseDateToUTC(startDateStr);
    const endDate = parseDateToUTC(endDateStr);

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "startDate phải nhỏ hơn hoặc bằng endDate" },
        { status: 400 }
      );
    }

    // Fetch branches and ingredients
    const [branches, ingredients] = await Promise.all([
      prisma.centralKitchenBranch.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.centralKitchenIngredient.findMany({
        where: { isActive: true },
      }),
    ]);

    // Portion configurations
    const standardRice =
      ingredients.find(
        (i) =>
          i.category === "GAO" &&
          (i.code === "GAO_CHUAN" || i.name.toLowerCase().includes("cơm"))
      ) || ingredients.find((i) => i.category === "GAO");
    const ricePortionG = standardRice ? Number(standardRice.quantityPerServing) : 150;

    const chaoRice = ingredients.find(
      (i) =>
        i.category === "GAO" &&
        (i.code === "GAO_CHAO" || i.name.toLowerCase().includes("cháo"))
    );
    const chaoPortionG = chaoRice ? Number(chaoRice.quantityPerServing) : 50;

    const noodleMap = new Map(
      ingredients
        .filter((i) => i.category === "MON_NUOC")
        .map((i) => [i.id, Number(i.quantityPerServing)])
    );
    const fruitMap = new Map(
      ingredients
        .filter((i) => i.category === "TRAI_CAY")
        .map((i) => [i.id, Number(i.quantityPerServing)])
    );

    // Build entry query condition
    const whereCondition: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (branchId && branchId !== "all") {
      whereCondition.branchId = branchId;
    }

    const rawEntries = await prisma.centralKitchenDailyEntry.findMany({
      where: whereCondition,
      include: { branch: true },
      orderBy: [{ date: "desc" }, { branch: { sortOrder: "asc" } }],
    });

    // Also fetch holidays in this range
    const holidays = await prisma.centralKitchenHoliday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Process daily entry details
    let totalMan = 0;
    let totalChay = 0;
    let totalChao = 0;
    let totalServings = 0;
    let totalRiceKg = 0;
    let totalNoodleKg = 0;
    let totalFruitKg = 0;

    // Aggregates per branch
    const branchSummaryMap: Record<
      string,
      {
        branchId: string;
        branchCode: string;
        branchName: string;
        branchColor: string;
        daysCount: number;
        totalServings: number;
        servingsMan: number;
        servingsChay: number;
        servingsChao: number;
        riceKg: number;
        noodleKg: number;
        fruitKg: number;
      }
    > = {};

    branches.forEach((b) => {
      branchSummaryMap[b.id] = {
        branchId: b.id,
        branchCode: b.code,
        branchName: b.name,
        branchColor: b.color,
        daysCount: 0,
        totalServings: 0,
        servingsMan: 0,
        servingsChay: 0,
        servingsChao: 0,
        riceKg: 0,
        noodleKg: 0,
        fruitKg: 0,
      };
    });

    const entries = rawEntries.map((e) => {
      const dateStr = e.date.toISOString().split("T")[0];
      const isChayRice = e.isChayRice !== false;
      const manMealType = (e.manMealType || "COM") as "COM" | "NUOC";

      // Calculate materials for this single entry
      const mealRiceServings =
        (manMealType === "COM" ? e.servingsMan : 0) +
        (isChayRice ? e.servingsChay : 0);
      const mealRiceKg = (mealRiceServings * ricePortionG) / 1000;
      const chaoRiceKg = (e.servingsChao * chaoPortionG) / 1000;
      const entryRiceKg = mealRiceKg + chaoRiceKg;

      let entryNoodleKg = 0;
      let noodleServings = 0;
      if (manMealType === "NUOC") {
        noodleServings = e.servingsMan + (!isChayRice ? e.servingsChay : 0);
        const noodlePortion = (e.noodleId && noodleMap.get(e.noodleId)) || 200;
        entryNoodleKg = (noodleServings * noodlePortion) / 1000;
      }

      const fruitPortion = (e.fruitId && fruitMap.get(e.fruitId)) || 150;
      const entryFruitKg = (e.totalServings * fruitPortion) / 1000;

      // Update grand totals
      totalMan += e.servingsMan;
      totalChay += e.servingsChay;
      totalChao += e.servingsChao;
      totalServings += e.totalServings;
      totalRiceKg += entryRiceKg;
      totalNoodleKg += entryNoodleKg;
      totalFruitKg += entryFruitKg;

      // Update branch summary
      if (branchSummaryMap[e.branchId]) {
        const bs = branchSummaryMap[e.branchId];
        if (e.totalServings > 0) bs.daysCount += 1;
        bs.totalServings += e.totalServings;
        bs.servingsMan += e.servingsMan;
        bs.servingsChay += e.servingsChay;
        bs.servingsChao += e.servingsChao;
        bs.riceKg += entryRiceKg;
        bs.noodleKg += entryNoodleKg;
        bs.fruitKg += entryFruitKg;
      }

      const holiday = holidays.find(
        (h) =>
          h.date.toISOString().split("T")[0] === dateStr &&
          (h.branchId === null || h.branchId === e.branchId)
      );

      return {
        id: e.id,
        date: dateStr,
        branchId: e.branchId,
        branchCode: e.branch.code,
        branchName: e.branch.name,
        branchColor: e.branch.color,
        isHoliday: !!holiday,
        holidayReason: holiday?.reason || "",
        totalServings: e.totalServings,
        servingsMan: e.servingsMan,
        servingsChay: e.servingsChay,
        servingsChao: e.servingsChao,
        manMealType,
        isChayRice,
        noodleName: e.noodleName || (manMealType === "NUOC" ? "Bánh phở" : null),
        noodleServings,
        fruitName: e.fruitName || "Trái cây",
        lockStatus: e.lockStatus,
        marketTotalServings: e.marketTotalServings,
        difference: e.marketTotalServings
          ? e.totalServings - e.marketTotalServings
          : 0,
        marketLockedAt: e.marketLockedAt ? e.marketLockedAt.toISOString() : null,
        mealLockedAt: e.mealLockedAt ? e.mealLockedAt.toISOString() : null,
        note: e.note || "",
        materials: {
          riceKg: Number(entryRiceKg.toFixed(1)),
          noodleKg: Number(entryNoodleKg.toFixed(1)),
          fruitKg: Number(entryFruitKg.toFixed(1)),
        },
      };
    });

    const branchSummary = Object.values(branchSummaryMap)
      .filter((b) => (branchId && branchId !== "all" ? b.branchId === branchId : true))
      .map((b) => ({
        ...b,
        riceKg: Number(b.riceKg.toFixed(1)),
        noodleKg: Number(b.noodleKg.toFixed(1)),
        fruitKg: Number(b.fruitKg.toFixed(1)),
      }));

    return NextResponse.json({
      startDate: startDateStr,
      endDate: endDateStr,
      branches: branches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        color: b.color,
      })),
      entries,
      branchSummary,
      totalSummary: {
        totalDays: new Set(entries.map((e) => e.date)).size,
        totalEntries: entries.length,
        totalServings,
        totalMan,
        totalChay,
        totalChao,
        totalRiceKg: Number(totalRiceKg.toFixed(1)),
        totalNoodleKg: Number(totalNoodleKg.toFixed(1)),
        totalFruitKg: Number(totalFruitKg.toFixed(1)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching central kitchen history:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi tải lịch sử bếp trung tâm" },
      { status: 500 }
    );
  }
}
