// API Route: Dò tìm và Hợp nhất học sinh nghi ngờ trùng lặp
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { removeVietnameseTones } from "@/lib/utils";
import { broadcastChange } from "@/lib/realtime-hub";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

// GET: Quét và trả về danh sách các nhóm học sinh nghi ngờ trùng lặp
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const students = await prisma.student.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            username: true,
            isActive: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        monthlyBills: {
          select: {
            id: true,
            month: true,
            year: true,
            finalAmount: true,
            paymentStatus: true,
          },
        },
        paymentTransactions: {
          where: { isVoided: false },
          select: {
            id: true,
            amount: true,
          },
        },
        mealCancellations: {
          select: { id: true },
        },
      },
      orderBy: [{ classId: "asc" }, { id: "asc" }],
    });

    // Cấu trúc nhóm trùng lặp
    interface DuplicateCandidate {
      id: string;
      studentCode: string;
      boardingCode: string | null;
      fullName: string;
      className: string;
      classId: string;
      birthDate: string | null;
      parentPhone: string | null;
      boardingStatus: string;
      totalBills: number;
      totalTransactions: number;
      totalPaidAmount: number;
    }

    interface DuplicateGroup {
      groupId: string;
      matchType: "CCCD" | "NAME_CLASS" | "NAME_PHONE" | "NAME_BIRTH";
      matchReason: string;
      students: DuplicateCandidate[];
    }

    const groups: DuplicateGroup[] = [];
    const groupedPairs = new Set<string>();

    const formatStudent = (s: (typeof students)[0]): DuplicateCandidate => ({
      id: s.id,
      studentCode: s.studentCode,
      boardingCode: s.boardingCode,
      fullName: s.user?.fullName || "",
      className: s.class?.name || s.classId,
      classId: s.classId,
      birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : null,
      parentPhone: s.parentPhone,
      boardingStatus: s.boardingStatus,
      totalBills: s.monthlyBills.length,
      totalTransactions: s.paymentTransactions.length,
      totalPaidAmount: s.paymentTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
    });

    const normalizeName = (name: string) =>
      removeVietnameseTones(name || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    // 1. Tiêu chí 1: Trùng số CCCD sau khi chuẩn hóa 12 số (bù số 0 đầu)
    const cccdMap = new Map<string, typeof students>();
    for (const s of students) {
      const normCCCD = s.studentCode.trim().padStart(12, "0");
      if (!cccdMap.has(normCCCD)) cccdMap.set(normCCCD, []);
      cccdMap.get(normCCCD)!.push(s);
    }

    for (const [normCCCD, list] of cccdMap.entries()) {
      if (list.length > 1) {
        const pairKey = list.map((x) => x.id).sort().join("_");
        groupedPairs.add(pairKey);
        groups.push({
          groupId: `CCCD_${normCCCD}`,
          matchType: "CCCD",
          matchReason: `Trùng số CCCD sau khi chuẩn hóa 12 số (${normCCCD})`,
          students: list.map(formatStudent),
        });
      }
    }

    // 2. Tiêu chí 2: Trùng Họ tên + Lớp học
    const nameClassMap = new Map<string, typeof students>();
    for (const s of students) {
      const normName = normalizeName(s.user?.fullName);
      if (!normName) continue;
      const key = `${normName}::${s.classId}`;
      if (!nameClassMap.has(key)) nameClassMap.set(key, []);
      nameClassMap.get(key)!.push(s);
    }

    for (const [key, list] of nameClassMap.entries()) {
      if (list.length > 1) {
        const pairKey = list.map((x) => x.id).sort().join("_");
        if (!groupedPairs.has(pairKey)) {
          groupedPairs.add(pairKey);
          const className = list[0].class?.name || list[0].classId;
          groups.push({
            groupId: `NAME_CLASS_${list[0].id}_${list[1].id}`,
            matchType: "NAME_CLASS",
            matchReason: `Trùng Họ tên ("${list[0].user?.fullName}") và cùng học Lớp ${className}`,
            students: list.map(formatStudent),
          });
        }
      }
    }

    // 3. Tiêu chí 3: Trùng Họ tên + Số điện thoại phụ huynh
    const namePhoneMap = new Map<string, typeof students>();
    for (const s of students) {
      const normName = normalizeName(s.user?.fullName);
      const cleanPhone = (s.parentPhone || "").replace(/\D/g, "");
      if (!normName || cleanPhone.length < 9) continue;
      const key = `${normName}::${cleanPhone}`;
      if (!namePhoneMap.has(key)) namePhoneMap.set(key, []);
      namePhoneMap.get(key)!.push(s);
    }

    for (const [key, list] of namePhoneMap.entries()) {
      if (list.length > 1) {
        const pairKey = list.map((x) => x.id).sort().join("_");
        if (!groupedPairs.has(pairKey)) {
          groupedPairs.add(pairKey);
          groups.push({
            groupId: `NAME_PHONE_${list[0].id}_${list[1].id}`,
            matchType: "NAME_PHONE",
            matchReason: `Trùng Họ tên ("${list[0].user?.fullName}") và cùng SĐT Phụ huynh (${list[0].parentPhone})`,
            students: list.map(formatStudent),
          });
        }
      }
    }

    // 4. Tiêu chí 4: Trùng Họ tên + Ngày sinh
    const nameBirthMap = new Map<string, typeof students>();
    for (const s of students) {
      const normName = normalizeName(s.user?.fullName);
      if (!normName || !s.birthDate) continue;
      const bStr = s.birthDate.toISOString().slice(0, 10);
      const key = `${normName}::${bStr}`;
      if (!nameBirthMap.has(key)) nameBirthMap.set(key, []);
      nameBirthMap.get(key)!.push(s);
    }

    for (const [key, list] of nameBirthMap.entries()) {
      if (list.length > 1) {
        const pairKey = list.map((x) => x.id).sort().join("_");
        if (!groupedPairs.has(pairKey)) {
          groupedPairs.add(pairKey);
          const bDisplay = list[0].birthDate ? new Date(list[0].birthDate).toLocaleDateString("vi-VN", { timeZone: "UTC" }) : "";
          groups.push({
            groupId: `NAME_BIRTH_${list[0].id}_${list[1].id}`,
            matchType: "NAME_BIRTH",
            matchReason: `Trùng Họ tên ("${list[0].user?.fullName}") và cùng Ngày sinh (${bDisplay})`,
            students: list.map(formatStudent),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalStudents: students.length,
      duplicateGroupsCount: groups.length,
      groups,
    });
  } catch (error) {
    console.error("Duplicate scan error:", error);
    return NextResponse.json(
      { error: "Lỗi khi dò tìm học sinh trùng lặp", details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Hợp nhất 2 học sinh bị trùng lặp (Merge)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role === "ACCOUNTANT") {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const { primaryStudentId, secondaryStudentId } = body;

    if (!primaryStudentId || !secondaryStudentId) {
      return NextResponse.json({ error: "Thiếu ID học sinh cần hợp nhất" }, { status: 400 });
    }

    if (primaryStudentId === secondaryStudentId) {
      return NextResponse.json({ error: "Không thể hợp nhất học sinh với chính mình" }, { status: 400 });
    }

    const primaryStudent = await prisma.student.findUnique({
      where: { id: primaryStudentId },
      include: {
        user: true,
        monthlyBills: { include: { transactions: true } },
        paymentTransactions: true,
        mealCancellations: true,
        mealOverrides: true,
        specialMeals: true,
      },
    });

    const secondaryStudent = await prisma.student.findUnique({
      where: { id: secondaryStudentId },
      include: {
        user: true,
        monthlyBills: { include: { transactions: true } },
        paymentTransactions: true,
        mealCancellations: true,
        mealOverrides: true,
        specialMeals: true,
      },
    });

    if (!primaryStudent || !secondaryStudent) {
      return NextResponse.json({ error: "Không tìm thấy một trong hai học sinh" }, { status: 404 });
    }

    // Chuẩn hóa CCCD của hồ sơ chính về 12 số
    let normalizedCCCD = primaryStudent.studentCode.trim();
    if (/^\d{1,11}$/.test(normalizedCCCD)) {
      normalizedCCCD = normalizedCCCD.padStart(12, "0");
    } else if (/^\d{1,11}$/.test(secondaryStudent.studentCode.trim())) {
      normalizedCCCD = secondaryStudent.studentCode.trim().padStart(12, "0");
    }

    // Thực thi hợp nhất trong Prisma Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Chuyển PaymentTransaction
      if (secondaryStudent.paymentTransactions.length > 0) {
        await tx.paymentTransaction.updateMany({
          where: { studentId: secondaryStudent.id },
          data: { studentId: primaryStudent.id },
        });
      }

      // 2. Chuyển MealCancellation
      for (const cancel of secondaryStudent.mealCancellations) {
        const existingInPrimary = await tx.mealCancellation.findUnique({
          where: {
            studentId_cancelDate: {
              studentId: primaryStudent.id,
              cancelDate: cancel.cancelDate,
            },
          },
        });

        if (!existingInPrimary) {
          await tx.mealCancellation.update({
            where: { id: cancel.id },
            data: { studentId: primaryStudent.id },
          });
        } else {
          await tx.mealCancellation.delete({ where: { id: cancel.id } });
        }
      }

      // 3. Chuyển MealOverride & StudentSpecialMeal
      for (const mo of secondaryStudent.mealOverrides) {
        const exist = await tx.mealOverride.findUnique({
          where: { studentId_date: { studentId: primaryStudent.id, date: mo.date } },
        });
        if (!exist) {
          await tx.mealOverride.update({ where: { id: mo.id }, data: { studentId: primaryStudent.id } });
        } else {
          await tx.mealOverride.delete({ where: { id: mo.id } });
        }
      }

      for (const sm of secondaryStudent.specialMeals) {
        const exist = await tx.studentSpecialMeal.findUnique({
          where: { studentId_date: { studentId: primaryStudent.id, date: sm.date } },
        });
        if (!exist) {
          await tx.studentSpecialMeal.update({ where: { id: sm.id }, data: { studentId: primaryStudent.id } });
        } else {
          await tx.studentSpecialMeal.delete({ where: { id: sm.id } });
        }
      }

      // 4. Chuyển / Hợp nhất MonthlyBill
      for (const secBill of secondaryStudent.monthlyBills) {
        const priBill = await tx.monthlyBill.findUnique({
          where: {
            studentId_month_year: {
              studentId: primaryStudent.id,
              month: secBill.month,
              year: secBill.year,
            },
          },
          include: { transactions: true },
        });

        if (!priBill) {
          await tx.monthlyBill.update({
            where: { id: secBill.id },
            data: { studentId: primaryStudent.id },
          });
        } else {
          await tx.paymentTransaction.updateMany({
            where: { billId: secBill.id },
            data: { billId: priBill.id, studentId: primaryStudent.id },
          });

          await tx.monthlyBill.delete({ where: { id: secBill.id } });

          const allPriTrans = await tx.paymentTransaction.findMany({
            where: { billId: priBill.id, isVoided: false },
          });
          const totalPaid = allPriTrans.reduce((s, t) => s + Number(t.amount), 0);
          if (totalPaid >= Number(priBill.finalAmount) && Number(priBill.finalAmount) > 0) {
            await tx.monthlyBill.update({
              where: { id: priBill.id },
              data: { paymentStatus: "PAID" },
            });
          }
        }
      }

      // 5. Cập nhật hồ sơ chính CCCD đủ 12 số
      await tx.student.update({
        where: { id: primaryStudent.id },
        data: {
          studentCode: normalizedCCCD,
        },
      });

      if (primaryStudent.user && /^\d{11,12}$/.test(primaryStudent.user.username)) {
        await tx.user.update({
          where: { id: primaryStudent.userId },
          data: { username: normalizedCCCD.toLowerCase() },
        });
      }

      // 6. Xóa hồ sơ phụ và User phụ
      await tx.student.delete({ where: { id: secondaryStudent.id } });
      await tx.user.delete({ where: { id: secondaryStudent.userId } });
    });

    broadcastChange("students", "DELETE", { studentId: secondaryStudent.id });
    broadcastChange("students", "UPDATE", { id: primaryStudent.id });
    broadcastChange("monthly_bills", "UPDATE");
    broadcastChange("daily_meals", "UPDATE");

    await logAudit({
      req: request,
      userId: session.user.id,
      userName: (session.user as any)?.name || (session.user as any)?.username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.STUDENTS,
      description: `Hợp nhất học sinh trùng lặp: Gộp hồ sơ ${secondaryStudent.user?.fullName} (${secondaryStudent.studentCode}) vào hồ sơ chính ${primaryStudent.user?.fullName} (${primaryStudent.studentCode} -> ${normalizedCCCD})`,
      targetId: primaryStudent.id,
      metadata: {
        primaryId: primaryStudent.id,
        secondaryId: secondaryStudent.id,
        primaryCode: primaryStudent.studentCode,
        secondaryCode: secondaryStudent.studentCode,
        normalizedCCCD,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã hợp nhất thành công hồ sơ vào học sinh ${primaryStudent.user?.fullName} (${normalizedCCCD}).`,
    });
  } catch (error) {
    console.error("Merge duplicate error:", error);
    return NextResponse.json(
      { error: "Lỗi khi hợp nhất học sinh", details: String(error) },
      { status: 500 }
    );
  }
}
