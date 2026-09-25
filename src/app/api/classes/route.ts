// API Route: Danh sách lớp học
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime-hub";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";
import { compareClassNames } from "@/lib/utils";
import { getCachedClasses, setCachedClasses, invalidateClassesCache } from "@/lib/classes-cache";

import { isTestClassId } from "@/lib/test-classes";

export async function GET() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  let classes = getCachedClasses();
  if (!classes) {
    classes = await prisma.class.findMany({
      include: {
        teacher: {
          select: { fullName: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { id: "asc" },
    });

    classes.sort((a: any, b: any) => compareClassNames(a.id, b.id));
    setCachedClasses(classes);
  }

  // Lớp T01 (và các lớp test) chỉ hiển thị với tài khoản ADMIN toàn quyền
  const filteredClasses = isAdmin
    ? classes
    : classes.filter((c: any) => !isTestClassId(c.id) && !c.isTest);

  return NextResponse.json(filteredClasses, {
    headers: {
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role === "ACCOUNTANT") {
    return NextResponse.json({ error: "Tài khoản Kế toán chỉ có quyền xem danh sách lớp học" }, { status: 403 });
  }
  if (!session?.user || (!hasPermission(session.user.permissions || [], "MANAGE_STUDENTS") && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, name, teacherId } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc (Mã lớp, Tên lớp)" }, { status: 400 });
    }

    const existingClass = await prisma.class.findUnique({ where: { id } });
    if (existingClass) {
      return NextResponse.json({ error: "Mã lớp đã tồn tại" }, { status: 400 });
    }

    const newClass = await prisma.class.create({
      data: {
        id,
        name,
        teacherId: teacherId || null,
      },
    });

    broadcastChange('classes', 'INSERT', newClass);
    invalidateClassesCache();

    await logAudit({
      req,
      userId: session.user.id,
      userName: (session.user as any)?.name || (session.user as any)?.username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.CLASSES,
      description: `Tạo mới lớp học ${name} (Mã: ${id})`,
      targetId: id,
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error: any) {
    console.error("Error creating class:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
