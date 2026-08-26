"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Swal from "sweetalert2";

export function ForceChangePasswordForm({ role }: { role: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword.length < 6) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Mật khẩu xác nhận không khớp.",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/force-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Đã có lỗi xảy ra");
      }

      await Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.",
        timer: 2000,
        showConfirmButton: false,
      });
      
      const callbackUrl = role === "STUDENT" ? "/student-login" : "/login";
      await signOut({ callbackUrl });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="oldPassword">Mật khẩu cũ (Ngày sinh)</Label>
        <Input id="oldPassword" name="oldPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <Input id="newPassword" name="newPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Nhập lại mật khẩu mới</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
      </Button>
    </form>
  );
}

