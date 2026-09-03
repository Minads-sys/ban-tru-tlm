// API Route: Danh sách lớp học
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime-hub";

export async function GET() {
  const classes = await prisma.class.findMany({
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

  return NextResponse.json(classes);
}

export async function POST(req: Request) {
  const session = await auth();
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

    return NextResponse.json(newClass, { status: 201 });
  } catch (error: any) {
    console.error("Error creating class:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
