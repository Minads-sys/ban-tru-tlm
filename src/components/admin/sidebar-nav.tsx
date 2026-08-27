"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  School,
  CalendarDays,
  ClipboardCheck,
  ChefHat,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SidebarNavProps {
  user?: {
    id?: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    studentId?: string | null;
    permissions?: string[];
  };
}

import { PERMISSIONS, Permission } from "@/lib/permissions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Nhân sự",
    href: "/admin/users",
    icon: Users, // Using Users for now, as it's already imported
    permission: "MANAGE_USERS",
  },
  {
    title: "Học sinh",
    href: "/admin/students",
    icon: Users,
    permission: "MANAGE_STUDENTS",
  },
  {
    title: "Lớp học",
    href: "/admin/classes",
    icon: School,
    permission: "MANAGE_STUDENTS",
  },
  {
    title: "Thời khóa biểu",
    href: "/admin/schedule",
    icon: CalendarDays,
    permission: "MANAGE_STUDENTS",
  },
  {
    title: "Duyệt cắt suất",
    href: "/admin/meal-cancel",
    icon: ClipboardCheck,
    permission: "MANAGE_MEALS",
  },
  {
    title: "Chốt suất ăn",
    href: "/admin/daily-meals",
    icon: ChefHat,
    permission: "MANAGE_MEALS",
  },
  {
    title: "Hóa đơn & Thanh toán",
    href: "/admin/billing",
    icon: Receipt,
    permission: "MANAGE_FINANCE",
  },
  {
    title: "Nhập dữ liệu Excel",
    href: "/admin/import",
    icon: FileSpreadsheet,
    permission: "MANAGE_STUDENTS",
    adminOnly: true,
  },
  {
    title: "Báo cáo",
    href: "/admin/reports",
    icon: BarChart3,
    permission: "VIEW_REPORTS",
  },
  {
    title: "Cài đặt",
    href: "/admin/settings",
    icon: Settings,
    permission: "MANAGE_SETTINGS",
  },
];

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const isLinkActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-100">
      {/* Brand Header */}
      <div>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <Link
            href="/admin"
            className="flex items-center gap-3 font-bold tracking-tight hover:opacity-90 transition-opacity"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-500/20 text-white">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-wide">
                BAN-TRU-TLM
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                Quản lý Bán trú
              </div>
            </div>
          </Link>
          {/* Close button for mobile */}
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="space-y-1 px-3 py-4">
          {NAV_ITEMS.filter(item => {
            if (item.adminOnly && user?.role !== "ADMIN") return false;
            if (!item.permission) return true;
            if (user?.role === "ADMIN") return true;
            const userPermissions = user?.permissions || [];
            return userPermissions.includes(item.permission);
          }).map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-white" : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer User Info & Sign Out */}
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-800/60 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-100">
              {user?.name || user?.username || "Quản trị viên"}
            </p>
            <p className="truncate text-[11px] text-blue-400 font-medium">
              Quản trị hệ thống
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full justify-center gap-2 border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-red-950/40 hover:text-red-300 hover:border-red-800/60 transition-colors h-9 text-xs cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Đăng xuất</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:hidden print:hidden">
        <div className="flex items-center gap-2.5 font-bold text-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white">
            <Utensils className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">
            BAN-TRU-TLM
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="p-1.5 text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-[250px] md:flex-col md:fixed md:inset-y-0 z-30 shadow-xl print:hidden">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 w-[260px] shadow-2xl transition-transform duration-200 ease-in-out">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
}
