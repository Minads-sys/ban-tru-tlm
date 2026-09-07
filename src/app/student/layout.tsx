import React from "react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentHeader } from "@/components/student/header";
import { StudentMaintenance } from "@/components/student-maintenance";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sổ Bán Trú",
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

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check Maintenance Mode for students (allow ADMIN to bypass for testing/preview)
  if (session.user.role === "STUDENT") {
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
    if (settingsMap["STUDENT_PORTAL_MAINTENANCE"] === "true") {
      return (
        <StudentMaintenance
          schoolName={settingsMap["SCHOOL_NAME"] || "TRƯỜNG THPT TEN LƠ MAN"}
          customMessage={settingsMap["STUDENT_MAINTENANCE_MESSAGE"]}
        />
      );
    }
  }

  if (session.user.requiresPasswordChange) {
    redirect("/force-change-password");
  }

  // Ensure we have the studentCode even for old sessions
  let studentCode = session.user.studentCode;
  if (!studentCode && session.user.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: session.user.studentId },
      select: { studentCode: true }
    });
    if (student) {
      studentCode = student.studentCode;
    }
  }

  const userForHeader = {
    ...session.user,
    studentCode: studentCode
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={userForHeader} />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
