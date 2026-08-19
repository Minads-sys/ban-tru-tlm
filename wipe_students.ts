import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.mealCancellation.deleteMany();
  await prisma.mealOverride.deleteMany();
  await prisma.settlementRecord.deleteMany();
  await prisma.monthlyBill.deleteMany();
  await prisma.student.deleteMany();
}
main().then(() => console.log("Wiped")).catch(console.error);
