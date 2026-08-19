const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const verificationCode = '001234';
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
  console.log("Matching users count:", matchingUsers.length);
}
check().catch(console.error).finally(() => prisma.$disconnect());
