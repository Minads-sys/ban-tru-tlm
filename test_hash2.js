const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testFormat() {
  const user = await prisma.user.findFirst({ where: { username: 'nguyenhoangnam' } });
  const hash = user.passwordHash;
  
  // Date in JS might be off by 1 day because of timezones?
  const d1 = '13012011';
  const d2 = '15012011';
  // Try combinations of the date
  const passwordsToTest = [
    '13012011',
    '15012011',
    '01142011',
    '1412011',
    '140111',
  ];
  
  for (const p of passwordsToTest) {
    const match = await bcrypt.compare(p, hash);
    if (match) {
      console.log('MATCH FOUND:', p);
      return;
    }
  }
  
  // What if it is empty and used default?
  console.log('NO MATCH FOUND AGAIN');
}
testFormat().catch(console.error).finally(() => prisma.$disconnect());
