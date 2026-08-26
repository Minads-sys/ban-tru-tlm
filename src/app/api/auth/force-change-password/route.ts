import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Mật khẩu cũ không chính xác" }, { status: 400 });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsOld) {
      return NextResponse.json({ error: "Mật khẩu mới không được trùng với mật khẩu cũ" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        requiresPasswordChange: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Force password change error:", error);
    return NextResponse.json({ error: "Đã có lỗi xảy ra. Vui lòng thử lại sau." }, { status: 500 });
  }
}
