import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Chỉ ADMIN, BOARDING_MANAGER hoặc user có quyền MANAGE_SETTINGS được xem nhật ký
    const userRole = session.user.role;
    const userPermissions = (session.user as any).permissions || [];
    const canView =
      userRole === "ADMIN" ||
      userRole === "BOARDING_MANAGER" ||
      hasPermission(userPermissions, "MANAGE_SETTINGS");

    if (!canView) {
      return NextResponse.json(
        { error: "Bạn không có quyền xem nhật ký thao tác hệ thống." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const moduleFilter = searchParams.get("module");
    const actionFilter = searchParams.get("action");
    const search = searchParams.get("search")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (moduleFilter && moduleFilter !== "ALL") {
      where.module = moduleFilter;
    }

    if (actionFilter && actionFilter !== "ALL") {
      where.action = actionFilter;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
        { targetId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Query logs and total count concurrently
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // Thống kê nhanh số lượng thao tác hôm nay
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const totalToday = await prisma.auditLog.count({
      where: { createdAt: { gte: startOfToday } },
    });

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalToday,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách audit logs:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải nhật ký: " + (error?.message || "Lỗi máy chủ") },
      { status: 500 }
    );
  }
}
