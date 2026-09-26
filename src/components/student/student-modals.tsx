"use client";

import React, { useState } from "react";
import {
  Search,
  X,
  Phone,
  HelpCircle,
  FileQuestion,
  LogOut,
  KeyRound,
  GraduationCap,
  CalendarX,
  RefreshCw,
  QrCode,
  CalendarDays,
  Receipt,
  User,
  ExternalLink,
  ChevronRight,
  Bot,
  Eye,
  Utensils,
} from "lucide-react";
import { signOut } from "next-auth/react";

interface StudentModalsProps {
  isSearchOpen: boolean;
  onCloseSearch: () => void;
  isMenuOpen: boolean;
  onCloseMenu: () => void;
  isBotOpen: boolean;
  onCloseBot: () => void;
  onSelectAction: (actionKey: string) => void;
  studentName?: string;
  studentClass?: string;
  boardingCode?: string;
  schoolName?: string;
  schoolPhone?: string;
  mealLockTime1?: string;
  mealLockTime1Sunday?: string;
}

export function StudentModals({
  isSearchOpen,
  onCloseSearch,
  isMenuOpen,
  onCloseMenu,
  isBotOpen,
  onCloseBot,
  onSelectAction,
  studentName = "Nguyễn Bảo Khánh",
  studentClass = "12A1",
  boardingCode = "BT-12A1-05",
  schoolName = "Trường THPT Ten Lơ Man",
  schoolPhone = "(028) 3829 7990",
  mealLockTime1 = "16:00",
  mealLockTime1Sunday = "19:00",
}: StudentModalsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const searchableItems = [
    { key: "cancel", label: "Cắt suất ăn / Báo nghỉ ăn", icon: CalendarX, category: "Suất ăn" },
    { key: "override", label: "Đổi món ăn (Mặn / Chay / Cháo)", icon: RefreshCw, category: "Suất ăn" },
    { key: "weekly_menu", label: "Thực đơn tuần & Danh sách món ăn", icon: Utensils, category: "Suất ăn" },
    { key: "public_meals", label: "Công khai hình ảnh suất ăn bán trú", icon: Eye, category: "Suất ăn" },
    { key: "debt", label: "Hóa đơn tiền ăn & Quét mã VietQR", icon: Receipt, category: "Hóa đơn" },
    { key: "schedule", label: "Lịch ăn tuần & Sân ăn", icon: CalendarDays, category: "Lịch trình" },
    { key: "history", label: "Lịch sử đóng tiền & Lịch sử cắt suất", icon: Receipt, category: "Lịch sử" },
    { key: "profile", label: "Hồ sơ học sinh & Thẻ bán trú", icon: User, category: "Cá nhân" },
    { key: "password", label: "Đổi mật khẩu tài khoản", icon: KeyRound, category: "Bảo mật" },
  ];

  const filteredItems = searchQuery.trim()
    ? searchableItems.filter((i) =>
        i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchableItems;

  return (
    <>
      {/* 1. SEARCH MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 pt-12 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Tìm kiếm tiện ích, tính năng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={onCloseSearch}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy tính năng nào phù hợp
                </div>
              ) : (
                filteredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onCloseSearch();
                        onSelectAction(item.key);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50/70 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                            {item.label}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SIDE MENU DRAWER */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            onClick={onCloseMenu}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-200">
            {/* Header Drawer */}
            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative">
              <button
                onClick={onCloseMenu}
                className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400 text-red-950 flex items-center justify-center text-xs font-black shadow-xs">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold leading-tight truncate">
                  {schoolName}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-[11px] text-blue-200">Tài khoản học sinh:</div>
                <div className="text-base font-bold text-white truncate">
                  {studentName}
                </div>
                <div className="text-xs text-blue-100 flex items-center gap-2 mt-0.5">
                  <span>Lớp: {studentClass}</span>
                  <span>•</span>
                  <span>Mã BT: {boardingCode}</span>
                </div>
              </div>
            </div>

            {/* Menu List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <button
                onClick={() => { onCloseMenu(); onSelectAction("home"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <span>Trang chủ</span>
              </button>
              <button
                onClick={() => { onCloseMenu(); onSelectAction("cancel"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <CalendarX className="h-4 w-4 text-rose-600" />
                <span>Cắt suất ăn</span>
              </button>
              <button
                onClick={() => { onCloseMenu(); onSelectAction("override"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <RefreshCw className="h-4 w-4 text-emerald-600" />
                <span>Đổi món ăn</span>
              </button>
              <button
                onClick={() => { onCloseMenu(); onSelectAction("debt"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <QrCode className="h-4 w-4 text-blue-600" />
                <span>Danh sách nợ & Quét VietQR</span>
              </button>
              <button
                onClick={() => { onCloseMenu(); onSelectAction("history"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <Receipt className="h-4 w-4 text-purple-600" />
                <span>Lịch sử thanh toán</span>
              </button>
              <button
                onClick={() => { onCloseMenu(); onSelectAction("profile"); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-semibold text-left"
              >
                <User className="h-4 w-4 text-cyan-600" />
                <span>Hồ sơ học sinh</span>
              </button>
            </div>

            {/* Logout Footer */}
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => signOut({ callbackUrl: "/student-login" })}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BOT HELP DIALOG */}
      {isBotOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Trợ Lý Bán Trú TLM</h3>
                  <p className="text-[10px] text-cyan-100">Hỗ trợ học sinh & phụ huynh</p>
                </div>
              </div>
              <button
                onClick={onCloseBot}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100">
                <span className="font-bold text-blue-900 block mb-1">
                  1. Hướng dẫn Báo cắt suất ăn:
                </span>
                Học sinh cần báo cắt trước <b>{mealLockTime1}</b> hàng ngày (hoặc <b>{mealLockTime1Sunday}</b> Chủ Nhật cho Thứ Hai tuần kế tiếp) để được hoàn tiền vào tháng sau.
              </div>

              <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-1">
                  2. Đóng tiền ăn qua VietQR:
                </span>
                Vào tab &quot;Hóa đơn&quot; chọn phiếu nợ, quét mã QR trên ứng dụng ngân hàng. Tiền được gạch nợ tự động trong 1-3 phút.
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">
                  3. Hotline Liên hệ Nhà trường:
                </span>
                <div className="flex items-center gap-2 text-blue-600 font-bold mt-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{schoolPhone} (Văn phòng Bán trú)</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 text-center">
              <button
                onClick={onCloseBot}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
