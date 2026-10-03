import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";
import { getSchoolWeekFromNumber } from "@/lib/utils";
import { BoardingStatus, ScheduleType, Prisma } from "@prisma/client";

// Mốc thời gian an toàn đóng băng dữ liệu Tháng 9
const SAFE_MIN_DATE = new Date("2026-10-01T00:00:00Z");

function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Tính toán danh sách ngày ăn và ca ăn cho một Cohort
 */
export function calculateCohortDates(cohort: {
  academicYear: number;
  startWeek: number;
  endWeek: number;
  dayOfWeek: number; // 1=T2, 2=T3, ..., 6=T7
  defaultShift: ScheduleType;
  excludedWeeks: number[];
  excludedDates: Date[] | string[];
  overrides?: Array<{ date: Date | string; overrideType: string; newShift?: ScheduleType | null }>;
}) {
  const result: Array<{
    date: Date;
    dateStr: string;
    shift: ScheduleType;
    schoolWeek: number;
    isOverride: boolean;
  }> = [];

  const excludedWeekSet = new Set(cohort.excludedWeeks || []);
  const excludedDateSet = new Set(
    (cohort.excludedDates || []).map((d) =>
      typeof d === "string" ? d.split("T")[0] : d.toISOString().split("T")[0]
    )
  );

  const overrideMap = new Map<string, { overrideType: string; newShift?: ScheduleType | null }>();
  (cohort.overrides || []).forEach((o) => {
    const key = typeof o.date === "string" ? o.date.split("T")[0] : o.date.toISOString().split("T")[0];
    overrideMap.set(key, o);
  });

  const pad = (n: number) => String(n).padStart(2, "0");

  for (let w = cohort.startWeek; w <= cohort.endWeek; w++) {
    if (excludedWeekSet.has(w)) continue;

    const weekInfo = getSchoolWeekFromNumber(w, cohort.academicYear);
    const monday = new Date(weekInfo.startDate);
    
    // cohort.dayOfWeek: 1: T2 (diff 0), 2: T3 (diff 1)... 6: T7 (diff 5)
    const dayDiff = Math.max(0, Math.min(5, cohort.dayOfWeek - 1));
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayDiff);
    targetDate.setHours(0, 0, 0, 0);

    const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

    if (excludedDateSet.has(dateStr)) continue;

    const ovr = overrideMap.get(dateStr);
    if (ovr && ovr.overrideType === "CANCEL") continue;

    const finalShift = ovr?.newShift || cohort.defaultShift;

    result.push({
      date: targetDate,
      dateStr,
      shift: finalShift,
      schoolWeek: w,
      isOverride: !!ovr,
    });
  }

  return result;
}

// GET: Lấy danh sách Lớp học phần đặc biệt
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academicYearParam = searchParams.get("academicYear");
    const academicYear = academicYearParam ? parseInt(academicYearParam, 10) : 2026;
    const semesterParam = searchParams.get("semester");
    const semester = semesterParam ? parseInt(semesterParam, 10) : undefined;

    const cohorts = await prisma.specialCohort.findMany({
      where: {
        academicYear,
        ...(semester ? { semester } : {}),
      },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: { select: { fullName: true } },
                class: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [
            { student: { classId: "asc" } },
            { student: { studentCode: "asc" } },
          ],
        },
        overrides: true,
        _count: {
          select: {
            members: true,
            meals: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { code: "asc" }],
    });

    const items = cohorts.map((c) => {
      const activeMembers = c.members.filter((m) => m.status === "ACTIVE" && m.student?.boardingStatus === BoardingStatus.ACTIVE);
      const calculatedDates = calculateCohortDates(c);
      
      const sepDates = calculatedDates.filter((d) => d.date < SAFE_MIN_DATE);
      const octAndFutureDates = calculatedDates.filter((d) => d.date >= SAFE_MIN_DATE);

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description || "",
        academicYear: c.academicYear,
        semester: c.semester,
        dayOfWeek: c.dayOfWeek,
        dayOfWeekLabel: `Thứ ${c.dayOfWeek + 1}`,
        defaultShift: c.defaultShift,
        startWeek: c.startWeek,
        endWeek: c.endWeek,
        excludedWeeks: c.excludedWeeks,
        excludedDates: c.excludedDates.map((d) => d.toISOString().split("T")[0]),
        isActive: c.isActive,
        createdAt: c.createdAt,
        totalMembersCount: activeMembers.length,
        totalMealsCount: c._count.meals,
        calculatedDatesCount: calculatedDates.length,
        sepDatesCount: sepDates.length,
        futureDatesCount: octAndFutureDates.length,
        members: activeMembers.map((m) => ({
          memberId: m.id,
          studentId: m.studentId,
          studentCode: m.student.studentCode,
          boardingCode: m.student.boardingCode || "—",
          fullName: m.student.user.fullName,
          classId: m.student.classId,
          className: m.student.class.name,
          mealType: m.student.mealType,
          status: m.status,
          joinedDate: m.joinedDate,
        })),
        overrides: c.overrides.map((o) => ({
          id: o.id,
          dateStr: o.date.toISOString().split("T")[0],
          overrideType: o.overrideType,
          newShift: o.newShift,
          reason: o.reason,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      academicYear,
      cohorts: items,
    });
  } catch (error: unknown) {
    console.error("Lỗi khi lấy danh sách Special Cohorts:", error);
    const msg = error instanceof Error ? error.message : "Lỗi hệ thống";
    return NextResponse.json(
      { error: "Không thể tải danh sách lớp học phần đặc biệt", details: msg },
      { status: 500 }
    );
  }
}

// POST: Tạo mới Lớp học phần đặc biệt & Tự động đồng bộ suất ăn
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "CASHIER" || session.user.role === "ACCOUNTANT") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      code,
      description,
      academicYear = 2026,
      semester = 1,
      dayOfWeek = 2, // 1=T2, 2=T3
      defaultShift = "TIET_5",
      startWeek = 1,
      endWeek = 18,
      excludedWeeks = [],
      excludedDates = [],
      studentIds = [],
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên lớp học phần" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = (code && typeof code === "string" && code.trim()) ? slugify(code) : slugify(cleanName);

    // Kiểm tra trùng code
    const existing = await prisma.specialCohort.findUnique({ where: { code: cleanCode } });
    if (existing) {
      return NextResponse.json(
        { error: `Mã lớp học phần '${cleanCode}' đã tồn tại. Vui lòng chọn mã khác.` },
        { status: 400 }
      );
    }

    // Lọc danh sách học sinh: BẮT BUỘC ACTIVE BÁN TRÚ
    const activeStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        boardingStatus: BoardingStatus.ACTIVE,
      },
      select: { id: true, studentCode: true, classId: true },
    });

    // 1. Tạo Cohort trong DB
    const cohort = await prisma.specialCohort.create({
      data: {
        code: cleanCode,
        name: cleanName,
        description: description || null,
        academicYear,
        semester,
        dayOfWeek,
        defaultShift,
        startWeek,
        endWeek,
        excludedWeeks: Array.isArray(excludedWeeks) ? excludedWeeks : [],
        excludedDates: Array.isArray(excludedDates)
          ? excludedDates.map((d: string) => new Date(d + "T00:00:00Z"))
          : [],
        isActive: true,
      },
    });

    // 2. Tạo thành viên SpecialCohortMember
    if (activeStudents.length > 0) {
      await prisma.specialCohortMember.createMany({
        data: activeStudents.map((s) => ({
          cohortId: cohort.id,
          studentId: s.id,
          status: "ACTIVE",
        })),
        skipDuplicates: true,
      });
    }

    // 3. Tính toán ngày ăn và sinh vào StudentSpecialMeal (chỉ cho ngày >= SAFE_MIN_DATE)
    const dates = calculateCohortDates({
      academicYear,
      startWeek,
      endWeek,
      dayOfWeek,
      defaultShift,
      excludedWeeks,
      excludedDates,
    });

    const futureDates = dates.filter((d) => d.date >= SAFE_MIN_DATE);
    let syncedMealsCount = 0;

    for (const s of activeStudents) {
      for (const fd of futureDates) {
        await prisma.studentSpecialMeal.upsert({
          where: {
            studentId_date: {
              studentId: s.id,
              date: fd.date,
            },
          },
          update: {
            shift: fd.shift,
            scheduleName: cleanName,
            cohortId: cohort.id,
            source: "COHORT",
          },
          create: {
            studentId: s.id,
            date: fd.date,
            shift: fd.shift,
            scheduleName: cleanName,
            cohortId: cohort.id,
            source: "COHORT",
          },
        });
        syncedMealsCount++;
      }
    }

    const userMeta = session.user as { name?: string; username?: string };
    await logAudit({
      req: request,
      userId: session.user.id,
      userName: userMeta.name || userMeta.username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.SCHEDULE,
      description: `Tạo Lớp học phần đặc biệt '${cleanName}' (${cleanCode}) với ${activeStudents.length} học sinh, sinh ${syncedMealsCount} suất ăn từ 01/10`,
      metadata: { cohortId: cohort.id, code: cleanCode, memberCount: activeStudents.length, syncedMealsCount },
    });

    return NextResponse.json({
      success: true,
      message: `Đã tạo thành công lớp học phần '${cleanName}' với ${activeStudents.length} học sinh và ${syncedMealsCount} suất ăn`,
      cohort,
    });
  } catch (error: unknown) {
    console.error("Lỗi khi tạo Special Cohort:", error);
    const msg = error instanceof Error ? error.message : "Lỗi hệ thống";
    return NextResponse.json(
      { error: "Không thể tạo lớp học phần đặc biệt", details: msg },
      { status: 500 }
    );
  }
}

// PATCH: Cập nhật Lớp học phần (Đổi thông tin, thêm/bớt học sinh, cài đặt ngoại lệ)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "CASHIER" || session.user.role === "ACCOUNTANT") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      dayOfWeek,
      defaultShift,
      startWeek,
      endWeek,
      excludedWeeks,
      excludedDates,
      isActive,
      addStudentIds,
      removeStudentIds,
      overrides, // [{ date: "YYYY-MM-DD", overrideType: "CANCEL"|"SHIFT_CHANGE", newShift, reason }]
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lớp học phần" }, { status: 400 });
    }

    const existing = await prisma.specialCohort.findUnique({
      where: { id },
      include: { members: true, overrides: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy lớp học phần" }, { status: 404 });
    }

    // 1. Cập nhật thông tin chung nếu có
    const updateData: Prisma.SpecialCohortUpdateInput = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (defaultShift) updateData.defaultShift = defaultShift;
    if (startWeek !== undefined) updateData.startWeek = startWeek;
    if (endWeek !== undefined) updateData.endWeek = endWeek;
    if (excludedWeeks !== undefined) updateData.excludedWeeks = excludedWeeks;
    if (excludedDates !== undefined) {
      updateData.excludedDates = excludedDates.map((d: string) => new Date(d + "T00:00:00Z"));
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCohort = await prisma.specialCohort.update({
      where: { id },
      data: updateData,
    });

    // 2. Thêm học sinh mới (nếu có) - Chỉ nhận ACTIVE bán trú
    if (Array.isArray(addStudentIds) && addStudentIds.length > 0) {
      const validStudents = await prisma.student.findMany({
        where: {
          id: { in: addStudentIds },
          boardingStatus: BoardingStatus.ACTIVE,
        },
        select: { id: true },
      });

      for (const s of validStudents) {
        await prisma.specialCohortMember.upsert({
          where: { cohortId_studentId: { cohortId: id, studentId: s.id } },
          update: { status: "ACTIVE", leftDate: null },
          create: { cohortId: id, studentId: s.id, status: "ACTIVE" },
        });
      }
    }

    // 3. Xóa / dừng tham gia học sinh (nếu có)
    if (Array.isArray(removeStudentIds) && removeStudentIds.length > 0) {
      await prisma.specialCohortMember.updateMany({
        where: { cohortId: id, studentId: { in: removeStudentIds } },
        data: { status: "LEFT", leftDate: new Date() },
      });

      // Xóa các ngày ăn trong tương lai (>= SAFE_MIN_DATE) của những học sinh bị xóa
      await prisma.studentSpecialMeal.deleteMany({
        where: {
          cohortId: id,
          studentId: { in: removeStudentIds },
          date: { gte: SAFE_MIN_DATE },
        },
      });
    }

    // 4. Cập nhật Overrides nếu có
    if (Array.isArray(overrides)) {
      for (const ovr of overrides) {
        const dObj = new Date(ovr.date + "T00:00:00Z");
        if (dObj < SAFE_MIN_DATE) continue; // Khóa bảo vệ Tháng 9

        if (ovr.overrideType === "DELETE") {
          await prisma.specialCohortOverride.deleteMany({
            where: { cohortId: id, date: dObj },
          });
        } else {
          await prisma.specialCohortOverride.upsert({
            where: { cohortId_date: { cohortId: id, date: dObj } },
            update: {
              overrideType: ovr.overrideType,
              newShift: ovr.newShift || null,
              reason: ovr.reason || null,
            },
            create: {
              cohortId: id,
              date: dObj,
              overrideType: ovr.overrideType,
              newShift: ovr.newShift || null,
              reason: ovr.reason || null,
            },
          });
        }
      }
    }

    // 5. Đồng bộ lại toàn bộ ngày ăn cho các thành viên ACTIVE (Chỉ từ SAFE_MIN_DATE trở đi)
    const currentCohortWithOverrides = await prisma.specialCohort.findUnique({
      where: { id },
      include: {
        overrides: true,
        members: {
          where: { status: "ACTIVE" },
          include: { student: { select: { id: true, boardingStatus: true } } },
        },
      },
    });

    if (currentCohortWithOverrides) {
      const activeMembers = currentCohortWithOverrides.members.filter(
        (m) => m.student.boardingStatus === BoardingStatus.ACTIVE
      );

      const calculatedDates = calculateCohortDates(currentCohortWithOverrides);
      const futureDates = calculatedDates.filter((d) => d.date >= SAFE_MIN_DATE);

      // Xóa các ngày ăn trong tương lai không còn thuộc danh sách ngày hợp lệ
      await prisma.studentSpecialMeal.deleteMany({
        where: {
          cohortId: id,
          date: {
            gte: SAFE_MIN_DATE,
            notIn: futureDates.map((d) => d.date),
          },
        },
      });

      // Upsert các ngày ăn mới/cập nhật
      for (const m of activeMembers) {
        for (const fd of futureDates) {
          await prisma.studentSpecialMeal.upsert({
            where: {
              studentId_date: {
                studentId: m.studentId,
                date: fd.date,
              },
            },
            update: {
              shift: fd.shift,
              scheduleName: currentCohortWithOverrides.name,
              cohortId: id,
              source: "COHORT",
            },
            create: {
              studentId: m.studentId,
              date: fd.date,
              shift: fd.shift,
              scheduleName: currentCohortWithOverrides.name,
              cohortId: id,
              source: "COHORT",
            },
          });
        }
      }
    }

    const userMeta = session.user as { name?: string; username?: string };
    await logAudit({
      req: request,
      userId: session.user.id,
      userName: userMeta.name || userMeta.username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.SCHEDULE,
      description: `Cập nhật Lớp học phần đặc biệt '${updatedCohort.name}' (${updatedCohort.code})`,
      metadata: { cohortId: id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật thành công lớp học phần '${updatedCohort.name}'`,
      cohort: updatedCohort,
    });
  } catch (error: unknown) {
    console.error("Lỗi khi cập nhật Special Cohort:", error);
    const msg = error instanceof Error ? error.message : "Lỗi hệ thống";
    return NextResponse.json(
      { error: "Không thể cập nhật lớp học phần đặc biệt", details: msg },
      { status: 500 }
    );
  }
}

// DELETE: Xóa hoặc ngưng hoạt động Lớp học phần
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (session.user.role === "CASHIER" || session.user.role === "ACCOUNTANT") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lớp học phần" }, { status: 400 });
    }

    const cohort = await prisma.specialCohort.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            meals: { where: { date: { lt: SAFE_MIN_DATE } } },
          },
        },
      },
    });

    if (!cohort) {
      return NextResponse.json({ error: "Không tìm thấy lớp học phần" }, { status: 404 });
    }

    const historicalMealsCount = cohort._count.meals;

    // Xóa các ngày ăn tương lai (>= SAFE_MIN_DATE)
    const deletedFuture = await prisma.studentSpecialMeal.deleteMany({
      where: {
        cohortId: id,
        date: { gte: SAFE_MIN_DATE },
      },
    });

    const userMeta = session.user as { name?: string; username?: string };

    if (historicalMealsCount > 0) {
      // Có dữ liệu Tháng 9: KHÔNG XÓA HẲN mà chỉ chuyển sang isActive = false và gỡ liên kết tương lai
      await prisma.specialCohort.update({
        where: { id },
        data: { isActive: false },
      });

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: userMeta.name || userMeta.username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.UPDATE,
        module: AUDIT_MODULES.SCHEDULE,
        description: `Ngưng hoạt động lớp học phần '${cohort.name}' (Giữ lại ${historicalMealsCount} suất Tháng 9, đã xóa ${deletedFuture.count} suất tương lai)`,
        metadata: { id, historicalMealsCount, deletedFutureCount: deletedFuture.count },
      });

      return NextResponse.json({
        success: true,
        message: `Lớp học phần '${cohort.name}' có ${historicalMealsCount} suất ăn Tháng 9 đã khóa sổ nên được chuyển sang trạng thái 'Ngưng hoạt động' để bảo toàn dữ liệu lịch sử. Đã xóa ${deletedFuture.count} suất ăn tương lai.`,
      });
    }

    // Nếu không có dữ liệu quá khứ -> Xóa hoàn toàn
    await prisma.specialCohort.delete({ where: { id } });

    await logAudit({
      req: request,
      userId: session.user.id,
      userName: userMeta.name || userMeta.username || "Quản trị viên",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.DELETE,
      module: AUDIT_MODULES.SCHEDULE,
      description: `Xóa hoàn toàn lớp học phần '${cohort.name}' (${cohort.code})`,
      metadata: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa thành công lớp học phần '${cohort.name}'`,
    });
  } catch (error: unknown) {
    console.error("Lỗi khi xóa Special Cohort:", error);
    const msg = error instanceof Error ? error.message : "Lỗi hệ thống";
    return NextResponse.json(
      { error: "Không thể xóa lớp học phần đặc biệt", details: msg },
      { status: 500 }
    );
  }
}
