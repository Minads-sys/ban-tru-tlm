import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Helper lấy ngày hiện tại theo giờ Việt Nam (GMT+7)
function getTodayVN(): string {
  try {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    return d.toISOString().split("T")[0];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || getTodayVN();

    const [y, m, d] = dateStr.split("-").map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    // Lấy thông tin cài đặt trường học & nhà cung cấp
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "SCHOOL_NAME",
            "SCHOOL_PHONE",
            "CATERING_PROVIDER_NAME",
            "CATERING_PROVIDER_PHONE",
            "SCHOOL_LOGO_URL",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {
      SCHOOL_NAME: "Trường THPT Ten Lơ Man",
      SCHOOL_PHONE: "(028) 3829 7990",
      CATERING_PROVIDER_NAME: "Bếp Trung Tâm TLM",
      CATERING_PROVIDER_PHONE: "(028) 3829 7990",
      SCHOOL_LOGO_URL: "",
    };

    settings.forEach((s) => {
      if (s.value) settingsMap[s.key] = s.value;
    });

    const showcase = await prisma.dailyMealShowcase.findUnique({
      where: { date: targetDate },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    const hasItems = !!(showcase && showcase.items.length > 0);
    const hasPhotos = !!(showcase && showcase.photoUrls && showcase.photoUrls.length > 0);

    let status: "HAS_PHOTOS" | "MENU_ONLY" | "PENDING" = "PENDING";
    if (hasPhotos) {
      status = "HAS_PHOTOS";
    } else if (hasItems) {
      status = "MENU_ONLY";
    }

    return NextResponse.json({
      date: dateStr,
      status,
      hasPhotos,
      hasItems,
      showcase: showcase
        ? {
            id: showcase.id,
            date: dateStr,
            photoUrls: showcase.photoUrls || [],
            providerName: showcase.providerName || settingsMap.CATERING_PROVIDER_NAME,
            note: showcase.note,
            items: showcase.items || [],
          }
        : null,
      schoolInfo: {
        name: settingsMap.SCHOOL_NAME,
        phone: settingsMap.SCHOOL_PHONE,
        logoUrl: settingsMap.SCHOOL_LOGO_URL,
      },
      providerInfo: {
        name: showcase?.providerName || settingsMap.CATERING_PROVIDER_NAME,
        phone: settingsMap.CATERING_PROVIDER_PHONE,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin công khai suất ăn:", error);
    return NextResponse.json({ error: "Không thể lấy thông tin suất ăn công khai" }, { status: 500 });
  }
}
