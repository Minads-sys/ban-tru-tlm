const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function removeVietnameseTones(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

async function testAuth() {
  const username = 'Nguyễn Hoàng Nam';
  const password = '14012011';
  const verificationCode = '001234';

  let user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { student: true },
  });
  console.log('findUnique result:', !!user);

  if (!user && verificationCode) {
    const matchingUsers = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        student: {
          studentCode: {
            endsWith: verificationCode,
          },
        },
      },
      include: { student: true },
    });
    console.log('matchingUsers count:', matchingUsers.length);

    const normalizedInput = removeVietnameseTones(username).replace(/\s+/g, '').toLowerCase();
    console.log('normalizedInput:', normalizedInput);

    user = matchingUsers.find((u) => {
      const normalizedFullName = removeVietnameseTones(u.fullName).replace(/\s+/g, '').toLowerCase();
      console.log('  Checking user:', u.fullName, '->', normalizedFullName);
      return normalizedFullName === normalizedInput;
    }) || null;
  }

  console.log('User found after fallback:', !!user);
  if (!user) return;

  console.log('Validating verificationCode...');
  if (!user.student.studentCode.endsWith(verificationCode)) {
    console.log('FAILED verificationCode');
    return;
  }

  console.log('Validating password...');
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  console.log('isPasswordValid:', isPasswordValid);
}

testAuth().catch(console.error).finally(() => prisma.$disconnect());
