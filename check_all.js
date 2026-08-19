const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function formatDateDDMMYYYY(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return ``;
}

async function checkAll() {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: { student: true }
  });
  
  let mismatches = 0;
  for (const u of users) {
    if (!u.student?.birthDate) continue;
    const expectedPw = formatDateDDMMYYYY(u.student.birthDate);
    const match = await bcrypt.compare(expectedPw, u.passwordHash);
    if (!match) {
      console.log(Mismatch: , birthDate=, expected=);
      mismatches++;
    }
  }
  console.log('Total mismatches:', mismatches);
}
checkAll().catch(console.error).finally(() => prisma.$disconnect());
