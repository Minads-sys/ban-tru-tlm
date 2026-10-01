import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const [y, m, d] = dateStr.split("-").map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    // Lấy thông tin công ty từ SystemSetting
    const providerSetting = await prisma.systemSetting.findUnique({
      where: { key: "CATERING_PROVIDER_NAME" },
    });
    const defaultProvider = providerSetting?.value || "Bếp Trung Tâm TLM";

    const showcase = await prisma.dailyMealShowcase.findUnique({
      where: { date: targetDate },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            dish: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      date: dateStr,
      showcase: showcase
        ? {
            ...showcase,
            providerName: showcase.providerName || defaultProvider,
          }
        : null,
      defaultProviderName: defaultProvider,
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu suất ăn ngày:", error);
    return NextResponse.json({ error: "Không thể lấy thông tin suất ăn" }, { status: 500 });
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
      return NextResponse.json({ error: "Không có quyền cập nhật suất ăn" }, { status: 403 });
    }

    const body = await request.json();
    const dateStr = body.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "Vui lòng chọn ngày hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    // Lấy default provider nếu không truyền
    let providerName = (body.providerName || "").trim();
    if (!providerName) {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "CATERING_PROVIDER_NAME" },
      });
      providerName = setting?.value || "Bếp Trung Tâm TLM";
    }

    const photoUrls: string[] = Array.isArray(body.photoUrls) ? body.photoUrls.slice(0, 3) : [];
    const note = body.note ? String(body.note).trim() : null;
    const isPublished = body.isPublished !== undefined ? Boolean(body.isPublished) : true;
    const itemsData: Array<{
      dishId?: string;
      dishCode?: string;
      dishName: string;
      categoryName?: string;
      sortOrder?: number;
    }> = Array.isArray(body.items) ? body.items : [];

    // Thực hiện transaction: Upsert showcase và đồng bộ items
    const result = await prisma.$transaction(async (tx) => {
      const showcase = await tx.dailyMealShowcase.upsert({
        where: { date: targetDate },
        create: {
          date: targetDate,
          photoUrls,
          providerName,
          note,
          isPublished,
          publishedAt: isPublished ? new Date() : null,
          createdById: session.user.id,
        },
        update: {
          photoUrls,
          providerName,
          note,
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        },
      });

      // Xóa các items cũ và tạo lại danh sách items mới
      await tx.dailyMealShowcaseItem.deleteMany({
        where: { showcaseId: showcase.id },
      });

      if (itemsData.length > 0) {
        await tx.dailyMealShowcaseItem.createMany({
          data: itemsData.map((item, index) => ({
            showcaseId: showcase.id,
            dishId: item.dishId || null,
            dishCode: item.dishCode || `MON_${index + 1}`,
            dishName: item.dishName.trim(),
            categoryName: item.categoryName ? item.categoryName.trim() : "Món khác",
            sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index + 1,
          })),
        });
      }

      return tx.dailyMealShowcase.findUnique({
        where: { id: showcase.id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { dish: true },
          },
        },
      });
    });

    return NextResponse.json({ success: true, showcase: result });
  } catch (error) {
    console.error("Lỗi lưu suất ăn ngày:", error);
    return NextResponse.json({ error: "Không thể lưu thông tin suất ăn", details: String(error) }, { status: 500 });
  }
}
