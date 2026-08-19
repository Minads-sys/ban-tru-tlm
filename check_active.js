const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findFirst({
    where: { username: 'nguyenhoangnam' },
  });
  console.log("isActive:", user.isActive);
}
check().catch(console.error).finally(() => prisma.$disconnect());
