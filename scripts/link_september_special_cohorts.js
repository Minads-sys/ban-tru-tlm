const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function main() {
  console.log('--- BẮT ĐẦU QUÉT & KẾ THỪA LỊCH ĐẶC BIỆT CŨ SANG LỚP HỌC PHẦN (SPECIAL COHORT) ---');
  
  // 1. Lấy danh sách tên lịch duy nhất đã có trong StudentSpecialMeal
  const groups = await prisma.studentSpecialMeal.groupBy({
    by: ['scheduleName'],
    _count: { id: true },
  });

  if (groups.length === 0) {
    console.log('ℹ️ Hiện tại chưa có lịch đặc biệt nào trong StudentSpecialMeal. Sẵn sàng cho việc tạo mới!');
    return;
  }

  console.log(`Tìm thấy ${groups.length} nhóm lịch đặc biệt cũ:`);
  for (const g of groups) {
    console.log(`- "${g.scheduleName}": ${g._count.id} suất ăn`);
  }

  for (const g of groups) {
    const scheduleName = g.scheduleName;
    const code = slugify(scheduleName) || `COHORT_${Date.now()}`;

    // Tìm hoặc tạo SpecialCohort
    let cohort = await prisma.specialCohort.findFirst({
      where: { OR: [{ code }, { name: scheduleName }] },
    });

    if (!cohort) {
      // Phân tích các bữa ăn của nhóm này để lấy ngày trong tuần và ca ăn phổ biến
      const sampleMeals = await prisma.studentSpecialMeal.findMany({
        where: { scheduleName },
        take: 50,
      });

      // Tìm ca ăn phổ biến
      const shiftCounts = { TIET_4: 0, TIET_5: 0 };
      sampleMeals.forEach((m) => {
        if (m.shift === 'TIET_4') shiftCounts.TIET_4++;
        if (m.shift === 'TIET_5') shiftCounts.TIET_5++;
      });
      const defaultShift = shiftCounts.TIET_5 >= shiftCounts.TIET_4 ? 'TIET_5' : 'TIET_4';

      // Tìm thứ trong tuần phổ biến (1=T2, ..., 6=T7)
      const dayCounts = {};
      sampleMeals.forEach((m) => {
        const dow = new Date(m.date).getUTCDay();
        if (dow >= 1 && dow <= 6) {
          dayCounts[dow] = (dayCounts[dow] || 0) + 1;
        }
      });
      let dayOfWeek = 2; // Default Thứ 3
      let maxDayCount = -1;
      for (const [d, count] of Object.entries(dayCounts)) {
        if (count > maxDayCount) {
          maxDayCount = count;
          dayOfWeek = Number(d);
        }
      }

      cohort = await prisma.specialCohort.create({
        data: {
          code,
          name: scheduleName,
          academicYear: 2026,
          semester: 1,
          dayOfWeek,
          defaultShift,
          startWeek: 1,
          endWeek: 18,
          isActive: true,
        },
      });
      console.log(`✅ Đã tạo SpecialCohort: "${cohort.name}" (Mã: ${cohort.code}, Thứ ${dayOfWeek + 1}, Ca ${defaultShift})`);
    } else {
      console.log(`ℹ️ Đã tồn tại SpecialCohort: "${cohort.name}" (ID: ${cohort.id})`);
    }

    // 2. Nạp học sinh vào SpecialCohortMember
    const distinctStudents = await prisma.studentSpecialMeal.findMany({
      where: { scheduleName },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    let newMembersCount = 0;
    for (const s of distinctStudents) {
      const exist = await prisma.specialCohortMember.findUnique({
        where: {
          cohortId_studentId: {
            cohortId: cohort.id,
            studentId: s.studentId,
          },
        },
      });
      if (!exist) {
        await prisma.specialCohortMember.create({
          data: {
            cohortId: cohort.id,
            studentId: s.studentId,
            status: 'ACTIVE',
          },
        });
        newMembersCount++;
      }
    }
    console.log(`  -> Đã nạp/cập nhật ${distinctStudents.length} học sinh thành viên (Mới: ${newMembersCount})`);

    // 3. Gán cohortId vào các bản ghi StudentSpecialMeal cũ
    const updateResult = await prisma.studentSpecialMeal.updateMany({
      where: { scheduleName, cohortId: null },
      data: { cohortId: cohort.id },
    });
    if (updateResult.count > 0) {
      console.log(`  -> Đã liên kết ${updateResult.count} bản ghi StudentSpecialMeal vào Cohort ${cohort.code}`);
    }
  }

  console.log('--- HOÀN TẤT ĐỒNG BỘ DỮ LIỆU CŨ VÀO SPECIAL COHORTS ---');
}

main()
  .catch((e) => {
    console.error('Lỗi khi chạy link_september_special_cohorts:', e);
  })
  .finally(() => prisma.$disconnect());
