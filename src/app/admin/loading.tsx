import React from "react";
import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">
        Đang lấy dữ liệu quản trị...
      </p>
    </div>
  );
}
