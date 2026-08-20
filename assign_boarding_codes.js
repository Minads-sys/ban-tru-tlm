const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      boardingCode: null,
    },
    orderBy: {
      id: 'asc'
    }
  });

  console.log(`Found ${students.length} students without boardingCode.`);

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    // Start from BT00001. Check what's the highest existing BTxxxxx?
    // Let's just use a random simple function since this runs once.
    // Wait, to be safe, get the max current code.
    const codeNumber = i + 1;
    const paddedNumber = String(codeNumber).padStart(5, '0');
    const boardingCode = `BT${paddedNumber}`;
    
    await prisma.student.update({
      where: { id: student.id },
      data: { boardingCode }
    });
    
    if (i % 100 === 0) {
      console.log(`Updated ${i} / ${students.length}`);
    }
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
