import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_INGREDIENTS = [
  // Gạo (chỉ 1 định lượng chuẩn 150g, không phân biệt loại gạo)
  { code: "GAO_CHUAN", name: "Gạo", category: "GAO", unit: "g", quantityPerServing: 150, sortOrder: 1 },
  
  // Món nước (bún, phở...)
  { code: "BANH_PHO", name: "Bánh phở", category: "MON_NUOC", unit: "g", quantityPerServing: 200, sortOrder: 1 },
  { code: "BUN_TO", name: "Bún to", category: "MON_NUOC", unit: "g", quantityPerServing: 200, sortOrder: 2 },
  { code: "BUN_NHO", name: "Bún nhỏ", category: "MON_NUOC", unit: "g", quantityPerServing: 180, sortOrder: 3 },
  { code: "HU_TIEU", name: "Hủ tiếu", category: "MON_NUOC", unit: "g", quantityPerServing: 180, sortOrder: 4 },
  { code: "MI_QUANG", name: "Mì Quảng", category: "MON_NUOC", unit: "g", quantityPerServing: 200, sortOrder: 5 },
  
  // Trái cây tráng miệng
  { code: "CHUOI", name: "Chuối sứ/tiêu", category: "TRAI_CAY", unit: "g", quantityPerServing: 120, sortOrder: 1 },
  { code: "DUA_HAU", name: "Dưa hấu", category: "TRAI_CAY", unit: "g", quantityPerServing: 200, sortOrder: 2 },
  { code: "THANH_LONG", name: "Thanh long", category: "TRAI_CAY", unit: "g", quantityPerServing: 150, sortOrder: 3 },
  { code: "OI", name: "Ổi", category: "TRAI_CAY", unit: "g", quantityPerServing: 150, sortOrder: 4 },
  { code: "CAM", name: "Cam sành/Mỹ", category: "TRAI_CAY", unit: "g", quantityPerServing: 180, sortOrder: 5 },
  { code: "TAO", name: "Táo", category: "TRAI_CAY", unit: "g", quantityPerServing: 150, sortOrder: 6 },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Auto-seed if empty
    const count = await prisma.centralKitchenIngredient.count();
    if (count === 0) {
      for (const item of DEFAULT_INGREDIENTS) {
        await prisma.centralKitchenIngredient.create({
          data: {
            code: item.code,
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantityPerServing: item.quantityPerServing,
            sortOrder: item.sortOrder,
            isActive: true,
          },
        });
      }
    }

    const whereClause: any = {};
    if (!includeInactive) whereClause.isActive = true;
    if (category) whereClause.category = category;

    const ingredients = await prisma.centralKitchenIngredient.findMany({
      where: whereClause,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ ingredients });
  } catch (error: any) {
    console.error("Error fetching ingredients:", error);
    return NextResponse.json({ error: error.message || "Lỗi tải danh mục nguyên liệu" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện" }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, category, unit, quantityPerServing, sortOrder } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "Tên và phân loại nguyên liệu là bắt buộc" }, { status: 400 });
    }

    const generatedCode = code?.trim().toUpperCase() || name.trim().toUpperCase().replace(/\s+/g, "_");

    const ingredient = await prisma.centralKitchenIngredient.create({
      data: {
        code: generatedCode,
        name: name.trim(),
        category: category.trim().toUpperCase(),
        unit: unit?.trim() || "g",
        quantityPerServing: Number(quantityPerServing) || 150,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: true,
      },
    });

    return NextResponse.json({ ingredient });
  } catch (error: any) {
    console.error("Error creating ingredient:", error);
    return NextResponse.json({ error: error.message || "Lỗi thêm nguyên liệu" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện" }, { status: 403 });
    }

    const body = await request.json();
    const { id, code, name, category, unit, quantityPerServing, isActive, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID nguyên liệu" }, { status: 400 });
    }

    const ingredient = await prisma.centralKitchenIngredient.update({
      where: { id },
      data: {
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(name ? { name: name.trim() } : {}),
        ...(category ? { category: category.trim().toUpperCase() } : {}),
        ...(unit !== undefined ? { unit: unit.trim() } : {}),
        ...(quantityPerServing !== undefined ? { quantityPerServing: Number(quantityPerServing) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      },
    });

    return NextResponse.json({ ingredient });
  } catch (error: any) {
    console.error("Error updating ingredient:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật nguyên liệu" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Chỉ Quản trị viên mới được xóa nguyên liệu" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID nguyên liệu" }, { status: 400 });
    }

    // Soft delete
    await prisma.centralKitchenIngredient.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting ingredient:", error);
    return NextResponse.json({ error: error.message || "Lỗi xóa nguyên liệu" }, { status: 500 });
  }
}
