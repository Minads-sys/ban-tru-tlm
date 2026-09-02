import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log("Bắt đầu quy trình đặt lại dữ liệu (Reset Database)...");

  try {
    // 1. Xóa các dữ liệu giao dịch và thanh toán
    console.log("- Đang xóa dữ liệu thanh toán...");
    await prisma.paymentTransaction.deleteMany();
    await prisma.monthlyBill.deleteMany();
    await prisma.settlementRecord.deleteMany();

    // 2. Xóa các dữ liệu suất ăn hàng ngày, báo cắt suất
    console.log("- Đang xóa dữ liệu suất ăn và báo hủy...");
    await prisma.mealCancellation.deleteMany();
    await prisma.mealOverride.deleteMany();
    await prisma.dailyMealSummary.deleteMany();

    // 3. Xóa thời khóa biểu bán trú
    console.log("- Đang xóa thời khóa biểu...");
    await prisma.classWeeklySchedule.deleteMany();

    // 4. Xóa học sinh
    console.log("- Đang xóa dữ liệu học sinh...");
    await prisma.student.deleteMany();

    // 5. Xóa lớp học
    console.log("- Đang xóa danh sách lớp học...");
    await prisma.class.deleteMany();

    // 6. Xóa User (Học sinh) - CHỈ GIỮ LẠI ADMIN và các Role nhân viên/giáo viên nếu cần
    console.log("- Đang xóa tài khoản học sinh...");
    await prisma.user.deleteMany({
      where: {
        role: "STUDENT"
      }
    });

    console.log("✅ Đặt lại dữ liệu thành công! Cơ sở dữ liệu đã sẵn sàng để import dữ liệu chính thức.");
  } catch (error) {
    console.error("❌ Đã xảy ra lỗi trong quá trình reset dữ liệu:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
