import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PaymentStatus, PaymentTransactionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách giao dịch SePay (kèm bộ lọc & phân trang)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status as PaymentTransactionStatus;
    }

    if (fromDate || toDate) {
      const transDateFilter: Record<string, Date> = {};
      if (fromDate) transDateFilter.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        transDateFilter.lte = end;
      }
      where.transDate = transDateFilter;
    }

    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { sepayTransId: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
        {
          student: {
            OR: [
              { studentCode: { contains: search, mode: 'insensitive' } },
              { boardingCode: { contains: search, mode: 'insensitive' } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          },
        },
      ];
    }

    const total = await prisma.paymentTransaction.count({ where });
    const skip = (page - 1) * limit;

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        bill: {
          include: {
            student: {
              include: {
                user: { select: { fullName: true } },
                class: { select: { name: true } },
              },
            },
          },
        },
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { transDate: 'desc' },
      skip,
      take: limit,
    });

    // Thống kê tổng hợp
    const stats = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      _count: { id: true },
    });

    const matchedCount = await prisma.paymentTransaction.count({
      where: { status: { in: [PaymentTransactionStatus.MATCHED, PaymentTransactionStatus.MANUAL] } },
    });

    const unmatchedCount = await prisma.paymentTransaction.count({
      where: { status: PaymentTransactionStatus.UNMATCHED },
    });

    return NextResponse.json({
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalTransactions: stats._count.id,
        totalAmount: stats._sum.amount?.toString() || '0',
        matchedCount,
        unmatchedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching SePay transactions:', error);
    return NextResponse.json(
      { error: 'Lỗi khi tải danh sách giao dịch SePay', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Gạch nợ thủ công (Manual Match) cho giao dịch chưa khớp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, billId } = body;

    if (!transactionId || !billId) {
      return NextResponse.json(
        { error: 'Cần cung cấp transactionId và billId để gạch nợ thủ công' },
        { status: 400 }
      );
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Không tìm thấy giao dịch chuyển khoản' },
        { status: 404 }
      );
    }

    const bill = await prisma.monthlyBill.findUnique({
      where: { id: billId },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
        transactions: true,
      },
    });

    if (!bill) {
      return NextResponse.json(
        { error: 'Không tìm thấy hóa đơn cần gạch nợ' },
        { status: 404 }
      );
    }

    // Thực hiện liên kết giao dịch và cập nhật trạng thái hóa đơn
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật transaction
      const updatedTx = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          billId: bill.id,
          studentId: bill.studentId,
          status: PaymentTransactionStatus.MANUAL,
          unmatchedReason: null,
        },
      });

      // 2. Tính lại tổng tiền đã trả của hóa đơn
      // Lọc bỏ transaction hiện tại nếu nó đã nằm trong bill.transactions để tránh tính đúp
      const otherTransactions = bill.transactions.filter((t) => t.id !== transactionId);
      const existingPaid = otherTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalPaid = existingPaid + Number(transaction.amount);
      const finalAmount = Number(bill.finalAmount);

      let newStatus: PaymentStatus = bill.paymentStatus;
      if (totalPaid >= finalAmount && finalAmount > 0) {
        newStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        newStatus = PaymentStatus.PARTIAL;
      }

      const updatedBill = await tx.monthlyBill.update({
        where: { id: bill.id },
        data: { paymentStatus: newStatus },
      });

      return { updatedTx, updatedBill, totalPaid, newStatus };
    });

    return NextResponse.json({
      success: true,
      message: `Đã gạch nợ thủ công thành công cho học sinh ${bill.student.user?.fullName}, Tháng ${bill.month}/${bill.year}`,
      data: result,
    });
  } catch (error) {
    console.error('Error manual matching SePay transaction:', error);
    return NextResponse.json(
      { error: 'Lỗi khi gạch nợ thủ công', details: String(error) },
      { status: 500 }
    );
  }
}
