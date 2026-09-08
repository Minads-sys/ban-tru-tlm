import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

function getIsoWeekDates(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(Date.UTC(year, 0, 4 - jan4Day + 1));
  const start = new Date(mondayW1);
  start.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

// GET: Lấy danh sách lịch ăn đặc biệt
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const weekParam = searchParams.get("weekNumber");
    const scheduleName = searchParams.get("scheduleName");
    const allWeeks = searchParams.get("allWeeks") === "true";

    const where: any = {};

    if (scheduleName && scheduleName !== "ALL") {
      where.scheduleName = scheduleName;
    }

    if (!allWeeks && yearParam && weekParam) {
      const year = parseInt(yearParam, 10);
      const weekNumber = parseInt(weekParam, 10);
      if (!isNaN(year) && !isNaN(weekNumber)) {
        const { start, end } = getIsoWeekDates(year, weekNumber);
        where.date = {
          gte: start,
          lte: end,
        };
      }
    }

    const specialMeals = await prisma.studentSpecialMeal.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { scheduleName: "asc" },
        { student: { classId: "asc" } },
      ],
    });

    const items = specialMeals.map((sm) => {
      const d = new Date(sm.date);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const dow = d.getUTCDay();
      const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

      return {
        id: sm.id,
        studentId: sm.studentId,
        studentCode: sm.student?.studentCode || "—",
        boardingCode: sm.student?.boardingCode || "—",
        fullName: sm.student?.user?.fullName || "—",
        classId: sm.student?.classId || "—",
        className: sm.student?.class?.name || sm.student?.classId || "—",
        dateStr: `${yyyy}-${mm}-${dd}`,
        displayDate: `${dd}/${mm}/${yyyy}`,
        dayOfWeekName: dayNames[dow],
        shift: sm.shift,
        scheduleName: sm.scheduleName,
        source: sm.source,
        createdAt: sm.createdAt,
      };
    });

    // Thống kê các tên lịch duy nhất
    const allScheduleNames = await prisma.studentSpecialMeal.findMany({
      select: { scheduleName: true },
      distinct: ["scheduleName"],
    });

    return NextResponse.json({
      success: true,
      totalCount: items.length,
      scheduleNames: allScheduleNames.map((s) => s.scheduleName),
      items,
    });
  } catch (error: any) {
    console.error("Lỗi khi lấy lịch ăn đặc biệt:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách lịch ăn đặc biệt", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Xóa 1 suất hoặc xóa theo nhóm lịch
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "CASHIER" || session.user.role === "ACCOUNTANT") {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa lịch ăn đặc biệt" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const scheduleName = searchParams.get("scheduleName");
    const yearParam = searchParams.get("year");
    const weekParam = searchParams.get("weekNumber");

    if (id) {
      // Xóa 1 bản ghi cụ thể
      const existing = await prisma.studentSpecialMeal.findUnique({
        where: { id },
        include: {
          student: {
            include: { user: { select: { fullName: true } } },
          },
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
      }

      await prisma.studentSpecialMeal.delete({ where: { id } });

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.DELETE,
        module: AUDIT_MODULES.SCHEDULE,
        description: `Xóa suất ăn đặc biệt '${existing.scheduleName}' của HS ${existing.student?.user?.fullName} ngày ${existing.date.toISOString().split("T")[0]}`,
        metadata: { id, scheduleName: existing.scheduleName, studentId: existing.studentId },
      });

      return NextResponse.json({ success: true, message: "Đã xóa thành công suất ăn đặc biệt" });
    }

    if (scheduleName && yearParam && weekParam) {
      // Xóa toàn bộ lịch theo tên lịch và tuần
      const year = parseInt(yearParam, 10);
      const weekNumber = parseInt(weekParam, 10);
      const { start, end } = getIsoWeekDates(year, weekNumber);

      const deleteResult = await prisma.studentSpecialMeal.deleteMany({
        where: {
          scheduleName,
          date: { gte: start, lte: end },
        },
      });

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.DELETE,
        module: AUDIT_MODULES.SCHEDULE,
        description: `Xóa toàn bộ lịch đặc biệt '${scheduleName}' trong Tuần ${weekNumber}/${year}: ${deleteResult.count} suất`,
        metadata: { scheduleName, weekNumber, year, count: deleteResult.count },
      });

      return NextResponse.json({
        success: true,
        message: `Đã xóa thành công ${deleteResult.count} suất ăn của lịch '${scheduleName}' trong Tuần ${weekNumber}`,
        deletedCount: deleteResult.count,
      });
    }

    return NextResponse.json(
      { error: "Thiếu tham số id hoặc (scheduleName, year, weekNumber)" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Lỗi khi xóa lịch ăn đặc biệt:", error);
    return NextResponse.json(
      { error: "Không thể xóa lịch ăn đặc biệt", details: error.message },
      { status: 500 }
    );
  }
}
