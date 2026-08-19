const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function formatDateDDMMYYYY(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  // Ensure we use UTC methods because we construct dates using UTC now!
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return day + month + year;
}

async function fixBirthDates() {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: { student: true }
  });
  
  let fixed = 0;
  for (const u of users) {
    if (!u.student || !u.student.birthDate) continue;
    
    // Add 1 day
    const oldDate = new Date(u.student.birthDate);
    const newDate = new Date(oldDate.getTime() + 24 * 60 * 60 * 1000); // add 24 hours
    
    // Expected new password
    const expectedPw = formatDateDDMMYYYY(newDate);
    const hash = await bcrypt.hash(expectedPw, 10);
    
    // Update student birthDate
    await prisma.student.update({
      where: { id: u.student.id },
      data: { birthDate: newDate }
    });
    
    // Update user password
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: hash }
    });
    
    fixed++;
    if (fixed % 10 === 0) console.log('Fixed', fixed);
  }
  console.log('Total students fixed:', fixed);
}
fixBirthDates().catch(console.error).finally(() => prisma.$disconnect());
