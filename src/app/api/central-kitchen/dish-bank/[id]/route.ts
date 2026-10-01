import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canManage = hasPermission(userPerms, "MANAGE_KITCHEN") || isAdmin;

    if (!canManage) {
      return NextResponse.json({ error: "Không có quyền sửa món ăn" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    let { code, name, categoryId, description, isActive } = body;

    name = (name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên món ăn" }, { status: 400 });
    }

    // Nếu đổi mã, kiểm tra trùng
    if (code) {
      code = code.trim().toUpperCase().replace(/\s+/g, "_");
      const existing = await prisma.centralKitchenDish.findFirst({
        where: { code, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: `Mã món "${code}" đã được sử dụng cho món khác` }, { status: 400 });
      }
    }

    const dish = await prisma.centralKitchenDish.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
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
    console.error("Lỗi cập nhật món ăn:", error);
    return NextResponse.json({ error: "Không thể cập nhật món ăn" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canManage = hasPermission(userPerms, "MANAGE_KITCHEN") || isAdmin;

    if (!canManage) {
      return NextResponse.json({ error: "Không có quyền xóa món ăn" }, { status: 403 });
    }

    const { id } = await params;

    // Kiểm tra xem món có nằm trong suất ăn nào không
    const showcaseCount = await prisma.dailyMealShowcaseItem.count({
      where: { dishId: id },
    });

    if (showcaseCount > 0) {
      // Nếu đã từng được dùng trong suất ăn, chuyển isActive = false thay vì xóa cứng để bảo tồn lịch sử
      await prisma.centralKitchenDish.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "Món ăn đã được dùng trong lịch sử suất ăn nên đã được chuyển sang trạng thái Tạm ẩn (Ngừng phục vụ).",
      });
    }

    await prisma.centralKitchenDish.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã xóa món ăn thành công" });
  } catch (error) {
    console.error("Lỗi xóa món ăn:", error);
    return NextResponse.json({ error: "Không thể xóa món ăn" }, { status: 500 });
  }
}
