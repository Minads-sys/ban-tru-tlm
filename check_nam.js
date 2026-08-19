const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.findMany({
    where: { fullName: { contains: 'Nam' } },
    include: { student: true }
  });
  for (const u of users) {
    console.log(u.fullName, u.username, u.student?.studentCode, u.student?.birthDate);
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
