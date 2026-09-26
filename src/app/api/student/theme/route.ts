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
            "STUDENT_PORTAL_MOTTO",
            "STUDENT_PORTAL_ANNOUNCEMENT",
            "SCHOOL_NAME",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {
      STUDENT_PORTAL_THEME: "red_star",
      STUDENT_PORTAL_BANNER_URL: "",
      STUDENT_PORTAL_MOTTO: "Nhiệt liệt chào mừng năm học mới",
      STUDENT_PORTAL_ANNOUNCEMENT: "",
      SCHOOL_NAME: "Trường THPT Ten Lơ Man",
    };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      theme: settingsMap.STUDENT_PORTAL_THEME || "red_star",
      bannerUrl: settingsMap.STUDENT_PORTAL_BANNER_URL || "",
      motto: settingsMap.STUDENT_PORTAL_MOTTO || "",
      announcement: settingsMap.STUDENT_PORTAL_ANNOUNCEMENT || "",
      schoolName: settingsMap.SCHOOL_NAME || "Trường THPT Ten Lơ Man",
    });
  } catch (error) {
    console.error("Error fetching student theme settings:", error);
    return NextResponse.json({
      theme: "red_star",
      bannerUrl: "",
      motto: "",
      announcement: "",
      schoolName: "Trường THPT Ten Lơ Man",
    });
  }
}
