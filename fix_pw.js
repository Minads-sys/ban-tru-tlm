const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fixPassword() {
  const hash = await bcrypt.hash('14012011', 10);
  await prisma.user.updateMany({
    where: { username: 'nguyenhoangnam' },
    data: { passwordHash: hash }
  });
  console.log('Password for nguyenhoangnam reset to 14012011');
}
fixPassword().catch(console.error).finally(() => prisma.$disconnect());
