"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  School,
  User,
  Lock,
  LogIn,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function LoginForm({ schoolName }: { schoolName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [showStudentCodeField, setShowStudentCodeField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleStudentCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setStudentCode(val);
    setUsername(val); // Tự động đồng bộ mã học sinh vào tên đăng nhập
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    const loginId = (showStudentCodeField && studentCode ? studentCode : username).trim();

    if (!loginId) {
      setErrorMessage("Vui lòng nhập tên đăng nhập hoặc mã học sinh");
      return;
    }

    if (!password) {
      setErrorMessage("Vui lòng nhập mật khẩu");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username: loginId,
        password: password,
        redirect: false,
      });

      if (result?.error) {
        if (
          result.error.includes("ngưng hoạt động") ||
          result.error.includes("CANCELLED")
        ) {
          setErrorMessage(
            "Tài khoản bán trú của bạn đã bị ngưng hoạt động. Vui lòng liên hệ nhà trường để được hỗ trợ."
          );
        } else if (result.error === "CredentialsSignin") {
          setErrorMessage("Tên đăng nhập hoặc mật khẩu không chính xác.");
        } else {
          setErrorMessage(result.error);
        }
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("ngưng hoạt động")) {
        setErrorMessage(
          "Tài khoản bán trú của bạn đã bị ngưng hoạt động. Vui lòng liên hệ nhà trường để được hỗ trợ."
        );
      } else {
        setErrorMessage("Đã xảy ra lỗi kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-blue-100 bg-white/95 backdrop-blur-sm">
      <CardHeader className="space-y-3 pb-6 text-center">
        {/* School Logo Area */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 text-white">
          <School className="h-9 w-9" />
        </div>

        <div>
          <CardTitle className="text-xl font-bold tracking-tight text-blue-950 uppercase sm:text-2xl">
            HỆ THỐNG QUẢN LÝ SUẤT ĂN BÁN TRÚ
          </CardTitle>
          <CardDescription className="mt-1 text-sm font-semibold text-blue-600">
            {schoolName}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message Box */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 animate-in fade-in duration-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Username Field */}
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-medium text-slate-700">
              Tên đăng nhập
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Nhập tên đăng nhập..."
                className="pl-9 bg-slate-50/50 focus:bg-white border-slate-200 transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Mật khẩu
              </Label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu..."
                className="pl-9 pr-9 bg-slate-50/50 focus:bg-white border-slate-200 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Optional Student Code Toggle & Input */}
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-2.5">
            <button
              type="button"
              onClick={() => setShowStudentCodeField(!showStudentCodeField)}
              className="flex w-full items-center justify-between text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                Dành cho Phụ huynh / Học sinh (Mã học sinh)
              </span>
              {showStudentCodeField ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showStudentCodeField && (
              <div className="mt-2.5 space-y-1.5 pt-2 border-t border-slate-200/80">
                <Label htmlFor="studentCode" className="text-xs font-medium text-slate-600">
                  Mã học sinh
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <Input
                    id="studentCode"
                    name="studentCode"
                    type="text"
                    placeholder="VD: HS2026001"
                    className="pl-9 h-8 text-xs bg-white border-slate-200 uppercase"
                    value={studentCode}
                    onChange={handleStudentCodeChange}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Nhập mã học sinh để tự động điền tên đăng nhập tài khoản.
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 h-10 shadow-md shadow-blue-500/20 transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Đăng nhập
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
        <div className="w-full pt-1 pb-2">
          <Link
            href="/student-login"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            Trang Đăng Nhập Dành Cho Phụ Huynh & Học Sinh →
          </Link>
        </div>
        <p>Hệ thống hỗ trợ quản lý suất ăn, điểm danh và khẩu phần ăn bán trú</p>
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} {schoolName}. Tất cả quyền được bảo lưu.
        </p>
      </CardFooter>
    </Card>
  );
}
