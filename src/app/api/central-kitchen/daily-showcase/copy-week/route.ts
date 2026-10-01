import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

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
      return NextResponse.json({ error: "Không có quyền sao chép thực đơn" }, { status: 403 });
    }

    const body = await request.json();
    const { fromStartDate, toStartDate } = body;

    if (!fromStartDate || !toStartDate) {
      return NextResponse.json({ error: "Thiếu thông tin tuần nguồn hoặc tuần đích" }, { status: 400 });
    }

    const [fy, fm, fd] = fromStartDate.split("-").map(Number);
    const sourceMonday = new Date(Date.UTC(fy, fm - 1, fd));

    const [ty, tm, td] = toStartDate.split("-").map(Number);
    const targetMonday = new Date(Date.UTC(ty, tm - 1, td));

    const providerSetting = await prisma.systemSetting.findUnique({
      where: { key: "CATERING_PROVIDER_NAME" },
    });
    const defaultProvider = providerSetting?.value || "Bếp Trung Tâm TLM";

    // Sao chép 5 ngày (Thứ 2 đến Thứ 6)
    let copiedDaysCount = 0;

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const srcDate = new Date(sourceMonday);
        srcDate.setUTCDate(sourceMonday.getUTCDate() + i);

        const tgtDate = new Date(targetMonday);
        tgtDate.setUTCDate(targetMonday.getUTCDate() + i);

        // Lấy showcase nguồn
        const srcShowcase = await tx.dailyMealShowcase.findUnique({
          where: { date: srcDate },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (srcShowcase && srcShowcase.items.length > 0) {
          // Upsert showcase đích
          const tgtShowcase = await tx.dailyMealShowcase.upsert({
            where: { date: tgtDate },
            create: {
              date: tgtDate,
              photoUrls: [], // Ảnh để trống, tải lên sau
              providerName: defaultProvider,
              note: srcShowcase.note,
              isPublished: true,
              publishedAt: new Date(),
              createdById: session.user.id,
            },
            update: {
              note: srcShowcase.note,
            },
          });

          // Xóa và tạo mới items
          await tx.dailyMealShowcaseItem.deleteMany({
            where: { showcaseId: tgtShowcase.id },
          });

          await tx.dailyMealShowcaseItem.createMany({
            data: srcShowcase.items.map((it) => ({
              showcaseId: tgtShowcase.id,
              dishId: it.dishId,
              dishCode: it.dishCode,
              dishName: it.dishName,
              categoryName: it.categoryName,
              sortOrder: it.sortOrder,
            })),
          });

          copiedDaysCount++;
        }
      }
    });

    if (copiedDaysCount === 0) {
      return NextResponse.json({
        error: "Tuần nguồn chưa có thực đơn nào để sao chép.",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã sao chép thành công thực đơn của ${copiedDaysCount} ngày!`,
    });
  } catch (error) {
    console.error("Lỗi sao chép thực đơn:", error);
    return NextResponse.json({ error: "Không thể sao chép thực đơn tuần" }, { status: 500 });
  }
}
