// Script: scripts/scan_duplicates.js
// Dò quét toàn bộ danh sách học sinh để phát hiện các trường hợp nghi ngờ trùng lặp

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str;
}

const normalizeName = (name) =>
  removeVietnameseTones(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function scanDuplicates() {
  console.log('=== BẮT ĐẦU DÒ TÌM HỌC SINH NGHI NGỜ TRÙNG LẶP ===\n');

  const students = await prisma.student.findMany({
    include: {
      user: true,
      class: true,
      monthlyBills: true,
      paymentTransactions: { where: { isVoided: false } },
    },
    orderBy: [{ classId: 'asc' }, { studentCode: 'asc' }],
  });

  console.log(`Tổng số học sinh được quét: ${students.length}\n`);

  const groups = [];
  const groupedPairs = new Set();

  // 1. Tiêu chí 1: Trùng CCCD sau khi chuẩn hóa 12 số (bù số 0)
  const cccdMap = new Map();
  students.forEach((s) => {
    const norm = s.studentCode.trim().padStart(12, '0');
    if (!cccdMap.has(norm)) cccdMap.set(norm, []);
    cccdMap.get(norm).push(s);
  });

  for (const [normCCCD, list] of cccdMap.entries()) {
    if (list.length > 1) {
      const pairKey = list.map((x) => x.id).sort().join('_');
      groupedPairs.add(pairKey);
      groups.push({
        type: 'TRÙNG CCCD (100%)',
        reason: `Mã CCCD trùng sau khi bù số 0: ${normCCCD}`,
        students: list,
      });
    }
  }

  // 2. Tiêu chí 2: Trùng Họ tên + Lớp học
  const nameClassMap = new Map();
  students.forEach((s) => {
    const normName = normalizeName(s.user?.fullName);
    if (!normName) return;
    const key = `${normName}::${s.classId}`;
    if (!nameClassMap.has(key)) nameClassMap.set(key, []);
    nameClassMap.get(key).push(s);
  });

  for (const [key, list] of nameClassMap.entries()) {
    if (list.length > 1) {
      const pairKey = list.map((x) => x.id).sort().join('_');
      if (!groupedPairs.has(pairKey)) {
        groupedPairs.add(pairKey);
        groups.push({
          type: 'TRÙNG TÊN & LỚP (95%)',
          reason: `Cùng Họ tên "${list[0].user?.fullName}" và cùng học Lớp ${list[0].class?.name || list[0].classId}`,
          students: list,
        });
      }
    }
  }

  // 3. Tiêu chí 3: Trùng Họ tên + SĐT phụ huynh
  const namePhoneMap = new Map();
  students.forEach((s) => {
    const normName = normalizeName(s.user?.fullName);
    const cleanPhone = (s.parentPhone || '').replace(/\D/g, '');
    if (!normName || cleanPhone.length < 9) return;
    const key = `${normName}::${cleanPhone}`;
    if (!namePhoneMap.has(key)) namePhoneMap.set(key, []);
    namePhoneMap.get(key).push(s);
  });

  for (const [key, list] of namePhoneMap.entries()) {
    if (list.length > 1) {
      const pairKey = list.map((x) => x.id).sort().join('_');
      if (!groupedPairs.has(pairKey)) {
        groupedPairs.add(pairKey);
        groups.push({
          type: 'TRÙNG TÊN & SĐT (90%)',
          reason: `Cùng Họ tên "${list[0].user?.fullName}" và cùng SĐT ${list[0].parentPhone}`,
          students: list,
        });
      }
    }
  }

  // 4. Tiêu chí 4: Trùng Họ tên + Ngày sinh
  const nameBirthMap = new Map();
  students.forEach((s) => {
    const normName = normalizeName(s.user?.fullName);
    if (!normName || !s.birthDate) return;
    const bStr = s.birthDate.toISOString().slice(0, 10);
    const key = `${normName}::${bStr}`;
    if (!nameBirthMap.has(key)) nameBirthMap.set(key, []);
    nameBirthMap.get(key).push(s);
  });

  for (const [key, list] of nameBirthMap.entries()) {
    if (list.length > 1) {
      const pairKey = list.map((x) => x.id).sort().join('_');
      if (!groupedPairs.has(pairKey)) {
        groupedPairs.add(pairKey);
        const bDisplay = list[0].birthDate ? new Date(list[0].birthDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '';
        groups.push({
          type: 'TRÙNG TÊN & NGÀY SINH (85%)',
          reason: `Cùng Họ tên "${list[0].user?.fullName}" và cùng Ngày sinh ${bDisplay}`,
          students: list,
        });
      }
    }
  }

  console.log(`=== KẾT QUẢ DÒ QUÉT ===`);
  if (groups.length === 0) {
    console.log('✅ TUYỆT VỜI: Không tìm thấy học sinh nào bị trùng lặp trong cơ sở dữ liệu!');
  } else {
    console.log(`⚠️ PHÁT HIỆN ${groups.length} NHÓM HỌC SINH NGHI NGỜ TRÙNG LẶP:\n`);
    groups.forEach((g, idx) => {
      console.log(`[Nhóm ${idx + 1}] [${g.type}]`);
      console.log(`  Lý do: ${g.reason}`);
      g.students.forEach((s, sIdx) => {
        const paid = s.paymentTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        console.log(`  -> Hồ sơ ${sIdx + 1}: [ID: ${s.id}] ${s.user?.fullName} | CCCD: ${s.studentCode} | Mã BT: ${s.boardingCode} | Lớp: ${s.class?.name || s.classId} | Bills: ${s.monthlyBills.length} | Đã nộp: ${paid.toLocaleString('vi-VN')} đ`);
      });
      console.log(`  => Gợi ý lệnh gộp: node scripts/merge_duplicate_students.js ${g.students[0].studentCode} ${g.students[1].studentCode}\n`);
    });
  }
}

scanDuplicates()
  .catch((e) => {
    console.error('Lỗi khi quét học sinh trùng:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
