import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { format } from "date-fns";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Thiếu thông tin người dùng" }, { status: 400 });
    }

    const studentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });

    if (!studentUser || !studentUser.student) {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }

    // Default password is DOB (ddmmyyyy)
    let newPasswordStr = "";
    if (studentUser.student.birthDate) {
      newPasswordStr = format(new Date(studentUser.student.birthDate), 'ddMMyyyy');
    } else {
      newPasswordStr = "123456"; // Fallback if no birthDate
    }

    const newHash = await bcrypt.hash(newPasswordStr, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        requiresPasswordChange: true,
      },
    });

    return NextResponse.json({ success: true, message: "Khôi phục mật khẩu thành công" });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return NextResponse.json({ error: "Đã có lỗi xảy ra" }, { status: 500 });
  }
}
