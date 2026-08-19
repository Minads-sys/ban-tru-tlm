import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user || (!hasPermission(session.user.permissions || [], "MANAGE_STUDENTS") && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const teachers = await prisma.user.findMany({
      where: {
        role: "TEACHER",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
      },
      orderBy: { fullName: "asc" }
    });

    return NextResponse.json(teachers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
