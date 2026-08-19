const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function bruteForce() {
  const user = await prisma.user.findFirst({ where: { username: 'nguyenhoangnam' } });
  const hash = user.passwordHash;
  
  const passwordsToTest = [
    '14012011',
    '14/01/2011',
    '2011-01-14',
    '15082018',
    '001234',
    '123456',
    '12345678',
    'nguyenhoangnam'
  ];

  for (const p of passwordsToTest) {
    const match = await bcrypt.compare(p, hash);
    if (match) {
      console.log('MATCH FOUND:', p);
      return;
    }
  }
  console.log('NO MATCH FOUND IN COMMON PASSWORDS');
}
bruteForce().catch(console.error).finally(() => prisma.$disconnect());
