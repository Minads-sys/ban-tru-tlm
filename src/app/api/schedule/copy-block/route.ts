import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { broadcastChange } from "@/lib/realtime-hub";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

// POST: Sao chép / Gia hạn Thời khóa biểu theo Block tuần
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
      sourceYear,
      sourceWeekNumber,
      targetWeeks,
      targetYear,
      overwrite = true,
      classIds,
    } = body;

    const sYear = parseInt(sourceYear);
    const sWeek = parseInt(sourceWeekNumber);
    const tYear = targetYear ? parseInt(targetYear) : sYear;

    if (!sYear || !sWeek) {
      return NextResponse.json(
        { error: "Thiếu thông tin năm hoặc tuần nguồn" },
        { status: 400 }
      );
    }

    if (!Array.isArray(targetWeeks) || targetWeeks.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất một tuần đích để sao chép" },
        { status: 400 }
      );
    }

    // 1. Lấy dữ liệu TKB tuần nguồn
    const sourceSchedules = await prisma.classWeeklySchedule.findMany({
      where: {
        year: sYear,
        weekNumber: sWeek,
        ...(Array.isArray(classIds) && classIds.length > 0 ? { classId: { in: classIds } } : {}),
      },
    });

    if (sourceSchedules.length === 0) {
      return NextResponse.json(
        { error: `Tuần ${sWeek}/${sYear} chưa có dữ liệu thời khóa biểu nào để sao chép` },
        { status: 400 }
      );
    }

    let totalUpdated = 0;
    const copiedTargetWeeks: number[] = [];

    // 2. Tiến hành sao chép sang từng tuần đích
    for (const rawWeek of targetWeeks) {
      const tWeek = parseInt(rawWeek);
      if (!tWeek || isNaN(tWeek) || tWeek < 1 || tWeek > 53) continue;

      // Không copy chính nó sang chính nó nếu cùng năm
      if (sYear === tYear && sWeek === tWeek) continue;

      // Tính ngày đầu tuần (Thứ 2) của tuần đích
      const jan1 = new Date(tYear, 0, 1);
      const daysToMonday = ((tWeek - 1) * 7) + (1 - jan1.getDay());
      const startDate = new Date(tYear, 0, 1 + daysToMonday);

      // Nếu không ghi đè, lấy các lớp đã có TKB ở tuần đích để loại trừ
      let existingClassIds = new Set<string>();
      if (!overwrite) {
        const existing = await prisma.classWeeklySchedule.findMany({
          where: { year: tYear, weekNumber: tWeek },
          select: { classId: true },
        });
        existingClassIds = new Set(existing.map((e) => e.classId));
      }

      for (const schedule of sourceSchedules) {
        if (!overwrite && existingClassIds.has(schedule.classId)) {
          continue; // Bỏ qua nếu đã tồn tại và không ghi đè
        }

        await prisma.classWeeklySchedule.upsert({
          where: {
            classId_year_weekNumber: {
              classId: schedule.classId,
              year: tYear,
              weekNumber: tWeek,
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
            weekNumber: tWeek,
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
        totalUpdated++;
      }

      copiedTargetWeeks.push(tWeek);
      broadcastChange("schedules", "UPDATE", { year: tYear, weekNumber: tWeek });
    }

    await logAudit({
      req: request,
      userId: session.user.id,
      userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.SCHEDULE,
      description: `Sao chép TKB từ Tuần ${sWeek}/${sYear} sang ${copiedTargetWeeks.length} tuần đích (${copiedTargetWeeks.join(", ")}): ${totalUpdated} lượt bản ghi lớp`,
      metadata: {
        sourceYear: sYear,
        sourceWeek: sWeek,
        targetWeeks: copiedTargetWeeks,
        totalUpdated,
        overwrite,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã sao chép thành công TKB từ Tuần ${sWeek} sang ${copiedTargetWeeks.length} tuần (${totalUpdated} lượt lớp được cập nhật).`,
      count: totalUpdated,
      targetWeeks: copiedTargetWeeks,
    });
  } catch (error: any) {
    console.error("Copy block schedule error:", error);
    return NextResponse.json(
      { error: "Lỗi khi sao chép thời khóa biểu", details: error.message },
      { status: 500 }
    );
  }
}
