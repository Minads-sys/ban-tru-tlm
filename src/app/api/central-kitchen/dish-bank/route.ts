import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

// Hàm sinh mã món tự động nếu user không nhập mã
async function generateAutoDishCode(): Promise<string> {
  // Lấy các món có mã theo định dạng MON_xxx
  const dishes = await prisma.centralKitchenDish.findMany({
    where: {
      code: { startsWith: "MON_" },
    },
    select: { code: true },
  });

  let maxNum = 0;
  for (const d of dishes) {
    const match = d.code.match(/^MON_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `MON_${nextNum.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const categoryId = searchParams.get("categoryId") || "";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const dishes = await prisma.centralKitchenDish.findMany({
      where,
      orderBy: [
        { category: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        category: {
          select: {
            id: true,
            code: true,
            name: true,
            icon: true,
            sortOrder: true,
          },
        },
      },
    });

    return NextResponse.json({ dishes });
  } catch (error) {
    console.error("Lỗi lấy danh sách ngân hàng món:", error);
    return NextResponse.json({ error: "Không thể lấy danh sách món ăn" }, { status: 500 });
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
      return NextResponse.json({ error: "Không có quyền thêm món vào ngân hàng món" }, { status: 403 });
    }

    const body = await request.json();
    let { code, name, categoryId, description, isActive } = body;

    name = (name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên món ăn" }, { status: 400 });
    }

    code = (code || "").trim();
    if (!code) {
      // Tự sinh mã MON_xxx
      code = await generateAutoDishCode();
    } else {
      code = code.toUpperCase().replace(/\s+/g, "_");
      // Kiểm tra trùng mã
      const existing = await prisma.centralKitchenDish.findUnique({
        where: { code },
      });
      if (existing) {
        return NextResponse.json({ error: `Mã món "${code}" đã tồn tại. Vui lòng chọn mã khác.` }, { status: 400 });
      }
    }

    const dish = await prisma.centralKitchenDish.create({
      data: {
        code,
        name,
        categoryId: categoryId || null,
        description: description ? description.trim() : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({ success: true, dish });
  } catch (error) {
    console.error("Lỗi thêm món ăn mới:", error);
    return NextResponse.json({ error: "Không thể thêm món ăn mới" }, { status: 500 });
  }
}
