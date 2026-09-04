import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ForceChangePasswordForm } from "./form";

export default async function ForceChangePasswordPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // If they don't require password change, send them to their dashboard
  if (!session.user.requiresPasswordChange) {
    const isAdmin = ["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "CASHIER"].includes(session.user.role);
    redirect(isAdmin ? "/admin/dashboard" : "/student/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2 text-center text-slate-900">Bắt buộc đổi mật khẩu</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Vì lý do bảo mật, bạn cần đổi mật khẩu mặc định (ngày sinh) trong lần đăng nhập đầu tiên.
        </p>
        <ForceChangePasswordForm role={session.user.role} />
      </div>
    </div>
  );
}
