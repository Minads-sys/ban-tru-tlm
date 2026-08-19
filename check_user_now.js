const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { username: 'nguyenhoangnam' },
    include: { student: true }
  });
  
  if (!user) {
    console.log("User not found!");
    return;
  }
  
  console.log("FullName:", user.fullName);
  console.log("Username:", user.username);
  console.log("StudentCode (CCCD):", user.student?.studentCode);
  console.log("BirthDate:", user.student?.birthDate);
  
  const passwordsToTest = [
    '14012011',
    '15012011',
    '16012011',
    '15082018',
    '123456'
  ];
  
  for (const pw of passwordsToTest) {
    const match = await bcrypt.compare(pw, user.passwordHash);
    if (match) {
      console.log("PASSWORD MATCHES:", pw);
      return;
    }
  }
  console.log("PASSWORD DOES NOT MATCH ANY KNOWN VALUE");
}
checkUser().catch(console.error).finally(() => prisma.$disconnect());
