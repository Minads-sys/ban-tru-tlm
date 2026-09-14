// Script: scripts/merge_duplicate_students.js
// Hợp nhất (Merge) 2 hồ sơ học sinh bị tạo trùng lặp do mất số 0 CCCD
//
// Cách sử dụng:
//   node scripts/merge_duplicate_students.js <Mã_HS_Chính> <Mã_HS_Phụ> [--dry-run]
//
// Ví dụ:
//   node scripts/merge_duplicate_students.js 79211040961 079211040961 --dry-run
//   node scripts/merge_duplicate_students.js 79211040961 079211040961

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeStudents(primaryCode, secondaryCode, isDryRun = false) {
  console.log(`=== BẮT ĐẦU HỢP NHẤT HỌC SINH TRÙNG LẶP ===`);
  console.log(`- Mã hồ sơ Giữ lại (Chính): ${primaryCode}`);
  console.log(`- Mã hồ sơ Gộp & Xóa (Phụ): ${secondaryCode}`);
  console.log(`- Chế độ: ${isDryRun ? 'DRY-RUN (Chỉ kiểm tra, không lưu)' : 'THỰC THI THẬT'}\n`);

  // 1. Tìm 2 học sinh
  const primaryStudent = await prisma.student.findFirst({
    where: {
      OR: [
        { studentCode: primaryCode },
        { studentCode: primaryCode.padStart(12, '0') },
        { id: primaryCode },
      ],
    },
    include: {
      user: true,
      class: true,
      monthlyBills: { include: { transactions: true } },
      paymentTransactions: true,
      mealCancellations: true,
      mealOverrides: true,
      specialMeals: true,
    },
  });

  const secondaryStudent = await prisma.student.findFirst({
    where: {
      OR: [
        { studentCode: secondaryCode },
        { studentCode: secondaryCode.padStart(12, '0') },
        { id: secondaryCode },
      ],
    },
    include: {
      user: true,
      class: true,
      monthlyBills: { include: { transactions: true } },
      paymentTransactions: true,
      mealCancellations: true,
      mealOverrides: true,
      specialMeals: true,
    },
  });

  if (!primaryStudent) {
    console.error(`❌ Không tìm thấy hồ sơ chính mang mã: ${primaryCode}`);
    process.exit(1);
  }

  if (!secondaryStudent) {
    console.error(`❌ Không tìm thấy hồ sơ phụ mang mã: ${secondaryCode}`);
    process.exit(1);
  }

  if (primaryStudent.id === secondaryStudent.id) {
    console.error(`❌ Hai mã cung cấp trỏ về cùng 1 học sinh (ID: ${primaryStudent.id})!`);
    process.exit(1);
  }

  console.log(`Tìm thấy 2 hồ sơ:`);
  console.log(`1. Hồ sơ Chính: [ID: ${primaryStudent.id}] ${primaryStudent.user.fullName} (CCCD: ${primaryStudent.studentCode}, Mã BT: ${primaryStudent.boardingCode}, Lớp: ${primaryStudent.classId})`);
  console.log(`   - Hóa đơn: ${primaryStudent.monthlyBills.length} | Giao dịch nộp tiền: ${primaryStudent.paymentTransactions.length} | Cắt suất: ${primaryStudent.mealCancellations.length}`);
  console.log(`2. Hồ sơ Phụ:   [ID: ${secondaryStudent.id}] ${secondaryStudent.user.fullName} (CCCD: ${secondaryStudent.studentCode}, Mã BT: ${secondaryStudent.boardingCode}, Lớp: ${secondaryStudent.classId})`);
  console.log(`   - Hóa đơn: ${secondaryStudent.monthlyBills.length} | Giao dịch nộp tiền: ${secondaryStudent.paymentTransactions.length} | Cắt suất: ${secondaryStudent.mealCancellations.length}\n`);

  const normalizedCCCD = (primaryStudent.studentCode.length === 11 ? primaryStudent.studentCode.padStart(12, '0') : secondaryStudent.studentCode.padStart(12, '0'));

  if (isDryRun) {
    console.log(`[DRY-RUN] Dự kiến các thao tác sẽ thực hiện:`);
    console.log(`- Cập nhật số CCCD của hồ sơ chính thành: ${normalizedCCCD}`);
    console.log(`- Chuyển ${secondaryStudent.paymentTransactions.length} giao dịch nộp tiền từ hồ sơ phụ sang hồ sơ chính.`);
    console.log(`- Chuyển ${secondaryStudent.mealCancellations.length} đơn cắt suất từ hồ sơ phụ sang hồ sơ chính.`);
    console.log(`- Chuyển/gộp ${secondaryStudent.monthlyBills.length} hóa đơn từ hồ sơ phụ sang hồ sơ chính.`);
    console.log(`- Xóa hồ sơ phụ (ID: ${secondaryStudent.id}) và User liên kết (ID: ${secondaryStudent.userId}).`);
    console.log(`\n=> Chạy lại lệnh không có cờ --dry-run để thực thi thật.`);
    return;
  }

  // Thực thi trong Transaction
  await prisma.$transaction(async (tx) => {
    // 1. Chuyển PaymentTransaction
    if (secondaryStudent.paymentTransactions.length > 0) {
      await tx.paymentTransaction.updateMany({
        where: { studentId: secondaryStudent.id },
        data: { studentId: primaryStudent.id },
      });
      console.log(`✓ Đã chuyển ${secondaryStudent.paymentTransactions.length} giao dịch nộp tiền sang hồ sơ chính.`);
    }

    // 2. Chuyển MealCancellation
    for (const cancel of secondaryStudent.mealCancellations) {
      const existingInPrimary = await tx.mealCancellation.findUnique({
        where: {
          studentId_cancelDate: {
            studentId: primaryStudent.id,
            cancelDate: cancel.cancelDate,
          },
        },
      });

      if (!existingInPrimary) {
        await tx.mealCancellation.update({
          where: { id: cancel.id },
          data: { studentId: primaryStudent.id },
        });
      } else {
        await tx.mealCancellation.delete({ where: { id: cancel.id } });
      }
    }
    console.log(`✓ Đã xử lý ${secondaryStudent.mealCancellations.length} yêu cầu cắt suất.`);

    // 3. Chuyển MealOverride & StudentSpecialMeal
    for (const mo of secondaryStudent.mealOverrides) {
      const exist = await tx.mealOverride.findUnique({
        where: { studentId_date: { studentId: primaryStudent.id, date: mo.date } },
      });
      if (!exist) {
        await tx.mealOverride.update({ where: { id: mo.id }, data: { studentId: primaryStudent.id } });
      } else {
        await tx.mealOverride.delete({ where: { id: mo.id } });
      }
    }

    for (const sm of secondaryStudent.specialMeals) {
      const exist = await tx.studentSpecialMeal.findUnique({
        where: { studentId_date: { studentId: primaryStudent.id, date: sm.date } },
      });
      if (!exist) {
        await tx.studentSpecialMeal.update({ where: { id: sm.id }, data: { studentId: primaryStudent.id } });
      } else {
        await tx.studentSpecialMeal.delete({ where: { id: sm.id } });
      }
    }

    // 4. Xử lý MonthlyBill
    for (const secBill of secondaryStudent.monthlyBills) {
      const priBill = await tx.monthlyBill.findUnique({
        where: {
          studentId_month_year: {
            studentId: primaryStudent.id,
            month: secBill.month,
            year: secBill.year,
          },
        },
        include: { transactions: true },
      });

      if (!priBill) {
        // Hồ sơ chính chưa có hóa đơn tháng này -> Chuyển sang hồ sơ chính
        await tx.monthlyBill.update({
          where: { id: secBill.id },
          data: { studentId: primaryStudent.id },
        });
        console.log(`✓ Đã chuyển hóa đơn tháng ${secBill.month}/${secBill.year} sang hồ sơ chính.`);
      } else {
        // Cả 2 đều có hóa đơn cùng tháng -> Gắn các giao dịch của bill phụ vào bill chính
        await tx.paymentTransaction.updateMany({
          where: { billId: secBill.id },
          data: { billId: priBill.id, studentId: primaryStudent.id },
        });

        // Xóa bill phụ
        await tx.monthlyBill.delete({ where: { id: secBill.id } });

        // Cập nhật lại paymentStatus của bill chính nếu tổng tiền đã đủ
        const allPriTrans = await tx.paymentTransaction.findMany({
          where: { billId: priBill.id, isVoided: false },
        });
        const totalPaid = allPriTrans.reduce((s, t) => s + Number(t.amount), 0);
        if (totalPaid >= Number(priBill.finalAmount) && Number(priBill.finalAmount) > 0) {
          await tx.monthlyBill.update({
            where: { id: priBill.id },
            data: { paymentStatus: 'PAID' },
          });
        }
        console.log(`✓ Đã hợp nhất hóa đơn trùng tháng ${secBill.month}/${secBill.year}.`);
      }
    }

    // 5. Cập nhật hồ sơ chính CCCD đủ 12 số
    await tx.student.update({
      where: { id: primaryStudent.id },
      data: {
        studentCode: normalizedCCCD,
      },
    });

    if (primaryStudent.user && /^\d{11,12}$/.test(primaryStudent.user.username)) {
      await tx.user.update({
        where: { id: primaryStudent.userId },
        data: { username: normalizedCCCD.toLowerCase() },
      });
    }
    console.log(`✓ Đã cập nhật CCCD hồ sơ chính thành 12 số: ${normalizedCCCD}`);

    // 6. Xóa hồ sơ phụ và User phụ
    await tx.student.delete({ where: { id: secondaryStudent.id } });
    await tx.user.delete({ where: { id: secondaryStudent.userId } });
    console.log(`✓ Đã xóa hồ sơ phụ (ID: ${secondaryStudent.id}) và User liên kết.`);
  });

  console.log(`\n🎉 HỢP NHẤT THÀNH CÔNG!`);
  console.log(`Học sinh hiện tại: [${normalizedCCCD}] ${primaryStudent.user.fullName} (Mã BT: ${primaryStudent.boardingCode}, Lớp: ${primaryStudent.classId})`);
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const cleanArgs = args.filter(a => a !== '--dry-run');

if (cleanArgs.length < 2) {
  console.log(`Cách dùng: node scripts/merge_duplicate_students.js <Mã_HS_Chính> <Mã_HS_Phụ> [--dry-run]`);
  console.log(`Ví dụ:    node scripts/merge_duplicate_students.js 79211040961 079211040961 --dry-run`);
  process.exit(0);
}

mergeStudents(cleanArgs[0], cleanArgs[1], isDryRun)
  .catch(e => {
    console.error('Lỗi khi hợp nhất học sinh:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
