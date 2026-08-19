const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      student: { studentCode: { endsWith: '001234' } }
    },
    include: { student: true }
  });
  console.log("Found:", users.length);
  for (const u of users) {
    console.log(u.fullName, u.student.studentCode);
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
