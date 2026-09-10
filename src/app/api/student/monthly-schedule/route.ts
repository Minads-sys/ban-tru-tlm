import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { getWeekNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let studentId = searchParams.get("studentId");
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    // Nếu không truyền studentId, lấy studentId từ tài khoản đang đăng nhập
    if (!studentId) {
      studentId = (session.user as any).studentId;
    }

    if (!studentId) {
      return NextResponse.json({ error: "Thiếu mã học sinh" }, { status: 400 });
    }

    // Bảo mật: Nếu tài khoản là học sinh, chỉ được xem thông tin của chính mình
    if (session.user.role === "STUDENT" && (session.user as any).studentId !== studentId) {
      return NextResponse.json(
        { error: "Bạn không có quyền xem thông tin của học sinh khác" },
        { status: 403 }
      );
    }

    // Tính toán thời gian hôm nay theo giờ Việt Nam (UTC+7)
    const nowUtc = new Date();
    const vnNow = new Date(nowUtc.getTime() + 7 * 3600 * 1000);
    const currentVnYear = vnNow.getUTCFullYear();
    const currentVnMonth = vnNow.getUTCMonth() + 1;
    const todayStr = `${currentVnYear}-${String(currentVnMonth).padStart(2, "0")}-${String(vnNow.getUTCDate()).padStart(2, "0")}`;

    const year = yearParam ? parseInt(yearParam, 10) : currentVnYear;
    const month = monthParam ? parseInt(monthParam, 10) : currentVnMonth;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Tháng hoặc năm không hợp lệ" }, { status: 400 });
    }

    // 1. Lấy thông tin học sinh
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { fullName: true, username: true } },
        class: { select: { id: true, name: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy thông tin học sinh" }, { status: 404 });
    }

    // 2. Phạm vi ngày trong tháng đang chọn
    const firstDayUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const lastDayOfMonthNum = new Date(year, month, 0).getDate();
    const lastDayUtc = new Date(Date.UTC(year, month - 1, lastDayOfMonthNum, 23, 59, 59, 999));

    // 3. Truy vấn dữ liệu đồng bộ
    const [weeklySchedules, specialMeals, cancellations, overrides, savedCourts] = await Promise.all([
      prisma.classWeeklySchedule.findMany({
        where: {
          classId: student.classId,
          year: year,
        },
      }),
      prisma.studentSpecialMeal.findMany({
        where: {
          studentId: student.id,
          date: {
            gte: firstDayUtc,
            lte: lastDayUtc,
          },
        },
      }),
      prisma.mealCancellation.findMany({
        where: {
          studentId: student.id,
          cancelDate: {
            gte: firstDayUtc,
            lte: lastDayUtc,
          },
        },
      }),
      prisma.mealOverride.findMany({
        where: {
          studentId: student.id,
          date: {
            gte: firstDayUtc,
            lte: lastDayUtc,
          },
        },
      }),
      prisma.dailyDiningCourt.findMany({
        where: {
          date: {
            gte: firstDayUtc,
            lte: lastDayUtc,
          },
        },
        orderBy: [
          { shift: "asc" },
          { courtNumber: "asc" },
        ],
      }),
    ]);

    // Tạo Map tra cứu
    const scheduleByWeek = new Map<number, (typeof weeklySchedules)[0]>();
    for (const ws of weeklySchedules) {
      scheduleByWeek.set(ws.weekNumber, ws);
    }

    const specialMealMap = new Map<string, (typeof specialMeals)[0]>();
    for (const sm of specialMeals) {
      const d = new Date(sm.date);
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      specialMealMap.set(dStr, sm);
    }

    const cancellationMap = new Map<string, (typeof cancellations)[0]>();
    for (const mc of cancellations) {
      const d = new Date(mc.cancelDate);
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      cancellationMap.set(dStr, mc);
    }

    const overrideMap = new Map<string, (typeof overrides)[0]>();
    for (const mo of overrides) {
      const d = new Date(mo.date);
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      overrideMap.set(dStr, mo);
    }

    const courtsByDate = new Map<string, typeof savedCourts>();
    for (const sc of savedCourts) {
      const d = new Date(sc.date);
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (!courtsByDate.has(dStr)) {
        courtsByDate.set(dStr, []);
      }
      courtsByDate.get(dStr)!.push(sc);
    }

    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayFields = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // 4. Lập dữ liệu cho từng ngày trong tháng
    const days: any[] = [];
    let totalScheduledDays = 0;
    let totalMealDays = 0;
    let totalCanceledDays = 0;
    let totalPendingCanceledDays = 0;
    let totalSpecialMealDays = 0;

    for (let dayNum = 1; dayNum <= lastDayOfMonthNum; dayNum++) {
      const dateObj = new Date(Date.UTC(year, month - 1, dayNum));
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dow = dateObj.getUTCDay(); // 0 = CN, 1 = T2..
      const dowName = dayNames[dow];
      const isSunday = dow === 0;
      const isSaturday = dow === 6;
      const isWeekend = isSunday || isSaturday;
      const isToday = dateStr === todayStr;

      const weekNumber = getWeekNumber(dateObj);
      const dayField = dayFields[dow];

      // A. Kiểm tra lịch đặc biệt trước
      const specialMeal = specialMealMap.get(dateStr);
      // B. Kiểm tra TKB lớp
      const classSchedule = scheduleByWeek.get(weekNumber);
      const classShift = (!isSunday && dayField && classSchedule)
        ? (classSchedule as any)[dayField]
        : "NONE";

      let hasMeal = false;
      let mealCategory: "SPECIAL" | "REGULAR" | "NONE" = "NONE";
      let scheduleName = "";
      let shift: "TIET_4" | "TIET_5" | null = null;
      let shiftName = "";

      if (specialMeal && (specialMeal.shift === "TIET_4" || specialMeal.shift === "TIET_5")) {
        hasMeal = true;
        mealCategory = "SPECIAL";
        scheduleName = specialMeal.scheduleName;
        shift = specialMeal.shift as "TIET_4" | "TIET_5";
        shiftName = shift === "TIET_4" ? "Ca Tiết 4 (10:15)" : "Ca Tiết 5 (11:00)";
        totalSpecialMealDays++;
      } else if (classShift === "TIET_4" || classShift === "TIET_5") {
        hasMeal = true;
        mealCategory = "REGULAR";
        scheduleName = `Lịch thường (${student.class?.name || student.classId})`;
        shift = classShift;
        shiftName = shift === "TIET_4" ? "Ca Tiết 4 (10:15)" : "Ca Tiết 5 (11:00)";
      }

      if (hasMeal) {
        totalScheduledDays++;
      }

      // C. Kiểm tra đơn cắt suất
      const cancellation = cancellationMap.get(dateStr);
      let cancellationInfo: any = null;
      if (cancellation) {
        let statusText = "Chờ duyệt";
        let cancellationNote = "<Cắt suất / Chờ duyệt>";
        if (cancellation.status === "APPROVED") {
          statusText = "Đã duyệt";
          cancellationNote = "<Cắt suất / Đã duyệt>";
          totalCanceledDays++;
        } else if (cancellation.status === "REJECTED") {
          statusText = "Từ chối";
          cancellationNote = "<Cắt suất / Từ chối>";
        } else {
          totalPendingCanceledDays++;
        }

        cancellationInfo = {
          id: cancellation.id,
          status: cancellation.status,
          statusText,
          cancellationNote,
          reason: cancellation.reason,
          createdAt: cancellation.createdAt,
        };
      }

      if (hasMeal && (!cancellation || cancellation.status !== "APPROVED")) {
        totalMealDays++;
      }

      // D. Kiểm tra chế độ ăn (Mặn / Chay / Cháo) & Đổi món
      const override = overrideMap.get(dateStr);
      const effectiveMealType = override ? override.mealType : student.mealType;
      const isMealOverridden = !!override;
      const mealTypeName =
        effectiveMealType === "CHAY"
          ? "Cơm Chay"
          : effectiveMealType === "CHAO"
          ? "Cháo"
          : "Cơm Mặn";

      // E. Tra cứu Sân ăn
      let courtInfo: any = null;
      const dayCourts = courtsByDate.get(dateStr) || [];

      if (hasMeal && shift && dayCourts.length > 0) {
        let matchedCourt: (typeof dayCourts)[0] | undefined;

        if (mealCategory === "SPECIAL") {
          // Lớp ảo đặc biệt: tìm sân có chứa scheduleName và shift
          matchedCourt = dayCourts.find(
            (c) =>
              c.shift === shift &&
              c.classIds.some(
                (cid) =>
                  cid.startsWith(`SPECIAL::${scheduleName}::${shift}`) ||
                  cid.includes(scheduleName)
              )
          );
        } else {
          // Lớp thường: tìm sân chứa mã lớp gốc
          matchedCourt = dayCourts.find(
            (c) => c.shift === shift && c.classIds.includes(student.classId)
          );
        }

        if (matchedCourt) {
          const cartNum = matchedCourt.cartNumber || Math.ceil(matchedCourt.courtNumber / 2);
          courtInfo = {
            courtNumber: matchedCourt.courtNumber,
            courtName: matchedCourt.courtName,
            cartNumber: cartNum,
            cartName: matchedCourt.cartName || `Xe ${cartNum}`,
            shift: matchedCourt.shift,
          };
        }
      }

      days.push({
        dateStr,
        dayNum,
        dow,
        dowName,
        isSunday,
        isSaturday,
        isWeekend,
        isToday,
        weekNumber,
        hasMeal,
        mealCategory,
        scheduleName,
        shift,
        shiftName,
        mealType: effectiveMealType,
        mealTypeName,
        isMealOverridden,
        cancellation: cancellationInfo,
        court: courtInfo,
      });
    }

    // 5. Lấy riêng thông tin hôm nay (Today Info)
    // Nếu hôm nay nằm trong tháng đang xem, lấy trực tiếp từ days
    // Nếu hôm nay nằm ở tháng khác, truy vấn nhanh thông tin hôm nay
    let todayInfo: any = days.find((d) => d.dateStr === todayStr) || null;

    if (!todayInfo) {
      try {
        const todayDateParts = todayStr.split("-").map(Number);
        const [ty, tm, td] = todayDateParts;
        const todayUtc = new Date(Date.UTC(ty, tm - 1, td));
        const todayDow = todayUtc.getUTCDay();
        const todayDowName = dayNames[todayDow];
        const todayWeekNumber = getWeekNumber(todayUtc);
        const todayDayField = dayFields[todayDow];

        const [tSpecial, tSchedule, tCancel, tOverride, tCourts] = await Promise.all([
          prisma.studentSpecialMeal.findFirst({
            where: { studentId: student.id, date: todayUtc },
          }),
          todayDow !== 0 && todayDayField
            ? prisma.classWeeklySchedule.findFirst({
                where: { classId: student.classId, year: ty, weekNumber: todayWeekNumber },
              })
            : null,
          prisma.mealCancellation.findFirst({
            where: { studentId: student.id, cancelDate: todayUtc },
          }),
          prisma.mealOverride.findFirst({
            where: { studentId: student.id, date: todayUtc },
          }),
          prisma.dailyDiningCourt.findMany({
            where: { date: todayUtc },
          }),
        ]);

        const tClassShift = tSchedule ? (tSchedule as any)[todayDayField] : "NONE";

        let tHasMeal = false;
        let tCategory: "SPECIAL" | "REGULAR" | "NONE" = "NONE";
        let tSchedName = "";
        let tShift: "TIET_4" | "TIET_5" | null = null;
        let tShiftName = "";

        if (tSpecial && (tSpecial.shift === "TIET_4" || tSpecial.shift === "TIET_5")) {
          tHasMeal = true;
          tCategory = "SPECIAL";
          tSchedName = tSpecial.scheduleName;
          tShift = tSpecial.shift as "TIET_4" | "TIET_5";
          tShiftName = tShift === "TIET_4" ? "Ca Tiết 4 (10:15)" : "Ca Tiết 5 (11:00)";
        } else if (tClassShift === "TIET_4" || tClassShift === "TIET_5") {
          tHasMeal = true;
          tCategory = "REGULAR";
          tSchedName = `Lịch thường (${student.class?.name || student.classId})`;
          tShift = tClassShift;
          tShiftName = tShift === "TIET_4" ? "Ca Tiết 4 (10:15)" : "Ca Tiết 5 (11:00)";
        }

        let tCancelInfo: any = null;
        if (tCancel) {
          let statusText = "Chờ duyệt";
          let note = "<Cắt suất / Chờ duyệt>";
          if (tCancel.status === "APPROVED") {
            statusText = "Đã duyệt";
            note = "<Cắt suất / Đã duyệt>";
          } else if (tCancel.status === "REJECTED") {
            statusText = "Từ chối";
            note = "<Cắt suất / Từ chối>";
          }
          tCancelInfo = {
            id: tCancel.id,
            status: tCancel.status,
            statusText,
            cancellationNote: note,
            reason: tCancel.reason,
          };
        }

        const tMealType = tOverride ? tOverride.mealType : student.mealType;
        const tMealTypeName =
          tMealType === "CHAY" ? "Cơm Chay" : tMealType === "CHAO" ? "Cháo" : "Cơm Mặn";

        let tCourtInfo: any = null;
        if (tHasMeal && tShift && tCourts.length > 0) {
          const matched =
            tCategory === "SPECIAL"
              ? tCourts.find(
                  (c) =>
                    c.shift === tShift &&
                    c.classIds.some(
                      (cid) =>
                        cid.startsWith(`SPECIAL::${tSchedName}::${tShift}`) ||
                        cid.includes(tSchedName)
                    )
                )
              : tCourts.find((c) => c.shift === tShift && c.classIds.includes(student.classId));

          if (matched) {
            const cartNum = matched.cartNumber || Math.ceil(matched.courtNumber / 2);
            tCourtInfo = {
              courtNumber: matched.courtNumber,
              courtName: matched.courtName,
              cartNumber: cartNum,
              cartName: matched.cartName || `Xe ${cartNum}`,
              shift: matched.shift,
            };
          }
        }

        todayInfo = {
          dateStr: todayStr,
          dayNum: td,
          dow: todayDow,
          dowName: todayDowName,
          isSunday: todayDow === 0,
          isSaturday: todayDow === 6,
          isWeekend: todayDow === 0 || todayDow === 6,
          isToday: true,
          hasMeal: tHasMeal,
          mealCategory: tCategory,
          scheduleName: tSchedName,
          shift: tShift,
          shiftName: tShiftName,
          mealType: tMealType,
          mealTypeName: tMealTypeName,
          isMealOverridden: !!tOverride,
          cancellation: tCancelInfo,
          court: tCourtInfo,
        };
      } catch (err) {
        console.error("Lỗi khi tính thông tin hôm nay:", err);
      }
    }

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        fullName: student.user?.fullName || "—",
        studentCode: student.studentCode,
        boardingCode: student.boardingCode || "—",
        classId: student.classId,
        className: student.class?.name || student.classId,
        boardingStatus: student.boardingStatus,
        mealType: student.mealType,
      },
      month,
      year,
      todayInfo,
      summary: {
        totalScheduledDays,
        totalMealDays,
        totalCanceledDays,
        totalPendingCanceledDays,
        totalSpecialMealDays,
      },
      days,
    });
  } catch (error: any) {
    console.error("Lỗi khi lấy lịch ăn tháng của học sinh:", error);
    return NextResponse.json(
      { error: "Không thể tải lịch ăn trong tháng", details: error.message },
      { status: 500 }
    );
  }
}
