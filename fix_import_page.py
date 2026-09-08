import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("14.225.224.121", port=22, username="root", password="mFCDAPzdO7XZq7Q6szVe", timeout=15)

script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const student = await prisma.student.findFirst({
    where: { boardingCode: 'BT00163' },
    include: {
      user: true,
      class: true,
      monthlyBills: {
        include: {
          transactions: true
        }
      },
      settlementRecords: true,
      paymentTransactions: true
    }
  });

  console.log('STUDENT INFO:');
  console.log({
    id: student?.id,
    boardingCode: student?.boardingCode,
    name: student?.user?.fullName,
    boardingStatus: student?.boardingStatus,
    boardingCancelledAt: student?.boardingCancelledAt
  });

  console.log('SETTLEMENTS:');
  console.log(student?.settlementRecords);

  console.log('BILLS:');
  console.log(JSON.stringify(student?.monthlyBills, null, 2));

  console.log('ALL PAYMENT TRANSACTIONS:');
  console.log(JSON.stringify(student?.paymentTransactions, null, 2));

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { targetId: student?.id },
        { description: { contains: 'BT00163' } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('AUDIT LOGS:');
  console.log(logs);
}

run().finally(() => prisma.$disconnect());
"""

sftp = client.open_sftp()
with sftp.open('/var/www/bantrutlm/check_full.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('cd /var/www/bantrutlm && node check_full.js')
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
client.close()


