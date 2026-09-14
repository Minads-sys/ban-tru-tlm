// Script: scripts/normalize_cccd.js
// Quét và chuẩn hóa mã học sinh (studentCode) và username của bảng User về chuẩn 12 chữ số

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== BẮT ĐẦU QUÉT VÀ CHUẨN HÓA CCCD (Chế độ: ${isDryRun ? 'DRY-RUN (Chỉ kiểm tra)' : 'THỰC THI (Cập nhật CSDL)'}) ===\n`);

  const students = await prisma.student.findMany({
    include: {
      user: true,
    },
  });

  console.log(`Tổng số học sinh trong CSDL: ${students.length}`);

  let needNormalizeCount = 0;
  let updatedCount = 0;
  const duplicateWarnings = [];

  for (const student of students) {
    const code = student.studentCode || '';
    // Nếu mã gồm 1 đến 11 chữ số (toàn là chữ số)
    if (/^\d{1,11}$/.test(code)) {
      needNormalizeCount++;
      const normalizedCode = code.padStart(12, '0');
      console.log(`[CẦN CHUẨN HÓA] ID: ${student.id} | Tên: ${student.user?.fullName} | CCCD cũ: ${code} -> CCCD mới: ${normalizedCode}`);

      // Kiểm tra xem đã tồn tại học sinh nào khác có mã 12 số này chưa
      const existingConflict = students.find(s => s.id !== student.id && s.studentCode === normalizedCode);
      if (existingConflict) {
        duplicateWarnings.push({
          normalizedCode,
          student1: { id: student.id, name: student.user?.fullName, code },
          student2: { id: existingConflict.id, name: existingConflict.user?.fullName, code: existingConflict.studentCode },
        });
        console.warn(`⚠️ CẢNH BÁO TRÙNG LẶP: Đã có học sinh ${existingConflict.user?.fullName} (${existingConflict.id}) mang mã ${normalizedCode}`);
        continue;
      }

      if (!isDryRun) {
        // Cập nhật studentCode
        await prisma.student.update({
          where: { id: student.id },
          data: { studentCode: normalizedCode },
        });

        // Nếu username của user trùng với mã cũ, cập nhật luôn username
        if (student.user && student.user.username === code.toLowerCase()) {
          await prisma.user.update({
            where: { id: student.userId },
            data: { username: normalizedCode.toLowerCase() },
          });
        }
        updatedCount++;
      }
    }
  }

  console.log(`\n=== TỔNG KẾT ===`);
  console.log(`- Số học sinh cần chuẩn hóa: ${needNormalizeCount}`);
  if (!isDryRun) {
    console.log(`- Số học sinh đã cập nhật thành công: ${updatedCount}`);
  }
  if (duplicateWarnings.length > 0) {
    console.log(`- Cảnh báo trùng lặp phát hiện: ${duplicateWarnings.length} trường hợp:`, JSON.stringify(duplicateWarnings, null, 2));
  } else {
    console.log(`- Không có xung đột trùng lặp.`);
  }
}

main()
  .catch((e) => {
    console.error('Lỗi khi chuẩn hóa CCCD:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
