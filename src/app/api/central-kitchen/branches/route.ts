import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_BRANCHES = [
  { code: "GD", name: "GIA ĐỊNH", color: "#1d4ed8", sortOrder: 1 },
  { code: "HHT", name: "HOÀNG HOA THÁM", color: "#15803d", sortOrder: 2 },
  { code: "TD", name: "THANH ĐA", color: "#ea580c", sortOrder: 3 },
  { code: "TLM", name: "TENLOMAN", color: "#7e22ce", sortOrder: 4 },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Auto-seed if empty
    const count = await prisma.centralKitchenBranch.count();
    if (count === 0) {
      for (const b of DEFAULT_BRANCHES) {
        await prisma.centralKitchenBranch.create({
          data: {
            code: b.code,
            name: b.name,
            color: b.color,
            sortOrder: b.sortOrder,
            isActive: true,
          },
        });
      }
    }

    const branches = await prisma.centralKitchenBranch.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ branches });
  } catch (error: any) {
    console.error("Error fetching branches:", error);
    return NextResponse.json({ error: error.message || "Lỗi tải danh sách chi nhánh" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện" }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, color, address, sortOrder } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Mã và tên chi nhánh là bắt buộc" }, { status: 400 });
    }

    const branch = await prisma.centralKitchenBranch.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim().toUpperCase(),
        color: color?.trim() || "#2563eb",
        address: address?.trim() || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: true,
      },
    });

    return NextResponse.json({ branch });
  } catch (error: any) {
    console.error("Error creating branch:", error);
    return NextResponse.json({ error: error.message || "Lỗi thêm chi nhánh" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "KITCHEN_SECRETARY"].includes(session.user.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện" }, { status: 403 });
    }

    const body = await request.json();
    const { id, code, name, color, address, isActive, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID chi nhánh" }, { status: 400 });
    }

    const branch = await prisma.centralKitchenBranch.update({
      where: { id },
      data: {
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(name ? { name: name.trim().toUpperCase() } : {}),
        ...(color !== undefined ? { color: color.trim() } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      },
    });

    return NextResponse.json({ branch });
  } catch (error: any) {
    console.error("Error updating branch:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật chi nhánh" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Chỉ Quản trị viên mới được xóa chi nhánh" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID chi nhánh" }, { status: 400 });
    }

    // Soft delete
    await prisma.centralKitchenBranch.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting branch:", error);
    return NextResponse.json({ error: error.message || "Lỗi xóa chi nhánh" }, { status: 500 });
  }
}
