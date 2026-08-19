const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: { fullName: { contains: 'Nam' } },
    include: { student: true }
  });
  console.log('Found users:', users.length);
  for (const u of users) {
    console.log(u.fullName, u.username, u.student?.studentCode, u.student?.birthDate);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
