import { NextResponse } from "next/server";
import prisma from "@/lib/db";

function formatDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET() {
  try {
    // Lấy ngày hôm nay theo giờ VN
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayDate = new Date(Date.UTC(y, m - 1, d));

    // Lấy 7 ngày học gần nhất (lùi tối đa 14 ngày lịch để lọc ra các ngày Thứ 2 - Thứ 6)
    const recentDates: string[] = [];
    let checkDate = new Date(todayDate);

    while (recentDates.length < 7) {
      const dayOfWeek = checkDate.getUTCDay();
      // Bỏ qua Chủ nhật (0) và Thứ 7 (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        recentDates.push(formatDateISO(checkDate));
      }
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    // Đảo ngược lại để sắp xếp từ cũ đến mới (Thứ Hai -> Hôm nay)
    recentDates.reverse();

    const [firstY, firstM, firstD] = recentDates[0].split("-").map(Number);
    const startDate = new Date(Date.UTC(firstY, firstM - 1, firstD));

    const showcases = await prisma.dailyMealShowcase.findMany({
      where: {
        date: {
          gte: startDate,
          lte: todayDate,
        },
      },
      select: {
        date: true,
        photoUrls: true,
        isPublished: true,
        items: {
          select: {
            dishName: true,
            categoryName: true,
          },
          take: 3,
        },
      },
    });

    const showcaseMap = new Map<string, any>();
    showcases.forEach((s) => {
      showcaseMap.set(formatDateISO(new Date(s.date)), s);
    });

    const dayNameMap: Record<number, string> = {
      1: "Thứ Hai",
      2: "Thứ Ba",
      3: "Thứ Tư",
      4: "Thứ Năm",
      5: "Thứ Sáu",
      6: "Thứ Bảy",
      0: "Chủ Nhật",
    };

    const result = recentDates.map((dateStr) => {
      const [cy, cm, cd] = dateStr.split("-").map(Number);
      const curDate = new Date(Date.UTC(cy, cm - 1, cd));
      const dayOfWeek = curDate.getUTCDay();
      const isToday = dateStr === todayStr;

      const record = showcaseMap.get(dateStr);
      const hasPhotos = !!(record && record.photoUrls && record.photoUrls.length > 0);
      const hasMenu = !!(record && record.items && record.items.length > 0);
      const thumbnail = hasPhotos ? record.photoUrls[0] : null;

      return {
        date: dateStr,
        dayName: isToday ? "Hôm nay" : dayNameMap[dayOfWeek] || "",
        shortDate: `${cd}/${cm}`,
        isToday,
        hasPhotos,
        hasMenu,
        thumbnail,
        photoCount: record?.photoUrls?.length || 0,
      };
    });

    return NextResponse.json({ days: result, today: todayStr });
  } catch (error) {
    console.error("Lỗi lấy 7 ngày gần nhất:", error);
    return NextResponse.json({ error: "Không thể lấy danh sách 7 ngày gần nhất" }, { status: 500 });
  }
}
