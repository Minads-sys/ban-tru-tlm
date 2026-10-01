import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

// Lấy ngày Thứ Hai của tuần chứa ngày truyền vào
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
}

function formatDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("startDate") || searchParams.get("date") || new Date().toISOString().split("T")[0];

    const [y, m, d] = dateParam.split("-").map(Number);
    const refDate = new Date(Date.UTC(y, m - 1, d));
    const monday = getMonday(refDate);

    // Chuẩn bị 5 ngày làm việc (Thứ 2 đến Thứ 6)
    const weekDays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const cur = new Date(monday);
      cur.setUTCDate(monday.getUTCDate() + i);
      weekDays.push(formatDateISO(cur));
    }

    const startUtc = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 4);
    const endUtc = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate(), 23, 59, 59, 999));

    // Lấy default provider
    const providerSetting = await prisma.systemSetting.findUnique({
      where: { key: "CATERING_PROVIDER_NAME" },
    });
    const defaultProvider = providerSetting?.value || "Bếp Trung Tâm TLM";

    // Lấy các showcase trong tuần
    const showcases = await prisma.dailyMealShowcase.findMany({
      where: {
        date: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            dish: {
              include: { category: true },
            },
          },
        },
      },
    });

    const showcaseMap: Record<string, any> = {};
    for (const s of showcases) {
      const key = formatDateISO(new Date(s.date));
      showcaseMap[key] = {
        ...s,
        providerName: s.providerName || defaultProvider,
      };
    }

    return NextResponse.json({
      startDate: weekDays[0],
      endDate: weekDays[4],
      weekDays,
      showcaseMap,
      defaultProviderName: defaultProvider,
    });
  } catch (error) {
    console.error("Lỗi lấy thực đơn cả tuần:", error);
    return NextResponse.json({ error: "Không thể lấy thực đơn tuần" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canManage = hasPermission(userPerms, "MANAGE_KITCHEN") || isAdmin;

    if (!canManage) {
      return NextResponse.json({ error: "Không có quyền quản lý thực đơn tuần" }, { status: 403 });
    }

    const body = await request.json();
    const days: Array<{
      date: string;
      items: Array<{
        dishId?: string;
        dishCode?: string;
        dishName: string;
        categoryName?: string;
        sortOrder?: number;
      }>;
      note?: string;
    }> = body.days || [];

    if (!Array.isArray(days) || days.length === 0) {
      return NextResponse.json({ error: "Danh sách ngày lưu thực đơn không hợp lệ" }, { status: 400 });
    }

    const providerSetting = await prisma.systemSetting.findUnique({
      where: { key: "CATERING_PROVIDER_NAME" },
    });
    const defaultProvider = providerSetting?.value || "Bếp Trung Tâm TLM";

    // Transaction lưu từng ngày
    await prisma.$transaction(async (tx) => {
      for (const day of days) {
        if (!day.date || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;

        const [y, m, d] = day.date.split("-").map(Number);
        const targetDate = new Date(Date.UTC(y, m - 1, d));

        // Lấy showcase hiện tại nếu có (để giữ nguyên photoUrls nếu đã chụp ảnh)
        const existing = await tx.dailyMealShowcase.findUnique({
          where: { date: targetDate },
        });

        const showcase = await tx.dailyMealShowcase.upsert({
          where: { date: targetDate },
          create: {
            date: targetDate,
            photoUrls: [],
            providerName: defaultProvider,
            note: day.note || null,
            isPublished: true,
            publishedAt: new Date(),
            createdById: session.user.id,
          },
          update: {
            note: day.note !== undefined ? day.note : existing?.note,
          },
        });

        // Xóa items cũ và tạo items mới
        await tx.dailyMealShowcaseItem.deleteMany({
          where: { showcaseId: showcase.id },
        });

        if (Array.isArray(day.items) && day.items.length > 0) {
          await tx.dailyMealShowcaseItem.createMany({
            data: day.items.map((item, idx) => ({
              showcaseId: showcase.id,
              dishId: item.dishId || null,
              dishCode: item.dishCode || `MON_${idx + 1}`,
              dishName: item.dishName.trim(),
              categoryName: item.categoryName ? item.categoryName.trim() : "Món khác",
              sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx + 1,
            })),
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "Đã lưu thực đơn cả tuần thành công!" });
  } catch (error) {
    console.error("Lỗi lưu thực đơn cả tuần:", error);
    return NextResponse.json({ error: "Không thể lưu thực đơn tuần", details: String(error) }, { status: 500 });
  }
}
