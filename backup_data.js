/**
 * BAN-TRU-TLM - Database Backup Script
 * Tự động kết nối cơ sở dữ liệu Supabase qua Prisma và xuất toàn bộ bảng ra file JSON lưu trữ.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runBackup() {
  const startTime = Date.now();
  console.log('========================================================');
  console.log('   BẮT ĐẦU SAO LƯU DỮ LIỆU BÁN TRÚ TLM (SUPABASE DB)    ');
  console.log('========================================================\n');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `backup_bantru_${timestamp}.json`);

  const models = [
    { name: 'SystemSetting', query: () => prisma.systemSetting.findMany() },
    { name: 'User', query: () => prisma.user.findMany() },
    { name: 'Class', query: () => prisma.class.findMany() },
    { name: 'Student', query: () => prisma.student.findMany() },
    { name: 'ClassWeeklySchedule', query: () => prisma.classWeeklySchedule.findMany() },
    { name: 'MealOverride', query: () => prisma.mealOverride.findMany() },
    { name: 'StudentSpecialMeal', query: () => prisma.studentSpecialMeal.findMany() },
    { name: 'MealCancellation', query: () => prisma.mealCancellation.findMany() },
    { name: 'DailyMealSummary', query: () => prisma.dailyMealSummary.findMany() },
    { name: 'MonthlyBill', query: () => prisma.monthlyBill.findMany() },
    { name: 'PaymentTransaction', query: () => prisma.paymentTransaction.findMany() },
    { name: 'DailyCashClosing', query: () => prisma.dailyCashClosing.findMany() },
    { name: 'SettlementRecord', query: () => prisma.settlementRecord.findMany() },
    { name: 'AuditLog', query: () => prisma.auditLog.findMany() },
    { name: 'DailyDiningCourt', query: () => prisma.dailyDiningCourt.findMany() },
    { name: 'CentralKitchenBranch', query: () => prisma.centralKitchenBranch.findMany() },
    { name: 'CentralKitchenIngredient', query: () => prisma.centralKitchenIngredient.findMany() },
    { name: 'CentralKitchenDailyEntry', query: () => prisma.centralKitchenDailyEntry.findMany() },
  ];

  const backupData = {
    exportedAt: now.toISOString(),
    version: '1.0.0',
    tables: {},
    stats: {}
  };

  let totalRows = 0;

  for (const model of models) {
    try {
      process.stdout.write(`Đang đọc bảng [${model.name}]... `);
      const rows = await model.query();
      backupData.tables[model.name] = rows;
      backupData.stats[model.name] = rows.length;
      totalRows += rows.length;
      console.log(`✓ ${rows.length} bản ghi`);
    } catch (err) {
      console.log(`✗ Lỗi: ${err.message}`);
      backupData.tables[model.name] = [];
      backupData.stats[model.name] = `Error: ${err.message}`;
    }
  }

  console.log('\nĐang ghi dữ liệu ra file...');
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

  const fileStats = fs.statSync(backupFile);
  const fileSizeKB = (fileStats.size / 1024).toFixed(2);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================================');
  console.log('   SAO LƯU THÀNH CÔNG!');
  console.log(`   - Tổng số bản ghi: ${totalRows}`);
  console.log(`   - Kích thước file: ${fileSizeKB} KB`);
  console.log(`   - Thời gian thực hiện: ${duration}s`);
  console.log(`   - Vị trí file lưu: ${backupFile}`);
  console.log('========================================================\n');
}

runBackup()
  .catch((e) => {
    console.error('Lỗi khi sao lưu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
