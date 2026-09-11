"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, ShieldCheck, Copy, Check, Save, Lock, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";

interface PasskeyManagerProps {
  initialPasskey?: string;
  onPasskeyUpdated?: (newKey: string) => void;
  userRole?: string;
}

export function PasskeyManager({
  initialPasskey = "123456",
  onPasskeyUpdated,
  userRole,
}: PasskeyManagerProps) {
  const [pin, setPin] = useState<string>(initialPasskey);
  const [saving, setSaving] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (initialPasskey) {
      setPin(initialPasskey);
    }
  }, [initialPasskey]);

  const origin =
    typeof window !== "undefined" && window.location.origin && window.location.origin !== "null"
      ? window.location.origin
      : "https://bantrutlm.com";

  const plainUrl = `${origin}/kitchen-display`;
  const secureUrl = `${origin}/kitchen-display?key=${pin}`;

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();

    if (!/^\d{6}$/.test(cleanPin)) {
      toast.error("Mã khóa bảo vệ (Passkey) phải gồm đúng 6 chữ số (0-9)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ KITCHEN_DISPLAY_PASSKEY: cleanPin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu mã khóa");

      toast.success("Đã cập nhật mã PIN khóa màn hình TV thành công!");
      if (onPasskeyUpdated) onPasskeyUpdated(cleanPin);
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật mã khóa");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success("Đã sao chép liên kết vào bộ nhớ tạm!");
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Mã Khóa Màn Hình TV (Passkey PIN 6 số)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ngăn chặn việc chia sẻ tràn lan - Chỉ người có mã PIN 6 số mới được xem màn hình Bếp
            </p>
          </div>
        </div>
      </div>

      {/* FORM UPDATE 6-DIGIT PIN */}
      {userRole === "ADMIN" || userRole === "BOARDING_MANAGER" || !userRole ? (
        <form onSubmit={handleSavePin} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                Mã PIN 6 số hiện tại:
              </label>
              <div className="relative max-w-xs">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPin(val);
                  }}
                  className="w-full text-2xl font-mono font-black text-center tracking-[0.5em] py-2 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500"
                  placeholder="123456"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || pin.length !== 6}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition disabled:opacity-50 self-end sm:self-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? "Đang lưu..." : "Lưu mã PIN mới"}
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Bộ đếm chu kỳ 7 ngày tự động:</strong> Mỗi thiết bị Smart TV hoặc máy tính sau khi nhập mã PIN sẽ duy trì phiên trong <strong>7 ngày</strong>. Hết 7 ngày, hệ thống sẽ tự động khóa lại và yêu cầu người dùng nhập lại mã PIN 6 số một lần để tiếp tục sử dụng.
              </span>
            </div>
            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý:</strong> Khi bạn đổi mã PIN 6 số này, tất cả các thiết bị cũ đang mở sẽ lập tức bị khóa lại ngay mà không cần đợi hết 7 ngày.
              </span>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
          Mã khóa hiện tại do Quản trị viên (Admin) quản lý. Liên hệ Quản trị viên nếu cần cấp lại mã.
        </div>
      )}

      {/* 2 LINK OPTIONS */}
      <div className="space-y-3 pt-1">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Tùy chọn đường dẫn chia sẻ:
        </div>

        {/* Option 1: Secure link with key attached */}
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Link tự động mở (Đã gắn sẵn mã PIN - Khuyên dùng cho Smart TV):
            </div>
            <code className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 break-all select-all">
              {secureUrl}
            </code>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              • Tiện lợi khi cài đặt dấu trang (Bookmark) trên Smart TV, mở là xem ngay không cần gõ mã.
            </p>
          </div>
          <button
            onClick={() => handleCopy(secureUrl, "secure")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition"
          >
            {copiedType === "secure" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Sao chép
          </button>
        </div>

        {/* Option 2: Plain link asking for key */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <Lock className="w-4 h-4 text-slate-500" />
              Link có khóa bảo vệ (Bắt buộc gõ đúng 6 số mới xem được):
            </div>
            <code className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 break-all select-all">
              {plainUrl}
            </code>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              • Khi gửi link này, người xem phải có mã PIN (<strong>{pin}</strong>) mới mở được số liệu.
            </p>
          </div>
          <button
            onClick={() => handleCopy(plainUrl, "plain")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shrink-0 transition"
          >
            {copiedType === "plain" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Sao chép
          </button>
        </div>
      </div>
    </div>
  );
}
