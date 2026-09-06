import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await auth();

    // 1. Kiểm tra quyền Admin
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện chức năng này. Chỉ Quản trị viên (ADMIN) mới được phép." },
        { status: 403 }
      );
    }

    const { password, confirmText, deleteClasses } = await req.json();

    // 2. Kiểm tra từ khóa xác nhận
    if (!confirmText || confirmText.trim().toUpperCase() !== "RESET") {
      return NextResponse.json(
        { error: "Từ khóa xác nhận không chính xác. Vui lòng nhập đúng chữ RESET." },
        { status: 400 }
      );
    }

    // 3. Kiểm tra mật khẩu Admin
    if (!password) {
      return NextResponse.json(
        { error: "Vui lòng nhập mật khẩu tài khoản quản trị để xác nhận." },
        { status: 400 }
      );
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin tài khoản quản trị viên." },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại." },
        { status: 401 }
      );
    }

    // 4. Thực thi Reset Database theo thứ tự ràng buộc khóa ngoại
    await prisma.$transaction(async (tx) => {
      // Nhóm 1: Giao dịch & Thu tiền
      await tx.paymentTransaction.deleteMany();
      await tx.dailyCashClosing.deleteMany();
      await tx.monthlyBill.deleteMany();
      await tx.settlementRecord.deleteMany();

      // Nhóm 2: Suất ăn & Báo hủy
      await tx.mealCancellation.deleteMany();
      await tx.mealOverride.deleteMany();
      await tx.dailyMealSummary.deleteMany();

      // Nhóm 3: Thời khóa biểu
      await tx.classWeeklySchedule.deleteMany();

      // Nhóm 4: Học sinh
      await tx.student.deleteMany();

      // Nhóm 5: Tài khoản học sinh
      await tx.user.deleteMany({
        where: { role: "STUDENT" },
      });

      // Nhóm 6: Danh mục lớp học (nếu chọn)
      if (deleteClasses) {
        await tx.class.deleteMany();
      }
    });

    return NextResponse.json({
      success: true,
      message: "Đặt lại dữ liệu hệ thống thành công! Toàn bộ dữ liệu phát sinh đã được dọn sạch.",
      deletedClasses: !!deleteClasses,
    });
  } catch (error: any) {
    console.error("Lỗi khi reset database:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi trong quá trình đặt lại dữ liệu: " + (error?.message || "Lỗi máy chủ") },
      { status: 500 }
    );
  }
}
