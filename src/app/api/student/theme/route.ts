import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "STUDENT_PORTAL_THEME",
            "STUDENT_PORTAL_BANNER_URL",
            "SCHOOL_LOGO_URL",
            "STUDENT_PORTAL_MOTTO",
            "STUDENT_PORTAL_ANNOUNCEMENT",
            "SCHOOL_NAME",
            "SCHOOL_PHONE",
            "MEAL_LOCK_TIME_1",
            "MEAL_LOCK_TIME_1_SUNDAY",
            "MEAL_LOCK_TIME_2",
            "CUTOFF_TIME",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {
      STUDENT_PORTAL_THEME: "red_star",
      STUDENT_PORTAL_BANNER_URL: "",
      SCHOOL_LOGO_URL: "",
      STUDENT_PORTAL_MOTTO: "Nhiệt liệt chào mừng năm học mới",
      STUDENT_PORTAL_ANNOUNCEMENT: "",
      SCHOOL_NAME: "Trường THPT Ten Lơ Man",
      SCHOOL_PHONE: "(028) 3829 7990",
      MEAL_LOCK_TIME_1: "16:00",
      MEAL_LOCK_TIME_1_SUNDAY: "19:00",
      MEAL_LOCK_TIME_2: "07:00",
      CUTOFF_TIME: "16:00",
    };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      theme: settingsMap.STUDENT_PORTAL_THEME || "red_star",
      bannerUrl: settingsMap.STUDENT_PORTAL_BANNER_URL || "",
      schoolLogoUrl: settingsMap.SCHOOL_LOGO_URL || "",
      motto: settingsMap.STUDENT_PORTAL_MOTTO || "",
      announcement: settingsMap.STUDENT_PORTAL_ANNOUNCEMENT || "",
      schoolName: settingsMap.SCHOOL_NAME || "Trường THPT Ten Lơ Man",
      schoolPhone: settingsMap.SCHOOL_PHONE || "(028) 3829 7990",
      mealLockTime1: settingsMap.MEAL_LOCK_TIME_1 || settingsMap.CUTOFF_TIME || "16:00",
      mealLockTime1Sunday: settingsMap.MEAL_LOCK_TIME_1_SUNDAY || "19:00",
      mealLockTime2: settingsMap.MEAL_LOCK_TIME_2 || "07:00",
    });
  } catch (error) {
    console.error("Error fetching student theme settings:", error);
    return NextResponse.json({
      theme: "red_star",
      bannerUrl: "",
      motto: "",
      announcement: "",
      schoolName: "Trường THPT Ten Lơ Man",
      schoolPhone: "(028) 3829 7990",
      mealLockTime1: "16:00",
      mealLockTime1Sunday: "19:00",
      mealLockTime2: "07:00",
    });
  }
}
