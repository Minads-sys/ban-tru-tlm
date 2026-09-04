import React from "react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentHeader } from "@/components/student/header";
import prisma from "@/lib/db";

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
