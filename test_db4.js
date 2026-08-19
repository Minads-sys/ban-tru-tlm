const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { username: 'nguyenhoangnam' } });
  console.log('Hash length:', user.passwordHash.length);
  console.log('Hash start:', user.passwordHash.substring(0, 7));
}
main().catch(console.error).finally(() => prisma.$disconnect());
