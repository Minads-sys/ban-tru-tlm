import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { SettlementType } from "@prisma/client";
import { broadcastChange } from "@/lib/realtime-hub";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Phân quyền chặt chẽ: Thu ngân KHÔNG ĐƯỢC chi/hoàn tiền. Chỉ Kế toán hoặc Admin được phép
    const allowedRoles = ["ACCOUNTANT", "ADMIN"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện chi hoàn tiền. Nghiệp vụ này do Kế toán phụ trách." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settlementId, refundMethod, refundNote } = body;

    if (!settlementId) {
      return NextResponse.json({ error: "Thiếu mã phiếu quyết toán" }, { status: 400 });
    }

    const record = await prisma.settlementRecord.findUnique({
      where: { id: settlementId },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Không tìm thấy phiếu quyết toán" }, { status: 404 });
    }

    if (record.settlementType !== SettlementType.REFUND) {
      return NextResponse.json(
        { error: "Phiếu quyết toán này không thuộc diện hoàn tiền thừa" },
        { status: 400 }
      );
    }

    if (record.isRefunded) {
      return NextResponse.json(
        { error: "Phiếu này đã được Kế toán xác nhận hoàn tiền trước đó" },
        { status: 400 }
      );
    }

    const refundAmount = Number(record.refundOrDebt);
    const accountantName = (session.user as any).name || (session.user as any).username || "Kế toán";

    // Thực thi cập nhật
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Đánh dấu đã hoàn tiền trong phiếu quyết toán
      const updatedRecord = await tx.settlementRecord.update({
        where: { id: settlementId },
        data: {
          isRefunded: true,
          refundedAt: new Date(),
          refundedBy: session.user.id,
          refundMethod: refundMethod || "TIỀN MẶT",
          refundNote: refundNote ? String(refundNote).trim() : null,
        },
      });

      // 2. Chuyển trạng thái các hóa đơn liên quan của học sinh sang SETTLED
      await tx.monthlyBill.updateMany({
        where: {
          studentId: record.studentId,
          paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        },
        data: {
          paymentStatus: "SETTLED",
        },
      });

      return updatedRecord;
    });

    // 3. Realtime Broadcast
    broadcastChange("students", "UPDATE", { id: record.studentId });
    broadcastChange("monthly_bills", "UPDATE", { studentId: record.studentId });

    // 4. Audit Log
    await logAudit({
      req: request,
      userId: session.user.id,
      userName: accountantName,
      userRole: session.user.role,
      action: AUDIT_ACTIONS.APPROVE,
      module: AUDIT_MODULES.BILLING,
      description: `Kế toán ${accountantName} xác nhận hoàn tiền ${refundAmount.toLocaleString("vi-VN")}đ cho học sinh ${record.student?.user?.fullName} (Hình thức: ${refundMethod || "Tiền mặt"})`,
      targetId: settlementId,
      metadata: {
        settlementId,
        studentId: record.studentId,
        refundAmount,
        refundMethod,
        refundNote,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xác nhận hoàn tiền ${refundAmount.toLocaleString("vi-VN")}đ cho học sinh thành công`,
      record: updated,
    });
  } catch (error: any) {
    console.error("Error processing settlement refund:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý hoàn tiền: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
