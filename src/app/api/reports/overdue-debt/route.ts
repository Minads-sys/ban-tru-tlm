import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Tìm tất cả các hóa đơn UNPAID (chưa thanh toán)
    const unpaidBills = await prisma.monthlyBill.findMany({
      where: {
        paymentStatus: "UNPAID",
        finalAmount: { gt: 0 }
      },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } }
          }
        }
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    });

    // Gom nhóm theo học sinh
    const grouped = new Map<string, any>();

    for (const bill of unpaidBills) {
      if (!grouped.has(bill.studentId)) {
        grouped.set(bill.studentId, {
          studentId: bill.studentId,
          studentName: bill.student.user?.fullName || "Không xác định",
          className: bill.student.class?.name || "Không xác định",
          unpaidCount: 0,
          totalDebt: 0,
          months: []
        });
      }
      
      const st = grouped.get(bill.studentId);
      st.unpaidCount += 1;
      st.totalDebt += Number(bill.finalAmount);
      st.months.push(`Tháng ${bill.month}/${bill.year}`);
    }

    // Lọc những học sinh nợ từ 2 tháng trở lên và sắp xếp theo số tháng nợ giảm dần, tổng tiền giảm dần
    const overdueDebts = Array.from(grouped.values())
      .filter(st => st.unpaidCount >= 2)
      .sort((a, b) => {
        if (b.unpaidCount !== a.unpaidCount) return b.unpaidCount - a.unpaidCount;
        return b.totalDebt - a.totalDebt;
      });

    return NextResponse.json({
      success: true,
      data: overdueDebts
    });
  } catch (error) {
    console.error("Overdue debt report error:", error);
    return NextResponse.json(
      { error: "Lỗi khi tải báo cáo nợ quá hạn", details: String(error) },
      { status: 500 }
    );
  }
}
