import type { Metadata } from "next";
import prisma from "@/lib/db";
import StudentLoginForm from "./student-login-form";

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
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "SCHOOL_NAME" },
  });
  const schoolName = setting?.value || "TRƯỜNG TIỂU HỌC TLM";

  return <StudentLoginForm schoolName={schoolName} />;
}
