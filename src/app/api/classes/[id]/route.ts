import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (!hasPermission(session.user.permissions || [], "MANAGE_STUDENTS") && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { name, teacherId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Tên lớp không được để trống" }, { status: 400 });
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name,
        teacherId: teacherId || null,
      },
    });

    return NextResponse.json(updatedClass);
  } catch (error: any) {
    console.error("Error updating class:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (!hasPermission(session.user.permissions || [], "MANAGE_STUDENTS") && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    
    // Check if class has students
    const classWithStudents = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (classWithStudents && classWithStudents._count.students > 0) {
      return NextResponse.json({ error: "Không thể xóa lớp đang có học sinh" }, { status: 400 });
    }

    // Delete schedules
    await prisma.classWeeklySchedule.deleteMany({
      where: { classId: id }
    });

    // Delete daily summaries
    await prisma.dailyMealSummary.deleteMany({
      where: { classId: id }
    });

    await prisma.class.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting class:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
