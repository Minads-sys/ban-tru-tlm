import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const hasPhotoOnly = searchParams.get("hasPhoto") === "true";

    const where: any = {};

    if (month && year) {
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      where.date = { gte: firstDay, lte: lastDay };
    } else if (year) {
      const firstDay = new Date(Date.UTC(year, 0, 1));
      const lastDay = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      where.date = { gte: firstDay, lte: lastDay };
    }

    if (hasPhotoOnly) {
      where.photoUrls = { isEmpty: false };
    }

    const total = await prisma.dailyMealShowcase.count({ where });

    const showcases = await prisma.dailyMealShowcase.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json({
      showcases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử suất ăn:", error);
    return NextResponse.json({ error: "Không thể lấy lịch sử suất ăn" }, { status: 500 });
  }
}
