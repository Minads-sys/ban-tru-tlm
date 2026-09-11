import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseDateToUTC } from "@/lib/utils";

// GET: Lấy danh sách ngày nghỉ
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    const where: any = {};
    if (branchId) {
      where.OR = [{ branchId: null }, { branchId }];
    }

    const holidays = await prisma.centralKitchenHoliday.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { branchId: "asc" }],
    });

    const formatted = holidays.map((h) => {
      const d = new Date(h.date);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return {
        id: h.id,
        date: `${y}-${m}-${day}`,
        branchId: h.branchId,
        branchName: h.branch ? h.branch.name : "Tất cả chi nhánh",
        branchCode: h.branch ? h.branch.code : "ALL",
        branchColor: h.branch ? h.branch.color : "#64748b",
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ holidays: formatted });
  } catch (error: any) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi tải danh sách ngày nghỉ" },
      { status: 500 }
    );
  }
}

// POST: Tạo ngày nghỉ (hỗ trợ ngày đơn hoặc dải ngày, áp dụng cho tất cả hoặc từng chi nhánh)
export async function POST(request: Request) {
  try {
    const session = await auth();
    const isStaff =
      session?.user &&
      ["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "KITCHEN_SECRETARY"].includes(
        session.user.role
      );

    if (!isStaff) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      startDate,
      endDate,
      date,
      allBranches = true,
      branchIds = [],
      reason = "",
    } = body;

    const fromDateStr = startDate || date;
    const toDateStr = endDate || fromDateStr;

    if (!fromDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(fromDateStr)) {
      return NextResponse.json(
        { error: "Ngày bắt đầu không hợp lệ (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (!toDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(toDateStr)) {
      return NextResponse.json(
        { error: "Ngày kết thúc không hợp lệ (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Tạo danh sách các ngày trong khoảng từ fromDateStr đến toDateStr
    const datesList: string[] = [];
    const curr = new Date(fromDateStr + "T00:00:00Z");
    const end = new Date(toDateStr + "T00:00:00Z");

    while (curr <= end) {
      const y = curr.getUTCFullYear();
      const m = String(curr.getUTCMonth() + 1).padStart(2, "0");
      const d = String(curr.getUTCDate()).padStart(2, "0");
      datesList.push(`${y}-${m}-${d}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const branchesToApply: (string | null)[] = allBranches
      ? [null]
      : Array.isArray(branchIds) && branchIds.length > 0
      ? branchIds
      : [null];

    const recordsToUpsert = [];
    for (const dStr of datesList) {
      const dateObj = parseDateToUTC(dStr);
      for (const bId of branchesToApply) {
        recordsToUpsert.push({
          date: dateObj,
          branchId: bId,
          reason: reason.trim() || "Nghỉ theo lịch",
        });
      }
    }

    // Thực hiện lưu từng bản ghi
    for (const rec of recordsToUpsert) {
      if (rec.branchId === null) {
        const existing = await prisma.centralKitchenHoliday.findFirst({
          where: {
            date: rec.date,
            branchId: null,
          },
        });
        if (existing) {
          await prisma.centralKitchenHoliday.update({
            where: { id: existing.id },
            data: { reason: rec.reason },
          });
        } else {
          await prisma.centralKitchenHoliday.create({
            data: {
              date: rec.date,
              branchId: null,
              reason: rec.reason,
            },
          });
        }
      } else {
        await prisma.centralKitchenHoliday.upsert({
          where: {
            date_branchId: {
              date: rec.date,
              branchId: rec.branchId,
            },
          },
          update: { reason: rec.reason },
          create: {
            date: rec.date,
            branchId: rec.branchId,
            reason: rec.reason,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã lưu thành công ${recordsToUpsert.length} lượt lịch nghỉ`,
    });
  } catch (error: any) {
    console.error("Error creating holiday:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi tạo lịch nghỉ" },
      { status: 500 }
    );
  }
}

// DELETE: Xóa ngày nghỉ
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    const isStaff =
      session?.user &&
      ["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "KITCHEN_SECRETARY"].includes(
        session.user.role
      );

    if (!isStaff) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Thiếu ID lịch nghỉ cần xóa" },
        { status: 400 }
      );
    }

    await prisma.centralKitchenHoliday.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Đã xóa lịch nghỉ thành công",
    });
  } catch (error: any) {
    console.error("Error deleting holiday:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xóa lịch nghỉ" },
      { status: 500 }
    );
  }
}
