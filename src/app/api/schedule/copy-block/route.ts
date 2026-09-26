import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { broadcastChange } from "@/lib/realtime-hub";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

// GET: Kiểm tra trạng thái dữ liệu TKB của danh sách các tuần
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const checkWeeksRaw = searchParams.get("checkWeeks");

    if (!checkWeeksRaw) {
      return NextResponse.json({ counts: {} });
    }

    const weekNumbers = checkWeeksRaw
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 1 && n <= 53);

    if (weekNumbers.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    const schedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year,
        weekNumber: { in: weekNumbers },
      },
      select: { weekNumber: true },
    });

    const counts: Record<number, number> = {};
    for (const w of weekNumbers) {
      counts[w] = 0;
    }
    for (const s of schedules) {
      counts[s.weekNumber] = (counts[s.weekNumber] || 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error("Check weeks schedule error:", error);
    return NextResponse.json(
      { error: "Lỗi khi kiểm tra tuần", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Sao chép / Gia hạn Thời khóa biểu theo Block tuần (Hỗ trợ 1-N và Multi-Pair)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "ACCOUNTANT" || session.user.role === "CASHIER") {
      return NextResponse.json(
        { error: "Bạn không có quyền sao chép hoặc gia hạn thời khóa biểu" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      year = new Date().getFullYear(),
      sourceYear,
      sourceWeekNumber,
      targetWeeks,
      targetYear,
      overwrite = true,
      classIds,
      pairs, // Mảng cặp: Array<{ sourceWeek: number; targetWeek: number }>
    } = body;

    const baseYear = parseInt(sourceYear || year);
    const tYear = targetYear ? parseInt(targetYear) : baseYear;

    // Chuẩn hóa danh sách cặp sao chép { sourceWeek, targetWeek }
    const copyPairs: Array<{ sourceWeek: number; targetWeek: number }> = [];

    if (Array.isArray(pairs) && pairs.length > 0) {
      for (const p of pairs) {
        const sw = parseInt(p.sourceWeek);
        const tw = parseInt(p.targetWeek);
        if (sw && tw && sw >= 1 && sw <= 53 && tw >= 1 && tw <= 53) {
          if (sw !== tw) {
            copyPairs.push({ sourceWeek: sw, targetWeek: tw });
          }
        }
      }
    } else if (sourceWeekNumber && Array.isArray(targetWeeks) && targetWeeks.length > 0) {
      const sw = parseInt(sourceWeekNumber);
      for (const rawW of targetWeeks) {
        const tw = parseInt(rawW);
        if (sw && tw && sw >= 1 && sw <= 53 && tw >= 1 && tw <= 53) {
          if (sw !== tw) {
            copyPairs.push({ sourceWeek: sw, targetWeek: tw });
          }
        }
      }
    }

    if (copyPairs.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất một cặp tuần nguồn - tuần đích hợp lệ để sao chép" },
        { status: 400 }
      );
    }

    // 1. Tải trước dữ liệu TKB của tất cả các tuần nguồn cần thiết
    const uniqueSourceWeeks = Array.from(new Set(copyPairs.map((p) => p.sourceWeek)));
    const allSourceSchedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: baseYear,
        weekNumber: { in: uniqueSourceWeeks },
        ...(Array.isArray(classIds) && classIds.length > 0 ? { classId: { in: classIds } } : {}),
      },
    });

    const sourceMap = new Map<number, typeof allSourceSchedules>();
    for (const s of allSourceSchedules) {
      if (!sourceMap.has(s.weekNumber)) {
        sourceMap.set(s.weekNumber, []);
      }
      sourceMap.get(s.weekNumber)!.push(s);
    }

    // Kiểm tra xem có tuần nguồn nào bị thiếu dữ liệu không
    const emptySources = uniqueSourceWeeks.filter(
      (sw) => !sourceMap.has(sw) || sourceMap.get(sw)!.length === 0
    );
    if (emptySources.length === uniqueSourceWeeks.length) {
      return NextResponse.json(
        { error: `Tất cả các tuần nguồn (${emptySources.join(", ")}) đều chưa có dữ liệu TKB để sao chép.` },
        { status: 400 }
      );
    }

    let totalUpdated = 0;
    const executedTargetWeeks = new Set<number>();
    const pairResultsSummary: string[] = [];

    // 2. Thực hiện sao chép cho từng cặp
    for (const pair of copyPairs) {
      const { sourceWeek, targetWeek } = pair;
      const schedules = sourceMap.get(sourceWeek) || [];
      if (schedules.length === 0) continue;

      // Tính ngày Thứ 2 của tuần đích
      const jan1 = new Date(tYear, 0, 1);
      const daysToMonday = ((targetWeek - 1) * 7) + (1 - jan1.getDay());
      const startDate = new Date(tYear, 0, 1 + daysToMonday);

      // Nếu không ghi đè, lấy các lớp đã có TKB ở tuần đích
      let existingClassIds = new Set<string>();
      if (!overwrite) {
        const existing = await prisma.classWeeklySchedule.findMany({
          where: { year: tYear, weekNumber: targetWeek },
          select: { classId: true },
        });
        existingClassIds = new Set(existing.map((e) => e.classId));
      }

      let pairCount = 0;
      for (const schedule of schedules) {
        if (!overwrite && existingClassIds.has(schedule.classId)) {
          continue; // Bỏ qua nếu đã tồn tại và không ghi đè
        }

        await prisma.classWeeklySchedule.upsert({
          where: {
            classId_year_weekNumber: {
              classId: schedule.classId,
              year: tYear,
              weekNumber: targetWeek,
            },
          },
          update: {
            startDate,
            monday: schedule.monday,
            tuesday: schedule.tuesday,
            wednesday: schedule.wednesday,
            thursday: schedule.thursday,
            friday: schedule.friday,
            saturday: schedule.saturday,
            note: schedule.note,
          },
          create: {
            classId: schedule.classId,
            year: tYear,
            weekNumber: targetWeek,
            startDate,
            monday: schedule.monday,
            tuesday: schedule.tuesday,
            wednesday: schedule.wednesday,
            thursday: schedule.thursday,
            friday: schedule.friday,
            saturday: schedule.saturday,
            note: schedule.note,
          },
        });
        pairCount++;
        totalUpdated++;
      }

      executedTargetWeeks.add(targetWeek);
      pairResultsSummary.push(`Tuần ${sourceWeek} ➔ Tuần ${targetWeek} (${pairCount} lớp)`);
      broadcastChange("schedules", "UPDATE", { year: tYear, weekNumber: targetWeek });
    }

    const executedWeeksArr = Array.from(executedTargetWeeks).sort((a, b) => a - b);

    // Ghi Audit Log
    await logAudit({
      req: request,
      userId: session.user.id,
      userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.SCHEDULE,
      description: `Sao chép TKB thông minh: ${copyPairs.length} cặp, ${executedWeeksArr.length} tuần đích (${executedWeeksArr.join(", ")}): ${totalUpdated} lượt bản ghi lớp`,
      metadata: {
        year: baseYear,
        pairs: copyPairs,
        targetWeeks: executedWeeksArr,
        totalUpdated,
        overwrite,
        summary: pairResultsSummary,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã sao chép thành công ${copyPairs.length} cặp TKB sang ${executedWeeksArr.length} tuần đích (${totalUpdated} lượt lớp được cập nhật).`,
      count: totalUpdated,
      targetWeeks: executedWeeksArr,
      summary: pairResultsSummary,
    });
  } catch (error: any) {
    console.error("Copy block schedule error:", error);
    return NextResponse.json(
      { error: "Lỗi khi sao chép thời khóa biểu", details: error.message },
      { status: 500 }
    );
  }
}
