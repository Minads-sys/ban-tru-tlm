"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText, LogIn, Menu, X, ChevronRight } from "lucide-react";

interface NavItem {
  id: string;
  title: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "sec-overview", title: "1. Giới thiệu tổng quan" },
  { id: "sec-login", title: "2. Đăng nhập & Đổi mật khẩu", badge: "Quan trọng" },
  { id: "sec-home", title: "3. Giao diện Trang chủ & Hồ sơ" },
  { id: "sec-cut", title: "4. Nghiệp vụ: Cắt suất ăn" },
  { id: "sec-dish", title: "5. Nghiệp vụ: Đổi món ăn" },
  { id: "sec-debt", title: "6. Công nợ & Thanh toán VietQR" },
  { id: "sec-history", title: "7. Tra cứu Lịch sử Hóa đơn" },
  { id: "sec-logout", title: "8. Đăng xuất an toàn" },
  { id: "sec-faq", title: "9. Câu hỏi thường gặp (FAQ)" },
];

export function HdsdNavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand / School */}
        <div className="flex items-center gap-3">
          <Link href="/huong-dan" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-gradient-to-br from-orange-500 to-rose-600 p-0.5 shadow-sm group-hover:scale-105 transition">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center font-extrabold text-orange-600 text-xs sm:text-sm">
                TLM
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight group-hover:text-orange-600 transition">
                  BAN-TRU-TLM
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">
                  HƯỚNG DẪN HỌC SINH
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Trường THPT Ten Lơ Man — TP. Hồ Chí Minh
              </p>
            </div>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick PDF download button */}
          <a
            href="/huong-dan-hoc-sinh.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 transition border border-slate-200"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            <span>Tải bản PDF</span>
          </a>

          {/* Student Login portal button */}
          <Link
            href="/student-login"
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 shadow-sm shadow-orange-500/25 transition active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Vào Cổng Đăng Nhập</span>
          </Link>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-md px-4 py-4 shadow-xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mục lục hướng dẫn
            </span>
            <a
              href="/huong-dan-hoc-sinh.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-orange-600 flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Tải PDF
            </a>
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl text-sm font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition"
              >
                <span>{item.title}</span>
                {item.badge ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </a>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/student-login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              Truy cập Cổng Đăng Nhập Học Sinh
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
