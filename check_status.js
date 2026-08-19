const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findFirst({
    where: { username: 'nguyenhoangnam' },
    include: { student: true }
  });
  console.log(user.student.boardingStatus);
}
check().catch(console.error).finally(() => prisma.$disconnect());
