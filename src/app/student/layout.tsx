import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentHeader } from "@/components/student/header";
import prisma from "@/lib/db";

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
