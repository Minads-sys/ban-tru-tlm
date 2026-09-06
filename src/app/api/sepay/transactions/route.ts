import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { PaymentStatus, PaymentTransactionStatus } from '@prisma/client';
import { broadcastChange } from '@/lib/realtime-hub';

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

    // Phát tín hiệu Realtime tức thì xuống VPS Client
    broadcastChange('monthly_bills', 'UPDATE', { billId: bill.id, studentId: bill.studentId, paymentStatus: result.newStatus });
    broadcastChange('payment_transactions', 'UPDATE', { transactionId });

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

// PATCH: Hủy gạch nợ (Void) - Hoàn tác giao dịch đã khớp nhầm và tính lại trạng thái hóa đơn
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, reason, deleteTx } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Cần cung cấp transactionId để hủy gạch nợ' },
        { status: 400 }
      );
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        bill: {
          include: {
            student: {
              include: {
                user: { select: { fullName: true } },
                class: { select: { name: true } },
              },
            },
            transactions: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tính lại trạng thái hóa đơn nếu giao dịch có liên kết hóa đơn
      let updatedBill = null;
      if (transaction.billId && transaction.bill) {
        const bill = transaction.bill;
        // Lấy tất cả giao dịch còn lại hợp lệ (bỏ qua giao dịch này và các giao dịch đã void)
        const validTransactions = bill.transactions.filter(
          (t) => t.id !== transactionId && !t.isVoided
        );
        const totalPaid = validTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const finalAmount = Number(bill.finalAmount);

        let newStatus: PaymentStatus = PaymentStatus.UNPAID;
        if (totalPaid >= finalAmount && finalAmount > 0) {
          newStatus = PaymentStatus.PAID;
        } else if (totalPaid > 0) {
          newStatus = PaymentStatus.PARTIAL;
        }

        updatedBill = await tx.monthlyBill.update({
          where: { id: bill.id },
          data: { paymentStatus: newStatus },
        });
      }

      // 2. Xóa hẳn hoặc chuyển về UNMATCHED
      if (deleteTx) {
        await tx.paymentTransaction.delete({
          where: { id: transactionId },
        });
        return { deleted: true, updatedBill };
      } else {
        const voidedTx = await tx.paymentTransaction.update({
          where: { id: transactionId },
          data: {
            isVoided: true,
            voidedAt: new Date(),
            voidReason: reason || 'Hủy gạch nợ do khớp nhầm (giao dịch demo/test)',
            status: PaymentTransactionStatus.UNMATCHED,
            unmatchedReason: `Đã hủy gạch nợ: ${reason || 'Giao dịch demo/test khớp nhầm'}`,
            billId: null,
            studentId: null,
          },
        });
        return { deleted: false, voidedTx, updatedBill };
      }
    });

    // Phát tín hiệu Realtime
    if (result.deleted) {
      broadcastChange('payment_transactions', 'DELETE', { transactionId });
    } else {
      broadcastChange('payment_transactions', 'UPDATE', { transactionId });
    }

    if (transaction.billId) {
      broadcastChange('monthly_bills', 'UPDATE', {
        billId: transaction.billId,
        studentId: transaction.studentId,
        paymentStatus: result.updatedBill?.paymentStatus,
      });
    }

    const studentName = transaction.bill?.student?.user?.fullName || 'học sinh';
    const billInfo = transaction.bill ? `Tháng ${transaction.bill.month}/${transaction.bill.year}` : '';

    return NextResponse.json({
      success: true,
      message: result.deleted
        ? `Đã hủy gạch nợ và xóa hẳn giao dịch ${transaction.sepayTransId || transactionId.slice(0, 8)} của ${studentName} ${billInfo}. Hóa đơn đã hoàn lại trạng thái.`
        : `Đã hủy gạch nợ giao dịch ${transaction.sepayTransId || transactionId.slice(0, 8)} của ${studentName} ${billInfo}. Trạng thái hóa đơn đã được tính lại.`,
      data: result,
    });
  } catch (error) {
    console.error('Error voiding SePay transaction:', error);
    return NextResponse.json(
      { error: 'Lỗi khi hủy gạch nợ', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Xóa giao dịch SePay
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const cleanZero = searchParams.get('cleanZero') === 'true';
    const cleanAllUnmatched = searchParams.get('cleanAllUnmatched') === 'true';

    if (cleanZero) {
      // Dọn dẹp tất cả giao dịch 0đ hoặc chưa khớp lỗi
      const result = await prisma.paymentTransaction.deleteMany({
        where: {
          status: PaymentTransactionStatus.UNMATCHED,
          OR: [
            { amount: { lte: 0 } },
            { content: 'Không có nội dung' },
          ],
        },
      });

      broadcastChange('payment_transactions', 'DELETE', { cleanedZero: true, count: result.count });

      return NextResponse.json({
        success: true,
        message: `Đã dọn dẹp ${result.count} giao dịch 0đ không hợp lệ.`,
        deletedCount: result.count,
      });
    }

    if (cleanAllUnmatched) {
      // Xóa tất cả giao dịch chưa khớp
      const result = await prisma.paymentTransaction.deleteMany({
        where: {
          status: PaymentTransactionStatus.UNMATCHED,
        },
      });

      broadcastChange('payment_transactions', 'DELETE', { cleanedAllUnmatched: true, count: result.count });

      return NextResponse.json({
        success: true,
        message: `Đã xóa sạch ${result.count} giao dịch chưa khớp.`,
        deletedCount: result.count,
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Thiếu transaction id để xóa' }, { status: 400 });
    }

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        bill: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });
    }

    // Nếu giao dịch đang gắn với hóa đơn, tự động tính lại trạng thái hóa đơn trước khi xóa
    if (tx.billId && tx.bill) {
      const remaining = tx.bill.transactions.filter((t) => t.id !== id && !t.isVoided);
      const totalPaid = remaining.reduce((sum, t) => sum + Number(t.amount), 0);
      const finalAmount = Number(tx.bill.finalAmount);
      let newStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (totalPaid >= finalAmount && finalAmount > 0) newStatus = PaymentStatus.PAID;
      else if (totalPaid > 0) newStatus = PaymentStatus.PARTIAL;

      await prisma.monthlyBill.update({
        where: { id: tx.bill.id },
        data: { paymentStatus: newStatus },
      });

      broadcastChange('monthly_bills', 'UPDATE', {
        billId: tx.bill.id,
        studentId: tx.bill.studentId,
        paymentStatus: newStatus,
      });
    }

    await prisma.paymentTransaction.delete({
      where: { id },
    });

    broadcastChange('payment_transactions', 'DELETE', { transactionId: id });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa giao dịch thành công.',
    });
  } catch (error) {
    console.error('Error deleting SePay transaction:', error);
    return NextResponse.json(
      { error: 'Lỗi khi xóa giao dịch', details: String(error) },
      { status: 500 }
    );
  }
}
