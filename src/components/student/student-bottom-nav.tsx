"use client";

import React from "react";
import {
  Home,
  UtensilsCrossed,
  Receipt,
  History,
  User,
  Bot,
  MessageSquare,
} from "lucide-react";

interface StudentBottomNavProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  unpaidCount?: number;
  onOpenBotHelp?: () => void;
}

export function StudentBottomNav({
  activeTab,
  onTabChange,
  unpaidCount = 0,
  onOpenBotHelp,
}: StudentBottomNavProps) {
  const tabs = [
    {
      key: "home",
      label: "Trang chủ",
      icon: Home,
    },
    {
      key: "meal",
      label: "Suất ăn",
      icon: UtensilsCrossed,
    },
    {
      key: "debt",
      label: "Hóa đơn",
      icon: Receipt,
      hasBadge: unpaidCount > 0,
      badgeText: unpaidCount > 9 ? "9+" : String(unpaidCount),
    },
    {
      key: "history",
      label: "Lịch sử",
      icon: History,
    },
    {
      key: "profile",
      label: "Cá nhân",
      icon: User,
    },
  ];

  return (
    <>
      {/* Floating Action Button: Trợ lý bán trú (Help Bot) */}
      <div className="fixed bottom-20 right-4 z-40 sm:bottom-24 sm:right-6">
        <button
          onClick={onOpenBotHelp}
          aria-label="Trợ lý hỗ trợ bán trú"
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-lg flex items-center justify-center text-lg active:scale-90 hover:scale-105 transition-all hover:shadow-xl ring-2 ring-white cursor-pointer"
        >
          <Bot className="h-6 w-6" />
        </button>
      </div>

      {/* Fixed Bottom Navigation Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1.5 z-40 shadow-lg sm:hidden">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.key ||
              (tab.key === "meal" && (activeTab === "cancel" || activeTab === "override"));
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex flex-col items-center py-1 px-2.5 relative transition-all active:scale-95 cursor-pointer ${
                  isActive ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 mb-0.5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {tab.hasBadge && (
                    <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center shadow-xs">
                      {tab.badgeText}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-tight ${isActive ? "font-bold text-blue-600" : "font-medium text-slate-500"}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
