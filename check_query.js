const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true } } }
  });
  console.log("Classes:", classes);
}
check().catch(console.error).finally(() => prisma.$disconnect());
