import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  if (!studentId) {
    return NextResponse.json({ error: "Thiếu studentId" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
  }

  const schedules = await prisma.classWeeklySchedule.findMany({
    where: {
      classId: student.classId,
      year: year,
    },
    select: {
      weekNumber: true,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
    },
  });

  // Convert schedules to a list of valid dates
  // (We could do it here or on frontend, let's just return the raw schedules)
  return NextResponse.json(schedules);
}
