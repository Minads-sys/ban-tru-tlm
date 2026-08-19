// Seed data cho BAN-TRU-TLM
// Chạy: npx prisma db seed

import { PrismaClient, UserRole, MealType, BoardingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu mẫu...");

  // ==================== CÀI ĐẶT HỆ THỐNG ====================
  console.log("⚙️ Tạo cài đặt hệ thống...");
  const settings = [
    { key: "SCHOOL_NAME", value: "Trường Tiểu học TLM", description: "Tên trường" },
    { key: "SCHOOL_ADDRESS", value: "123 Đường Thăng Long Mới, Hà Nội", description: "Địa chỉ trường" },
    { key: "MEAL_UNIT_PRICE", value: "30000", description: "Đơn giá 1 suất ăn (VNĐ)" },
    { key: "CUTOFF_TIME", value: "16:30", description: "Giờ khóa sổ cắt suất (HH:mm)" },
    { key: "SCHOOL_YEAR", value: "2026-2027", description: "Năm học hiện tại" },
    { key: "BANK_NAME", value: "MBBank", description: "Tên ngân hàng" },
    { key: "BANK_ACCOUNT_NO", value: "9999888888", description: "Số tài khoản ngân hàng" },
    { key: "BANK_ACCOUNT_NAME", value: "TRUONG TH TLM", description: "Tên chủ tài khoản" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // ==================== TÀI KHOẢN ADMIN ====================
  console.log("👤 Tạo tài khoản Admin...");
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPassword,
      fullName: "Quản trị viên",
      role: UserRole.ADMIN,
    },
  });

  // ==================== LỚP HỌC ====================
  console.log("🏫 Tạo danh sách lớp...");
  const classes = [
    { id: "1A", name: "Lớp 1A" },
    { id: "1B", name: "Lớp 1B" },
    { id: "2A", name: "Lớp 2A" },
    { id: "2B", name: "Lớp 2B" },
    { id: "3A", name: "Lớp 3A" },
    { id: "3B", name: "Lớp 3B" },
    { id: "4A", name: "Lớp 4A" },
    { id: "4B", name: "Lớp 4B" },
    { id: "5A", name: "Lớp 5A" },
    { id: "5B", name: "Lớp 5B" },
  ];

  for (const c of classes) {
    await prisma.class.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  // ==================== GIÁO VIÊN CHỦ NHIỆM ====================
  console.log("👩‍🏫 Tạo tài khoản giáo viên...");
  const teacherNames = [
    "Nguyễn Thị Hoa", "Trần Văn Minh", "Lê Thị Lan",
    "Phạm Văn Hùng", "Hoàng Thị Mai", "Đặng Văn Tuấn",
    "Vũ Thị Ngọc", "Bùi Văn Đức", "Ngô Thị Hương", "Dương Văn Long",
  ];

  for (let i = 0; i < classes.length; i++) {
    const teacherPassword = await bcrypt.hash("teacher123", 10);
    const teacher = await prisma.user.upsert({
      where: { username: `gvcn_${classes[i].id.toLowerCase()}` },
      update: {},
      create: {
        username: `gvcn_${classes[i].id.toLowerCase()}`,
        passwordHash: teacherPassword,
        fullName: teacherNames[i],
        role: UserRole.TEACHER,
      },
    });
    await prisma.class.update({
      where: { id: classes[i].id },
      data: { teacherId: teacher.id },
    });
  }

  // ==================== HỌC SINH (50 mẫu) ====================
  console.log("🧒 Tạo danh sách học sinh mẫu (50 HS)...");
  const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Ngô", "Dương"];
  const middleNames = ["Văn", "Thị", "Minh", "Quốc", "Thanh"];
  const firstNames = ["An", "Bình", "Chi", "Dũng", "Em", "Giang", "Hà", "Khang", "Linh", "Mai",
    "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Tâm", "Uyên", "Vân", "Xuân", "Yến"];

  const mealTypes = [MealType.MAN, MealType.CHAY, MealType.CHAO];
  let studentCount = 0;
  const usedUsernames = new Set<string>();

  for (const cls of classes) {
    const studentsPerClass = 5; // 5 HS mỗi lớp = 50 tổng
    for (let j = 0; j < studentsPerClass; j++) {
      studentCount++;
      const studentId = `TH-TLM-${String(100000 + studentCount)}`;
      const lastName = lastNames[studentCount % lastNames.length];
      const middleName = middleNames[studentCount % middleNames.length];
      const firstName = firstNames[studentCount % firstNames.length];
      const fullName = `${lastName} ${middleName} ${firstName}`;

      // Tên đăng nhập: họ và tên viết thường không dấu (đảm bảo duy nhất)
      const baseUsername = `${lastName}${middleName}${firstName}`
        .toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
        .replace(/ì|í|ị|ỉ|ĩ/g, "i")
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "");

      let username = baseUsername;
      if (usedUsernames.has(username)) {
        username = `${baseUsername}${studentCount}`;
      }
      usedUsernames.add(username);

      // Ngày sinh mẫu: DD/MM/YYYY (VD: 15/08/2018)
      const day = String((studentCount % 28) + 1).padStart(2, "0");
      const month = String((studentCount % 12) + 1).padStart(2, "0");
      const year = 2018;
      const birthDateStr = `${day}${month}${year}`; // Mật khẩu ddmmyyyy (VD: 01012018)
      const birthDate = new Date(`${year}-${month}-${day}`);

      const password = await bcrypt.hash(birthDateStr, 10);

      const mealType = studentCount % 10 === 0 ? MealType.CHAY :
                       studentCount % 15 === 0 ? MealType.CHAO : MealType.MAN;

      // 90% HS đăng ký bán trú, 10% không
      const isBoarding = studentCount % 10 !== 0;

      const user = await prisma.user.upsert({
        where: { username },
        update: {},
        create: {
          username,
          passwordHash: password,
          fullName,
          role: UserRole.STUDENT,
        },
      });

      await prisma.student.upsert({
        where: { studentCode: studentId },
        update: {},
        create: {
          studentCode: studentId,
          userId: user.id,
          classId: cls.id,
          mealType,
          birthDate,
          boardingStatus: isBoarding ? BoardingStatus.ACTIVE : BoardingStatus.CANCELLED,
          boardingRegisteredAt: isBoarding ? new Date() : null,
          parentPhone: `09${String(studentCount).padStart(8, "0")}`,
        },
      });
    }
  }

  // ==================== THỜI KHÓA BIỂU MẪU ====================
  console.log("📅 Tạo thời khóa biểu mẫu...");

  // Tính tuần hiện tại
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );

  // Tính ngày đầu tuần (Thứ 2)
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  for (const cls of classes) {
    // Khối 1-2: Ăn T2-T6
    // Khối 3-5: Ăn T2, T3, T4, T5, T6
    await prisma.classWeeklySchedule.upsert({
      where: {
        classId_year_weekNumber: {
          classId: cls.id,
          year: now.getFullYear(),
          weekNumber,
        },
      },
      update: {},
      create: {
        classId: cls.id,
        year: now.getFullYear(),
        weekNumber,
        startDate: monday,
        monday: "TIET_5",
        tuesday: "TIET_5",
        wednesday: "TIET_5",
        thursday: "TIET_5",
        friday: "TIET_5",
        saturday: "NONE",
      },
    });
  }

  console.log("✅ Seed dữ liệu hoàn tất!");
  console.log(`   - ${settings.length} cài đặt hệ thống`);
  console.log(`   - 1 tài khoản Admin: username='admin', password='admin123'`);
  console.log(`   - ${classes.length} lớp học`);
  console.log(`   - ${classes.length} giáo viên chủ nhiệm: username='gvcn_1a', password='teacher123'`);
  console.log(`   - ${studentCount} học sinh đăng nhập tại /student-login:`);
  console.log(`       + Họ và Tên: 'Nguyễn Văn An' (Tên đăng nhập: nguyenvanan)`);
  console.log(`       + Mật khẩu: วัน sinh dạng ddmmyyyy (VD: '02022018')`);
  console.log(`       + Mã xác nhận: 6 số cuối Mã HS (VD: '100001')`);
  console.log(`   - ${classes.length} thời khóa biểu tuần ${weekNumber}`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
