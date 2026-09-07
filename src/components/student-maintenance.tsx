"use client";

import React from "react";
import { Wrench, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentMaintenanceProps {
  schoolName?: string;
  customMessage?: string;
}

export function StudentMaintenance({
  schoolName = "TRƯỜNG THPT TEN LƠ MAN",
  customMessage,
}: StudentMaintenanceProps) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-amber-50/40 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-lg">
        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-amber-200 shadow-xl overflow-hidden text-center">
          {/* Header Banner */}
          <div className="bg-amber-500/10 border-b border-amber-100 py-4 px-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Chế độ bảo trì hệ thống
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-700 mt-2 uppercase tracking-wider">
              {schoolName}
            </h2>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Animated Icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                <Wrench className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            {/* Title & Message */}
            <div className="space-y-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                Hệ Thống Đang Tạm Bảo Trì
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                {customMessage && customMessage.trim() !== "" ? (
                  customMessage
                ) : (
                  <>
                    Cổng thông tin Bán trú dành cho <b>Học sinh & Phụ huynh</b> hiện đang tạm ngưng hoạt động để bảo trì, rà soát số liệu và nâng cấp tính năng.
                  </>
                )}
              </p>
            </div>

            {/* Information Notice Box */}
            <div className="bg-amber-50/80 rounded-xl border border-amber-200/80 p-4 text-left space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Quý phụ huynh và các em học sinh vui lòng lưu ý:</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-slate-600">
                <li>Vui lòng quay lại sau ít phút hoặc theo lịch thông báo của nhà trường.</li>
                <li>Mọi giao dịch và yêu cầu sẽ được mở lại ngay sau khi hoàn tất bảo trì.</li>
                <li>Nếu cần hỗ trợ khẩn cấp, vui lòng liên hệ trực tiếp với <b>Giáo viên chủ nhiệm</b> hoặc <b>Văn phòng Bán trú</b>.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-center">
              <Button
                onClick={handleReload}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold px-8 shadow-sm gap-2 h-11"
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại trang
              </Button>
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-slate-50 border-t border-slate-100 py-3 px-6 text-center text-[11px] text-slate-400">
            Hệ thống Quản lý Suất ăn Bán trú — {schoolName}
          </div>
        </div>
      </div>
    </div>
  );
}
