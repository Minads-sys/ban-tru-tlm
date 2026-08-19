const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { username: 'nguyenhoangnam' } });
  
  // Test if 14012011 works
  const match = await bcrypt.compare('14012011', user.passwordHash);
  console.log('Does 14012011 match?', match);

  // Test what was actually hashed, maybe it is a different format?
  // Let's check if they entered 15082018?
  const match2 = await bcrypt.compare('15082018', user.passwordHash);
  console.log('Does 15082018 match?', match2);
}
main().catch(console.error).finally(() => prisma.$disconnect());
