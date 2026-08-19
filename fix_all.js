const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function formatDateDDMMYYYY(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return day + month + year;
}

async function fixAll() {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: { student: true }
  });
  
  let mismatches = 0;
  for (const u of users) {
    if (!u.student || !u.student.birthDate) continue;
    const expectedPw = formatDateDDMMYYYY(u.student.birthDate);
    const match = await bcrypt.compare(expectedPw, u.passwordHash);
    
    // Also check if they had "123456" default
    const matchDefault = await bcrypt.compare("123456", u.passwordHash);

    if (!match && !matchDefault) {
      console.log('Mismatch for user ID: ' + u.id);
      const hash = await bcrypt.hash(expectedPw, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash }
      });
      mismatches++;
    }
  }
  console.log('Total passwords reset to birthdate:', mismatches);
}
fixAll().catch(console.error).finally(() => prisma.$disconnect());
