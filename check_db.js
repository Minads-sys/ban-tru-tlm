const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    take: 5,
    select: { id: true, studentCode: true, boardingCode: true }
  });
  console.log(students);
}

main().finally(() => prisma.$disconnect());
