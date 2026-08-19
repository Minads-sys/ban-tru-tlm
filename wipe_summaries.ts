import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.dailyMealSummary.deleteMany();
}
main().then(() => console.log("Wiped DailyMealSummary")).catch(console.error);
