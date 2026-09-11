import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { KitchenLockStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseDateToUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const providedKey = searchParams.get("key") || request.headers.get("x-kitchen-key");

    // Lấy mã khóa màn hình bếp và các mốc giờ từ bảng cài đặt
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "KITCHEN_DISPLAY_PASSKEY",
            "KITCHEN_MARKET_LOCK_TIME",
            "KITCHEN_MEAL_LOCK_TIME",
            "KITCHEN_DAY_TRANSITION_TIME",
          ],
        },
      },
    });
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const currentPasskey = settingsMap["KITCHEN_DISPLAY_PASSKEY"] || "123456";
    const marketLockTime = settingsMap["KITCHEN_MARKET_LOCK_TIME"] || "20:00";
    const mealLockTime = settingsMap["KITCHEN_MEAL_LOCK_TIME"] || "08:00";
    const dayTransitionTime = settingsMap["KITCHEN_DAY_TRANSITION_TIME"] || "14:00";

    // Kiểm tra: nếu không phải nhân viên đăng nhập, bắt buộc phải có Passkey hợp lệ
    const isStaff =
      session?.user &&
      ["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "KITCHEN_SECRETARY"].includes(
        session.user.role
      );

    if (!isStaff) {
      if (!providedKey || providedKey.trim() !== currentPasskey.trim()) {
        return NextResponse.json(
          {
            error: "Mã khóa bảo vệ (Passkey) không chính xác hoặc đã hết hạn",
            requirePasskey: true,
          },
          { status: 401 }
        );
      }
    }

    let dateStr = searchParams.get("date");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const now = new Date();
      const [transH, transM] = (dayTransitionTime || "14:00").split(":").map(Number);
      const nowH = now.getHours();
      const nowM = now.getMinutes();
      const isPastTransition = nowH > transH || (nowH === transH && nowM >= transM);

      const candidate = new Date();
      if (isPastTransition) {
        candidate.setDate(candidate.getDate() + 1);
      }

      // Lấy danh sách ngày nghỉ từ candidate trở đi để dò ngày đi học gần nhất
      const candidateUTC = parseDateToUTC(
        `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`
      );
      const [activeBranchesCount, upcomingHolidays] = await Promise.all([
        prisma.centralKitchenBranch.count({ where: { isActive: true } }),
        prisma.centralKitchenHoliday.findMany({
          where: { date: { gte: candidateUTC } },
        }),
      ]);

      const holidaysMap = new Map<string, { all: boolean; branchIds: Set<string> }>();
      for (const h of upcomingHolidays) {
        const d = new Date(h.date);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        const k = `${y}-${m}-${day}`;
        if (!holidaysMap.has(k)) {
          holidaysMap.set(k, { all: false, branchIds: new Set() });
        }
        const item = holidaysMap.get(k)!;
        if (h.branchId === null) {
          item.all = true;
        } else {
          item.branchIds.add(h.branchId);
        }
      }

      // Tìm ngày gần nhất không phải cuối tuần và không phải tất cả chi nhánh đều nghỉ
      for (let i = 0; i < 30; i++) {
        const dayOfWeek = candidate.getDay();
        // 0: Chủ Nhật, 6: Thứ Bảy -> Bỏ qua
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          candidate.setDate(candidate.getDate() + 1);
          continue;
        }

        const y = candidate.getFullYear();
        const m = String(candidate.getMonth() + 1).padStart(2, "0");
        const d = String(candidate.getDate()).padStart(2, "0");
        const candidateStr = `${y}-${m}-${d}`;

        const holidayInfo = holidaysMap.get(candidateStr);
        const isAllHoliday =
          holidayInfo?.all ||
          (holidayInfo && holidayInfo.branchIds.size >= activeBranchesCount);

        if (!isAllHoliday) {
          dateStr = candidateStr;
          break;
        }

        candidate.setDate(candidate.getDate() + 1);
      }

      if (!dateStr) {
        const y = candidate.getFullYear();
        const m = String(candidate.getMonth() + 1).padStart(2, "0");
        const d = String(candidate.getDate()).padStart(2, "0");
        dateStr = `${y}-${m}-${d}`;
      }
    }

    const targetDate = parseDateToUTC(dateStr);

    // Fetch active branches, ingredients, entries, and holidays on targetDate
    const [branches, ingredients, entries, holidaysOnDate] = await Promise.all([
      prisma.centralKitchenBranch.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.centralKitchenIngredient.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.centralKitchenDailyEntry.findMany({
        where: { date: targetDate },
        include: { branch: true },
        orderBy: [{ branch: { sortOrder: "asc" } }],
      }),
      prisma.centralKitchenHoliday.findMany({
        where: { date: targetDate },
      }),
    ]);

    // Standard rice portion (default 150g)
    const standardRice = ingredients.find((i) => i.category === "GAO");
    const ricePortionG = standardRice ? Number(standardRice.quantityPerServing) : 150;

    // Build branch-entry map
    const entryMap = new Map<string, (typeof entries)[0]>();
    for (const entry of entries) {
      entryMap.set(entry.branchId, entry);
    }

    // Process entries per branch
    let grandTotalServings = 0;
    let grandTotalMan = 0;
    let grandTotalChao = 0;
    let grandTotalChay = 0;
    let grandTotalRiceKg = 0;

    const noodleTotals: Record<string, { noodleId?: string | null; noodleName: string; totalKg: number; servingsMan: number }> = {};
    const fruitTotals: Record<string, { fruitId?: string | null; fruitName: string; totalKg: number; totalServings: number }> = {};

    const branchCards = branches.map((branch) => {
      const entry = entryMap.get(branch.id);
      const branchHoliday = holidaysOnDate.find(
        (h) => h.branchId === null || h.branchId === branch.id
      );
      const isHoliday = !!branchHoliday;
      const holidayReason = branchHoliday?.reason || "";

      let servingsMan = isHoliday ? 0 : (entry?.servingsMan || 0);
      let servingsChao = isHoliday ? 0 : (entry?.servingsChao || 0);
      let servingsChay = isHoliday ? 0 : (entry?.servingsChay || 0);
      let totalServings = servingsMan + servingsChao + servingsChay;
      const manMealType = (entry?.manMealType || "COM") as "COM" | "NUOC";
      const lockStatus = isHoliday
        ? KitchenLockStatus.LOCKED_COOK
        : (entry?.lockStatus || KitchenLockStatus.UNLOCKED);

      // Noodle portion
      const selectedNoodle = entry?.noodleId ? ingredients.find((i) => i.id === entry.noodleId) : null;
      const noodlePortionG = selectedNoodle ? Number(selectedNoodle.quantityPerServing) : 200;
      const noodleName = entry?.noodleName || selectedNoodle?.name || "Món nước";

      // Fruit portion
      const selectedFruit = entry?.fruitId ? ingredients.find((i) => i.id === entry.fruitId) : null;
      const fruitPortionG = selectedFruit ? Number(selectedFruit.quantityPerServing) : 150;
      const fruitName = entry?.fruitName || selectedFruit?.name || "Trái cây";

      // Calculate materials for this branch
      let branchRiceKg = 0;
      let branchNoodleKg = 0;
      let branchFruitKg = 0;

      if (!isHoliday) {
        if (manMealType === "COM") {
          // Gạo = (Mặn + Chay) * định lượng gạo / 1000
          branchRiceKg = ((servingsMan + servingsChay) * ricePortionG) / 1000;
        } else {
          // Mặn Nước:
          // Gạo cấp cho Chay = Chay * định lượng gạo / 1000
          branchRiceKg = (servingsChay * ricePortionG) / 1000;
          // Bún / Phở = Mặn * định lượng món nước / 1000
          branchNoodleKg = (servingsMan * noodlePortionG) / 1000;
        }

        // Trái cây = Tổng suất * định lượng trái cây / 1000
        branchFruitKg = (totalServings * fruitPortionG) / 1000;

        // Aggregates
        grandTotalServings += totalServings;
        grandTotalMan += servingsMan;
        grandTotalChao += servingsChao;
        grandTotalChay += servingsChay;
        grandTotalRiceKg += branchRiceKg;

        if (manMealType === "NUOC" && servingsMan > 0) {
          if (!noodleTotals[noodleName]) {
            noodleTotals[noodleName] = {
              noodleId: entry?.noodleId,
              noodleName,
              totalKg: 0,
              servingsMan: 0,
            };
          }
          noodleTotals[noodleName].totalKg += branchNoodleKg;
          noodleTotals[noodleName].servingsMan += servingsMan;
        }

        if (totalServings > 0 && entry?.fruitId) {
          if (!fruitTotals[fruitName]) {
            fruitTotals[fruitName] = {
              fruitId: entry.fruitId,
              fruitName,
              totalKg: 0,
              totalServings: 0,
            };
          }
          fruitTotals[fruitName].totalKg += branchFruitKg;
          fruitTotals[fruitName].totalServings += totalServings;
        }
      }

      // Số đi chợ đã chốt hoặc fallback về số hiện tại nếu chưa chốt riêng
      const marketTotal = isHoliday ? 0 : (entry?.marketTotalServings ?? totalServings);
      const marketMan = isHoliday ? 0 : (entry?.marketServingsMan ?? servingsMan);
      const marketChao = isHoliday ? 0 : (entry?.marketServingsChao ?? servingsChao);
      const marketChay = isHoliday ? 0 : (entry?.marketServingsChay ?? servingsChay);
      const diffServings = totalServings - marketTotal;

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        branchColor: branch.color,
        sortOrder: branch.sortOrder,
        entryId: entry?.id || null,
        isHoliday,
        holidayReason,
        totalServings,
        servingsMan,
        servingsChao,
        servingsChay,
        manMealType,
        noodleId: entry?.noodleId || null,
        noodleName,
        noodlePortionG,
        fruitId: entry?.fruitId || null,
        fruitName,
        fruitPortionG,
        lockStatus,
        marketServings: {
          total: marketTotal,
          man: marketMan,
          chao: marketChao,
          chay: marketChay,
        },
        difference: diffServings,
        marketLockedAt: entry?.marketLockedAt ? entry.marketLockedAt.toISOString() : null,
        mealLockedAt: entry?.mealLockedAt ? entry.mealLockedAt.toISOString() : null,
        note: entry?.note || "",
        hasEntry: !!entry,
        materials: {
          riceKg: Number(branchRiceKg.toFixed(1)),
          noodleKg: Number(branchNoodleKg.toFixed(1)),
          fruitKg: Number(branchFruitKg.toFixed(1)),
        },
      };
    });

    // Check missing branches (active branches without entry or with 0 servings, excluding branches on holiday)
    const missingBranches = branchCards.filter(
      (b) => !b.isHoliday && (!b.hasEntry || b.totalServings === 0)
    );

    return NextResponse.json({
      date: dateStr,
      branches: branchCards,
      missingBranches: missingBranches.map((b) => ({
        id: b.branchId,
        code: b.branchCode,
        name: b.branchName,
        color: b.branchColor,
      })),
      ingredients: {
        ricePortionG,
        rice: standardRice,
        noodles: ingredients.filter((i) => i.category === "MON_NUOC"),
        fruits: ingredients.filter((i) => i.category === "TRAI_CAY"),
      },
      summary: {
        totalServings: grandTotalServings,
        totalMan: grandTotalMan,
        totalChao: grandTotalChao,
        totalChay: grandTotalChay,
        totalRiceKg: Number(grandTotalRiceKg.toFixed(1)),
        noodleTotals: Object.values(noodleTotals).map((n) => ({
          ...n,
          totalKg: Number(n.totalKg.toFixed(1)),
        })),
        fruitTotals: Object.values(fruitTotals).map((f) => ({
          ...f,
          totalKg: Number(f.totalKg.toFixed(1)),
        })),
      },
      passkey: isStaff ? currentPasskey : undefined,
      config: {
        marketLockTime,
        mealLockTime,
        dayTransitionTime,
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching daily entries:", error);
    return NextResponse.json({ error: error.message || "Lỗi tải dữ liệu báo cáo ngày" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const {
      date,
      branchId,
      servingsMan = 0,
      servingsChao = 0,
      servingsChay = 0,
      manMealType = "COM",
      noodleId,
      noodleName,
      fruitId,
      fruitName,
      note,
    } = body;

    if (!date || !branchId) {
      return NextResponse.json({ error: "Thiếu ngày hoặc chi nhánh" }, { status: 400 });
    }

    const targetDate = parseDateToUTC(date);
    const manNum = Math.max(0, parseInt(servingsMan, 10) || 0);
    const chaoNum = Math.max(0, parseInt(servingsChao, 10) || 0);
    const chayNum = Math.max(0, parseInt(servingsChay, 10) || 0);
    const totalServings = manNum + chaoNum + chayNum;

    // Check if existing record is locked
    const existing = await prisma.centralKitchenDailyEntry.findUnique({
      where: {
        date_branchId: {
          date: targetDate,
          branchId,
        },
      },
    });

    if (existing?.lockStatus === KitchenLockStatus.LOCKED_COOK && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Dữ liệu chi nhánh này đã chốt nấu (LOCKED_COOK). Chỉ Quản trị viên mới có thể sửa đổi." },
        { status: 400 }
      );
    }

    const entry = await prisma.centralKitchenDailyEntry.upsert({
      where: {
        date_branchId: {
          date: targetDate,
          branchId,
        },
      },
      create: {
        date: targetDate,
        branchId,
        totalServings,
        servingsMan: manNum,
        servingsChao: chaoNum,
        servingsChay: chayNum,
        manMealType: manMealType === "NUOC" ? "NUOC" : "COM",
        noodleId: manMealType === "NUOC" ? noodleId || null : null,
        noodleName: manMealType === "NUOC" ? noodleName || null : null,
        fruitId: fruitId || null,
        fruitName: fruitName || null,
        note: note || null,
        lockStatus: existing?.lockStatus || KitchenLockStatus.UNLOCKED,
      },
      update: {
        totalServings,
        servingsMan: manNum,
        servingsChao: chaoNum,
        servingsChay: chayNum,
        manMealType: manMealType === "NUOC" ? "NUOC" : "COM",
        noodleId: manMealType === "NUOC" ? noodleId || null : null,
        noodleName: manMealType === "NUOC" ? noodleName || null : null,
        fruitId: fruitId || null,
        fruitName: fruitName || null,
        note: note !== undefined ? note : existing?.note,
      },
      include: { branch: true },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error("Error saving daily entry:", error);
    return NextResponse.json({ error: error.message || "Lỗi lưu dữ liệu suất ăn" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền cập nhật trạng thái chốt" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      date,
      branchId,
      lockStatus,
      allBranches,
      servingsMan,
      servingsChao,
      servingsChay,
      manMealType,
      noodleId,
      noodleName,
      fruitId,
      fruitName,
      note,
    } = body;

    if (!lockStatus || !Object.values(KitchenLockStatus).includes(lockStatus)) {
      return NextResponse.json({ error: "Trạng thái chốt không hợp lệ" }, { status: 400 });
    }

    if (allBranches && date) {
      // Lock / unlock all entries for that date
      const targetDate = parseDateToUTC(date);
      const activeBranches = await prisma.centralKitchenBranch.findMany({
        where: { isActive: true },
      });

      for (const branch of activeBranches) {
        await prisma.centralKitchenDailyEntry.upsert({
          where: {
            date_branchId: {
              date: targetDate,
              branchId: branch.id,
            },
          },
          create: {
            date: targetDate,
            branchId: branch.id,
            lockStatus,
            totalServings: 0,
            servingsMan: 0,
            servingsChao: 0,
            servingsChay: 0,
            manMealType: "COM",
          },
          update: {
            lockStatus,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật trạng thái tất cả chi nhánh sang ${lockStatus}`,
      });
    }

    if (id) {
      const entry = await prisma.centralKitchenDailyEntry.update({
        where: { id },
        data: { lockStatus },
      });
      return NextResponse.json({ success: true, entry });
    }

    if (date && branchId) {
      const targetDate = parseDateToUTC(date);

      const manNum =
        servingsMan !== undefined ? Math.max(0, parseInt(servingsMan, 10) || 0) : undefined;
      const chaoNum =
        servingsChao !== undefined ? Math.max(0, parseInt(servingsChao, 10) || 0) : undefined;
      const chayNum =
        servingsChay !== undefined ? Math.max(0, parseInt(servingsChay, 10) || 0) : undefined;
      const totalNum =
        manNum !== undefined && chaoNum !== undefined && chayNum !== undefined
          ? manNum + chaoNum + chayNum
          : undefined;

      const isMarketLock = lockStatus === KitchenLockStatus.LOCKED_MARKET;
      const isCookLock = lockStatus === KitchenLockStatus.LOCKED_COOK;

      const marketSnapshotData = isMarketLock
        ? {
            marketTotalServings: totalNum || 0,
            marketServingsMan: manNum || 0,
            marketServingsChao: chaoNum || 0,
            marketServingsChay: chayNum || 0,
            marketLockedAt: new Date(),
          }
        : {};

      const cookSnapshotData = isCookLock
        ? {
            mealLockedAt: new Date(),
          }
        : {};

      const entry = await prisma.centralKitchenDailyEntry.upsert({
        where: {
          date_branchId: {
            date: targetDate,
            branchId,
          },
        },
        create: {
          date: targetDate,
          branchId,
          lockStatus,
          totalServings: totalNum || 0,
          servingsMan: manNum || 0,
          servingsChao: chaoNum || 0,
          servingsChay: chayNum || 0,
          manMealType: manMealType === "NUOC" ? "NUOC" : "COM",
          noodleId: manMealType === "NUOC" ? noodleId || null : null,
          noodleName: manMealType === "NUOC" ? noodleName || null : null,
          fruitId: fruitId || null,
          fruitName: fruitName || null,
          note: note || null,
          ...marketSnapshotData,
          ...cookSnapshotData,
        },
        update: {
          lockStatus,
          ...marketSnapshotData,
          ...cookSnapshotData,
          ...(totalNum !== undefined ? { totalServings: totalNum } : {}),
          ...(manNum !== undefined ? { servingsMan: manNum } : {}),
          ...(chaoNum !== undefined ? { servingsChao: chaoNum } : {}),
          ...(chayNum !== undefined ? { servingsChay: chayNum } : {}),
          ...(manMealType !== undefined
            ? { manMealType: manMealType === "NUOC" ? "NUOC" : "COM" }
            : {}),
          ...(noodleId !== undefined
            ? { noodleId: manMealType === "NUOC" ? noodleId || null : null }
            : {}),
          ...(noodleName !== undefined
            ? { noodleName: manMealType === "NUOC" ? noodleName || null : null }
            : {}),
          ...(fruitId !== undefined ? { fruitId: fruitId || null } : {}),
          ...(fruitName !== undefined ? { fruitName: fruitName || null } : {}),
          ...(note !== undefined ? { note: note || null } : {}),
        },
      });
      return NextResponse.json({ success: true, entry });
    }

    return NextResponse.json({ error: "Thiếu thông tin để cập nhật trạng thái" }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating lock status:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật trạng thái chốt" }, { status: 500 });
  }
}
