"use client";

import React from "react";
import {
  CalendarX,
  RefreshCw,
  QrCode,
  CalendarDays,
  Receipt,
  History,
  User,
  PhoneCall,
  Sparkles,
} from "lucide-react";

interface QuickServicesProps {
  onSelectService: (serviceKey: string) => void;
  showAll?: boolean;
  onToggleShowAll?: () => void;
}

interface ServiceItem {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  bgGradient: string;
  iconBg: string;
  badge?: string;
  badgeBg?: string;
}

export function StudentQuickServices({
  onSelectService,
  showAll = false,
  onToggleShowAll,
}: QuickServicesProps) {
  const primaryServices: ServiceItem[] = [
    {
      key: "cancel",
      title: "Cắt suất ăn",
      icon: CalendarX,
      bgGradient: "from-rose-50 to-rose-100/80 border-rose-200/80",
      iconBg: "bg-rose-500 text-white",
      badge: "HOT",
      badgeBg: "bg-rose-600 text-white",
    },
    {
      key: "override",
      title: "Đổi món ăn",
      icon: RefreshCw,
      bgGradient: "from-emerald-50 to-emerald-100/80 border-emerald-200/80",
      iconBg: "bg-emerald-500 text-white",
      badge: "HOT",
      badgeBg: "bg-rose-600 text-white",
    },
    {
      key: "qr",
      title: "Quét VietQR",
      icon: QrCode,
      bgGradient: "from-blue-50 to-blue-100/80 border-blue-200/80",
      iconBg: "bg-blue-600 text-white",
    },
    {
      key: "schedule",
      title: "Lịch ăn tuần",
      icon: CalendarDays,
      bgGradient: "from-indigo-50 to-indigo-100/80 border-indigo-200/80",
      iconBg: "bg-indigo-500 text-white",
    },
  ];

  const extendedServices: ServiceItem[] = [
    {
      key: "debt",
      title: "DS công nợ",
      icon: Receipt,
      bgGradient: "from-amber-50 to-amber-100/80 border-amber-200/80",
      iconBg: "bg-amber-500 text-white",
    },
    {
      key: "history",
      title: "Lịch sử GD",
      icon: History,
      bgGradient: "from-teal-50 to-teal-100/80 border-teal-200/80",
      iconBg: "bg-teal-600 text-white",
    },
    {
      key: "profile",
      title: "Hồ sơ học sinh",
      icon: User,
      bgGradient: "from-cyan-50 to-cyan-100/80 border-cyan-200/80",
      iconBg: "bg-cyan-600 text-white",
    },
    {
      key: "support",
      title: "Hỗ trợ bán trú",
      icon: PhoneCall,
      bgGradient: "from-purple-50 to-purple-100/80 border-purple-200/80",
      iconBg: "bg-purple-600 text-white",
    },
  ];

  const displayedServices = showAll
    ? [...primaryServices, ...extendedServices]
    : primaryServices;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Tiện ích của bạn
          </h2>
          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-semibold">
            Bán trú TLM
          </span>
        </div>
        <button
          onClick={onToggleShowAll}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
        >
          {showAll ? "Thu gọn" : "Xem tất cả"}
        </button>
      </div>

      {/* 4 Column App Grid */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4 text-center">
        {displayedServices.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onSelectService(item.key)}
              className="flex flex-col items-center group active:scale-95 transition cursor-pointer"
            >
              <div
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b ${item.bgGradient} border flex items-center justify-center shadow-2xs group-hover:shadow-md transition-all`}
              >
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-1 ${item.badgeBg} text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-xs animate-pulse`}
                  >
                    {item.badge}
                  </span>
                )}
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${item.iconBg} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 leading-tight line-clamp-2 group-hover:text-blue-600">
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
