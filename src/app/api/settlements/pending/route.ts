import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { BoardingStatus, SettlementType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase();
    const classId = searchParams.get("classId");

    // 1. Tìm tất cả học sinh đã hủy ăn bán trú
    const whereStudent: any = {
      boardingStatus: BoardingStatus.CANCELLED,
    };

    if (classId && classId !== "all") {
      whereStudent.classId = classId;
    }

    const cancelledStudents = await prisma.student.findMany({
      where: whereStudent,
      include: {
        user: {
          select: {
            fullName: true,
            username: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        settlementRecords: {
          orderBy: { settlementDate: "desc" },
          take: 1,
        },
        monthlyBills: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          include: {
            transactions: {
              where: { isVoided: false },
            },
          },
        },
      },
      orderBy: [
        { classId: "asc" },
        { studentCode: "asc" },
      ],
    });

    const pendingCollections: any[] = [];
    const pendingRefunds: any[] = [];

    for (const st of cancelledStudents) {
      // Lọc tìm kiếm nếu có từ khóa
      if (search) {
        const name = (st.user?.fullName || "").toLowerCase();
        const code = (st.studentCode || "").toLowerCase();
        const bCode = (st.boardingCode || "").toLowerCase();
        const cls = (st.class?.name || st.classId || "").toLowerCase();

        const match =
          name.includes(search) ||
          code.includes(search) ||
          bCode.includes(search) ||
          cls.includes(search);

        if (!match) continue;
      }

      const latestSettlement = st.settlementRecords?.[0] || null;

      // 1. Tính toán công nợ còn thiếu (các hóa đơn chưa trả hết)
      const unpaidBills = (st.monthlyBills || []).filter(
        (b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL"
      );

      let totalRemainingDebt = 0;
      const formattedUnpaidBills = unpaidBills.map((b) => {
        const paid = (b.transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
        const debt = Math.max(0, Number(b.finalAmount) - paid);
        totalRemainingDebt += debt;
        return {
          id: b.id,
          month: b.month,
          year: b.year,
          finalAmount: Number(b.finalAmount),
          paidAmount: paid,
          remainingDebt: debt,
          paymentStatus: b.paymentStatus,
          scheduleMealDays: b.scheduleMealDays,
        };
      }).filter((b) => b.remainingDebt > 0);

      // Nếu còn nợ tiền -> Đưa vào danh sách Chờ Thu Nợ (Thu ngân & Kế toán)
      if (totalRemainingDebt > 0) {
        pendingCollections.push({
          studentId: st.id,
          fullName: st.user?.fullName || "",
          studentCode: st.studentCode,
          boardingCode: st.boardingCode,
          className: st.class?.name || st.classId,
          boardingCancelledAt: st.boardingCancelledAt,
          totalRemainingDebt,
          unpaidBills: formattedUnpaidBills,
          settlementRecord: latestSettlement
            ? {
                id: latestSettlement.id,
                settlementType: latestSettlement.settlementType,
                actualUsedAmount: Number(latestSettlement.actualUsedAmount),
                totalPaid: Number(latestSettlement.totalPaid),
                refundOrDebt: Number(latestSettlement.refundOrDebt),
                note: latestSettlement.note,
                settlementDate: latestSettlement.settlementDate,
              }
            : null,
        });
      }

      // 2. Kiểm tra nếu có phiếu quyết toán REFUND chưa hoàn tiền -> Đưa vào danh sách Chờ Kế Toán Hoàn Tiền
      if (
        latestSettlement &&
        latestSettlement.settlementType === SettlementType.REFUND &&
        !latestSettlement.isRefunded &&
        Number(latestSettlement.refundOrDebt) > 0
      ) {
        pendingRefunds.push({
          studentId: st.id,
          settlementId: latestSettlement.id,
          fullName: st.user?.fullName || "",
          studentCode: st.studentCode,
          boardingCode: st.boardingCode,
          className: st.class?.name || st.classId,
          parentPhone: st.parentPhone,
          boardingCancelledAt: st.boardingCancelledAt,
          settlementDate: latestSettlement.settlementDate,
          refundAmount: Number(latestSettlement.refundOrDebt),
          actualUsedAmount: Number(latestSettlement.actualUsedAmount),
          totalPaid: Number(latestSettlement.totalPaid),
          note: latestSettlement.note,
          createdBy: latestSettlement.createdBy,
        });
      }
    }

    const totalPendingDebt = pendingCollections.reduce((sum, item) => sum + item.totalRemainingDebt, 0);
    const totalPendingRefund = pendingRefunds.reduce((sum, item) => sum + item.refundAmount, 0);

    return NextResponse.json({
      success: true,
      pendingCollections,
      pendingRefunds,
      stats: {
        collectionCount: pendingCollections.length,
        totalPendingDebt,
        refundCount: pendingRefunds.length,
        totalPendingRefund,
      },
    });
  } catch (error: any) {
    console.error("Error fetching pending settlements:", error);
    return NextResponse.json(
      { error: "Lỗi tải danh sách chờ quyết toán: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
