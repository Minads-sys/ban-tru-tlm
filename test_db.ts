import { PrismaClient } from '@prisma/client';
import { removeVietnameseTones } from './src/lib/utils';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: { fullName: { contains: 'Nam' } },
    include: { student: true }
  });
  console.log('Found users:', users.length);
  for (const u of users) {
    console.log(u.fullName, u.username, u.student?.studentCode);
    console.log('Normalized full name:', removeVietnameseTones(u.fullName).replace(/\s+/g, '').toLowerCase());
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
