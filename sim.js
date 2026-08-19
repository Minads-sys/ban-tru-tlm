const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function removeVietnameseTones(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

async function simulate() {
  const username = 'Nguyễn Hoàng Nam';
  const password = '15012011';
  const verificationCode = '001234';

  let user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { student: true },
  });

  if (!user && verificationCode) {
    const matchingUsers = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        student: { studentCode: { endsWith: verificationCode } },
      },
      include: { student: true },
    });

    const normalizedInput = removeVietnameseTones(username).replace(/\s+/g, '').toLowerCase();
    user = matchingUsers.find((u) => {
      const normalizedFullName = removeVietnameseTones(u.fullName).replace(/\s+/g, '').toLowerCase();
      return normalizedFullName === normalizedInput;
    }) || null;
  }

  if (!user) {
    console.log("USER NOT FOUND");
    return;
  }
  
  if (verificationCode && user.student) {
    if (!user.student.studentCode.endsWith(verificationCode)) {
      console.log('MA xac nhan failed');
      return;
    }
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    console.log("PASSWORD INVALID");
    return;
  }

  console.log("SUCCESS");
}
simulate().catch(console.error).finally(() => prisma.$disconnect());
