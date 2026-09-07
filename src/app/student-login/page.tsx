import type { Metadata } from "next";
import prisma from "@/lib/db";
import StudentLoginForm from "./student-login-form";
import { StudentMaintenance } from "@/components/student-maintenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sổ Bán Trú - Đăng nhập",
  description: "Cổng thông tin Sổ Bán Trú dành cho Phụ huynh và Học sinh",
  applicationName: "Sổ Bán Trú",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sổ Bán Trú",
  },
  icons: {
    icon: [
      { url: "/student-favicon.ico" },
      { url: "/student-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/student-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/student-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/student-manifest.json",
};

export default async function StudentLoginPage() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          "SCHOOL_NAME",
          "STUDENT_PORTAL_MAINTENANCE",
          "STUDENT_MAINTENANCE_MESSAGE",
        ],
      },
    },
  });

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const schoolName = settingsMap["SCHOOL_NAME"] || "TRƯỜNG THPT TEN LƠ MAN";
  const isMaintenance = settingsMap["STUDENT_PORTAL_MAINTENANCE"] === "true";
  const customMessage = settingsMap["STUDENT_MAINTENANCE_MESSAGE"];

  if (isMaintenance) {
    return (
      <StudentMaintenance
        schoolName={schoolName}
        customMessage={customMessage}
      />
    );
  }

  return <StudentLoginForm schoolName={schoolName} />;
}
