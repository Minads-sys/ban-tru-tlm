"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, KeyRound, Loader2, AlertCircle, HelpCircle, Eye, EyeOff } from "lucide-react";

export default function StudentLoginForm({ schoolName }: { schoolName: string }) {
  const router = useRouter();
  const [fullNameInput, setFullNameInput] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name_code" | "password" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorField(null);

    if (!fullNameInput.trim()) {
      setError("Vui lòng nhập Họ và Tên học sinh");
      setErrorField("name_code");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Vui lòng nhập Mật khẩu (Ngày sinh ddmmyyyy)");
      setErrorField("password");
      setLoading(false);
      return;
    }

    if (!verificationCode || verificationCode.length < 6) {
      setError("Vui lòng nhập Mã xác nhận (6 số cuối của Số CCCD)");
      setErrorField("name_code");
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        username: fullNameInput.trim(),
        password: password.trim(),
        verificationCode: verificationCode.trim(),
        redirect: false,
      });

      if (res?.error) {
        const code = res.code || "";
        if (code === "STUDENT_NOT_FOUND") {
          setError("Không tìm thấy học sinh phù hợp, vui lòng kiểm tra Họ tên và mã xác nhận");
          setErrorField("name_code");
        } else if (code.startsWith("PASSWORD_INCORRECT_DAYS_")) {
          const days = parseInt(code.replace("PASSWORD_INCORRECT_DAYS_", ""), 10);
          if (days === 0) {
            setError("Mật khẩu chưa chính xác, bạn đã đổi mật khẩu hôm nay");
          } else {
            setError(`Mật khẩu chưa chính xác, bạn đã đổi mật khẩu ${days} ngày trước`);
          }
          setErrorField("password");
        } else if (code === "PASSWORD_INCORRECT_DEFAULT") {
          setError("Mật khẩu chưa chính xác (Mật khẩu mặc định là Ngày tháng năm sinh ddmmyyyy)");
          setErrorField("password");
        } else if (code === "ACCOUNT_CANCELLED_NO_DEBT") {
          setError("ℹ️ Học sinh đã ngừng ăn bán trú và đã hoàn tất toàn bộ công nợ quyết toán. Dịch vụ bán trú đã kết thúc. Cảm ơn quý phụ huynh.");
          setErrorField(null);
        } else if (code === "ACCOUNT_INACTIVE" || (res.error && res.error.includes("ngưng hoạt động"))) {
          setError("⚠️ Tài khoản bán trú của bạn đã bị ngưng hoạt động. Vui lòng liên hệ Nhà trường.");
          setErrorField(null);
        } else {
          setError("Không tìm thấy học sinh phù hợp, vui lòng kiểm tra Họ tên và mã xác nhận");
          setErrorField("name_code");
        }
      } else {
        router.push("/student");
        router.refresh();
      }
    } catch {
      setError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Top school branding header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-md mb-2.5 overflow-hidden bg-white border border-emerald-200">
            <img
              src="/student-favicon.ico"
              alt="Sổ Bán Trú"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-base min-[380px]:text-lg sm:text-xl md:text-2xl font-extrabold text-emerald-950 uppercase whitespace-nowrap tracking-tight">
            {schoolName}
          </h1>
          <p className="text-[11px] min-[370px]:text-xs sm:text-sm font-bold text-emerald-700 mt-1 whitespace-nowrap tracking-tight">
            CỔNG ĐĂNG NHẬP DÀNH CHO HỌC SINH & PHỤ HUYNH
          </p>
        </div>

        <Card className="border-emerald-100 shadow-xl bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-center text-slate-800">
              Đăng nhập Suất ăn Bán trú
            </CardTitle>
            <CardDescription className="text-center text-xs text-slate-500">
              Nhập Họ tên, Ngày sinh và 6 số cuối Số CCCD để báo cắt suất
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                  Họ và tên Học sinh
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={fullNameInput}
                    onChange={(e) => {
                      setFullNameInput(e.target.value);
                      if (errorField === "name_code") setErrorField(null);
                    }}
                    className={`pl-9 text-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors ${
                      errorField === "name_code" ? "border-red-400 ring-1 ring-red-400 bg-red-50/20" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Field 2: Password (DDMMYYYY) */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Mật khẩu (Ngày tháng năm sinh)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Dạng ddmmyyyy (VD: 15082011)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorField === "password") setErrorField(null);
                    }}
                    className={`pl-9 pr-10 text-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors ${
                      errorField === "password" ? "border-red-400 ring-1 ring-red-400 bg-red-50/20" : ""
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 mt-1 font-medium leading-relaxed">
                  Lưu ý: Nếu đăng nhập lần đầu sinh ngày 15/08/2011 thì nhập <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 font-bold">15082011</code>
                </p>
              </div>

              {/* Field 3: Verification Code (6 last digits of CCCD) */}
              <div className="space-y-1.5">
                <Label htmlFor="verificationCode" className="text-xs font-semibold text-slate-700">
                  Mã xác nhận (6 số cuối của Số CCCD)
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="verificationCode"
                    type="text"
                    maxLength={6}
                    placeholder="Ví dụ: 123456"
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, ""));
                      if (errorField === "name_code") setErrorField(null);
                    }}
                    className={`pl-9 text-sm font-mono tracking-widest focus:border-emerald-500 focus:ring-emerald-500 transition-colors ${
                      errorField === "name_code" ? "border-red-400 ring-1 ring-red-400 bg-red-50/20" : ""
                    }`}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 pl-1">
                  6 số cuối cùng trong dãy số Căn cước công dân của học sinh
                </p>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 shadow-md transition-all mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>

            {/* Help instructions box */}
            <div className="mt-5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-100 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Hướng dẫn cho Phụ huynh & Học sinh:
                </div>
                <a
                  href="/huong-dan-hoc-sinh.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline inline-flex items-center gap-1"
                >
                  📄 File HDSD (PDF)
                </a>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-700">
                <li>Tên đăng nhập: Nhập đầy đủ Họ và tên (có dấu hoặc không dấu đều được).</li>
                <li>Mật khẩu: Nhập liền 8 chữ số ngày sinh (VD: 15082011).</li>
                <li>Mã xác nhận: 6 chữ số cuối của Số CCCD.</li>
              </ul>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
