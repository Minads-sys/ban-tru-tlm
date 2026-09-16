import Link from "next/link";
import Image from "next/image";
import { FileText, LogIn, KeyRound, UtensilsCrossed, ArrowLeftRight, QrCode, Smartphone, Sparkles, ShieldCheck } from "lucide-react";

export function HdsdHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-rose-600 text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-rose-700/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text Content */}
          <div className="lg:col-span-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold mb-4 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Cổng Thông Tin Bán Trú Điện Tử — THPT Ten Lơ Man</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4 drop-shadow-xs">
              HƯỚNG DẪN THAO TÁC NGHIỆP VỤ BÁN TRÚ
              <span className="block text-amber-200 text-xl sm:text-2xl md:text-3xl font-bold mt-2">
                Dành Cho Học Sinh & Quý Phụ Huynh
              </span>
            </h1>

            <p className="text-slate-100/95 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
              Tài liệu hướng dẫn trực quan, chi tiết từng bước: từ đăng nhập 3 yếu tố, đổi mật khẩu an toàn, báo cắt suất ăn được trừ tiền trực tiếp, đổi món linh hoạt theo ngày đến thanh toán VietQR gạch nợ tự động 1 - 3 giây.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-8">
              <Link
                href="/student-login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-orange-600 hover:text-orange-700 font-extrabold text-sm shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 transition active:scale-95"
              >
                <LogIn className="w-4 h-4 text-orange-600" />
                <span>Đăng Nhập Cổng Học Sinh</span>
              </Link>

              <a
                href="/huong-dan-hoc-sinh.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white font-bold text-sm shadow-sm hover:-translate-y-0.5 transition active:scale-95"
              >
                <FileText className="w-4 h-4 text-amber-200" />
                <span>Tải Bản Hướng Dẫn PDF</span>
              </a>
            </div>

            {/* Feature Highlights Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-left">
              <a
                href="#sec-login"
                className="group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 rounded-xl p-3 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-300">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-white">Đăng Nhập</span>
                </div>
                <p className="text-[11px] text-white/70">Bảo mật 3 yếu tố</p>
              </a>

              <a
                href="#sec-cut"
                className="group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 rounded-xl p-3 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-rose-400/20 flex items-center justify-center text-rose-300">
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-white">Cắt Suất Ăn</span>
                </div>
                <p className="text-[11px] text-white/70">Trừ tiền hóa đơn</p>
              </a>

              <a
                href="#sec-dish"
                className="group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 rounded-xl p-3 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-emerald-400/20 flex items-center justify-center text-emerald-300">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-white">Đổi Món Ăn</span>
                </div>
                <p className="text-[11px] text-white/70">Mặn / Chay / Cháo</p>
              </a>

              <a
                href="#sec-debt"
                className="group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 rounded-xl p-3 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-sky-400/20 flex items-center justify-center text-sky-300">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-white">VietQR Tự Động</span>
                </div>
                <p className="text-[11px] text-white/70">Gạch nợ 1 - 3 giây</p>
              </a>
            </div>
          </div>

          {/* Right Card: Quick QR Scanner on Mobile & App Stats */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full max-w-sm bg-white/95 backdrop-blur-md text-slate-800 rounded-3xl p-5 shadow-2xl border border-white/30 text-center relative group">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900 text-amber-300 font-bold text-[10px] tracking-wider uppercase shadow-md flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                Truy Cập Di Động 24/7
              </div>

              <div className="mt-3 mb-2 flex items-center justify-center">
                <div className="relative w-44 h-44 p-2.5 bg-slate-50 border-2 border-dashed border-orange-300 rounded-2xl shadow-inner flex items-center justify-center">
                  <Image
                    src="/qr-student-login.png"
                    alt="Mã QR Đăng Nhập Học Sinh"
                    width={160}
                    height={160}
                    className="rounded-xl object-contain"
                    priority
                  />
                </div>
              </div>

              <h4 className="font-extrabold text-slate-900 text-sm">
                Quét Mã Vào Cổng Học Sinh
              </h4>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Mở camera điện thoại quét mã hoặc bấm liên kết:
              </p>

              <Link
                href="/student-login"
                className="block w-full py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-mono text-xs font-bold transition border border-orange-200 truncate"
              >
                https://bantrutlm.com/student-login
              </Link>

              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Bảo mật 3 yếu tố</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Gạch nợ VietQR tức thì</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
