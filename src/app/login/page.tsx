import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import prisma from "@/lib/db";
import LoginForm from "./login-form";

export const metadata = {
  title: "Đăng nhập BQT/GV - BAN-TRU-TLM",
  description: "Đăng nhập dành cho BQT và Giáo viên",
};

export default async function LoginPage() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "SCHOOL_NAME" },
  });
  const schoolName = setting?.value || "TRƯỜNG TIỂU HỌC TLM";

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 p-4">
      {/* Decorative background blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="flex h-64 w-full max-w-md items-center justify-center rounded-xl bg-white/80 p-8 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <LoginForm schoolName={schoolName} />
      </Suspense>
    </div>
  );
}
