import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const DEFAULT_CATEGORIES = [
  { code: "MON_MAN", name: "Món mặn (chính)", icon: "🥩", sortOrder: 1 },
  { code: "MON_XAO", name: "Món xào (phụ)", icon: "🥦", sortOrder: 2 },
  { code: "MON_CANH", name: "Món canh", icon: "🥣", sortOrder: 3 },
  { code: "MON_COM", name: "Món cơm", icon: "🍚", sortOrder: 4 },
  { code: "TRANG_MIENG", name: "Tráng miệng", icon: "🍉", sortOrder: 5 },
  { code: "MON_NUOC", name: "Món nước", icon: "🍜", sortOrder: 6 },
  { code: "KHAC", name: "Món khác", icon: "🍱", sortOrder: 7 },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Auto-seed default categories if database is empty
    const count = await prisma.centralKitchenDishCategory.count();
    if (count === 0) {
      for (const item of DEFAULT_CATEGORIES) {
        await prisma.centralKitchenDishCategory.create({
          data: item,
        });
      }
    }

    const categories = await prisma.centralKitchenDishCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { dishes: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Lỗi lấy danh sách nhóm món:", error);
    return NextResponse.json({ error: "Không thể lấy danh sách nhóm món ăn" }, { status: 500 });
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
      return NextResponse.json({ error: "Không có quyền quản lý nhóm món" }, { status: 403 });
    }

    const body = await request.json();
    let { code, name, icon, sortOrder, isActive } = body;

    name = (name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên nhóm món" }, { status: 400 });
    }

    code = (code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");

    if (!code) {
      code = "NHOM_" + Date.now().toString().slice(-6);
    }

    // Kiểm tra trùng code
    const existing = await prisma.centralKitchenDishCategory.findUnique({
      where: { code },
    });
    if (existing) {
      return NextResponse.json({ error: `Mã nhóm "${code}" đã tồn tại. Vui lòng chọn mã khác.` }, { status: 400 });
    }

    const category = await prisma.centralKitchenDishCategory.create({
      data: {
        code,
        name,
        icon: icon || "🍱",
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Lỗi tạo nhóm món mới:", error);
    return NextResponse.json({ error: "Không thể tạo nhóm món mới" }, { status: 500 });
  }
}
