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
      return NextResponse.json({ error: "Không có quyền quản lý nhóm món" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    let { name, icon, sortOrder, isActive } = body;

    name = (name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên nhóm món" }, { status: 400 });
    }

    const category = await prisma.centralKitchenDishCategory.update({
      where: { id },
      data: {
        name,
        icon: icon || "🍱",
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Lỗi cập nhật nhóm món:", error);
    return NextResponse.json({ error: "Không thể cập nhật nhóm món" }, { status: 500 });
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
      return NextResponse.json({ error: "Không có quyền xóa nhóm món" }, { status: 403 });
    }

    const { id } = await params;

    // Kiểm tra xem nhóm có món ăn nào đang tham chiếu không
    const dishCount = await prisma.centralKitchenDish.count({
      where: { categoryId: id },
    });

    if (dishCount > 0) {
      // Tách nhóm khỏi các món thay vì xóa cứng hoặc báo lỗi
      await prisma.centralKitchenDish.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
    }

    await prisma.centralKitchenDishCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã xóa nhóm món thành công" });
  } catch (error) {
    console.error("Lỗi xóa nhóm món:", error);
    return NextResponse.json({ error: "Không thể xóa nhóm món" }, { status: 500 });
  }
}
