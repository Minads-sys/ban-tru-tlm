"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  BookOpen, 
  KeyRound, 
  LayoutDashboard, 
  UtensilsCrossed, 
  ArrowLeftRight, 
  CreditCard, 
  History, 
  LogOut, 
  HelpCircle,
  FileText
} from "lucide-react";

interface SectionItem {
  id: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  icon: any;
}

const SECTIONS: SectionItem[] = [
  { id: "sec-overview", title: "1. Giới thiệu tổng quan", icon: BookOpen },
  { id: "sec-login", title: "2. Đăng nhập & Đổi mật khẩu", badge: "Quan trọng", badgeColor: "bg-rose-100 text-rose-700", icon: KeyRound },
  { id: "sec-home", title: "3. Giao diện & Hồ sơ", icon: LayoutDashboard },
  { id: "sec-cut", title: "4. Báo Cắt suất ăn", badge: "Trừ tiền", badgeColor: "bg-orange-100 text-orange-700", icon: UtensilsCrossed },
  { id: "sec-dish", title: "5. Đăng ký Đổi món", icon: ArrowLeftRight },
  { id: "sec-debt", title: "6. Công nợ & VietQR", badge: "1 - 3s", badgeColor: "bg-emerald-100 text-emerald-700", icon: CreditCard },
  { id: "sec-history", title: "7. Lịch sử hóa đơn", icon: History },
  { id: "sec-logout", title: "8. Đăng xuất an toàn", icon: LogOut },
  { id: "sec-faq", title: "9. Câu hỏi thường gặp (FAQ)", icon: HelpCircle },
];

export function HdsdSidebar() {
  const [activeSection, setActiveSection] = useState<string>("sec-overview");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const element = document.getElementById(SECTIONS[i].id);
        if (element) {
          const top = element.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(SECTIONS[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <aside className="hidden lg:block lg:col-span-3 sticky top-20">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Mục Lục Hướng Dẫn
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
            9 Phần
          </span>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1 text-xs">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;

            return (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-medium ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold shadow-sm shadow-orange-500/20 translate-x-1"
                    : "text-slate-600 hover:text-orange-600 hover:bg-orange-50/80"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{sec.title}</span>
                </div>
                {sec.badge && (
                  <span
                    className={`ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      isActive ? "bg-white/20 text-white" : sec.badgeColor || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Download PDF Card */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <a
            href="/huong-dan-hoc-sinh.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 hover:border-orange-200 transition group"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 group-hover:text-rose-600 transition">
                Tải file PDF
              </div>
              <p className="text-[10px] text-slate-500 truncate">huong-dan-hoc-sinh.pdf</p>
            </div>
          </a>
        </div>

        {/* Mini QR info */}
        <div className="mt-3 text-center p-2 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Quét mở trên điện thoại</p>
          <div className="relative w-24 h-24 mx-auto bg-white rounded-xl p-1.5 border border-slate-200 shadow-2xs">
            <Image
              src="/qr-student-login.png"
              alt="QR Cổng Học Sinh"
              width={96}
              height={96}
              className="rounded-lg object-contain w-full h-full"
            />
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-1">bantrutlm.com</p>
        </div>
      </div>
    </aside>
  );
}
