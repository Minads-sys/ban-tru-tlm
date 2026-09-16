import Link from "next/link";
import { School, MapPin, Phone, Mail, ShieldCheck, ArrowUpRight, FileText } from "lucide-react";

export function HdsdFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 pt-12 pb-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
          {/* Col 1: School Branding */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-sm">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
                TLM
              </div>
              <span>TRƯỜNG THPT TEN LƠ MAN</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Hệ thống Quản lý Bán trú Điện tử (BAN-TRU-TLM) — Hiện đại hóa công tác dinh dưỡng, nâng cao tính minh bạch và trải nghiệm dịch vụ tiện lợi cho học sinh & phụ huynh.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Cổng thông tin bảo mật & mã hóa VietQR</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider text-xs mb-3">
              Liên kết nhanh
            </h5>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/student-login"
                  className="hover:text-orange-400 transition flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-orange-500" />
                  <span>Cổng Đăng Nhập Học Sinh</span>
                </Link>
              </li>
              <li>
                <a
                  href="/huong-dan-hoc-sinh.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-orange-400 transition flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>Tải Bản Hướng Dẫn PDF</span>
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-orange-400 transition flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cổng Quản Trị Nhà Trường</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Sections Guide */}
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider text-xs mb-3">
              Nghiệp vụ hướng dẫn
            </h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <a href="#sec-login" className="hover:text-white transition">
                  • Đăng nhập 3 yếu tố & Đổi MK
                </a>
              </li>
              <li>
                <a href="#sec-cut" className="hover:text-white transition">
                  • Báo Cắt suất ăn (trừ tiền)
                </a>
              </li>
              <li>
                <a href="#sec-dish" className="hover:text-white transition">
                  • Đăng ký Đổi món theo ngày
                </a>
              </li>
              <li>
                <a href="#sec-debt" className="hover:text-white transition">
                  • Tra cứu nợ & Quét VietQR
                </a>
              </li>
              <li>
                <a href="#sec-faq" className="hover:text-white transition">
                  • Câu hỏi thường gặp (FAQ)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Support & Contact */}
          <div id="sec-support" className="space-y-3">
            <h5 className="font-bold text-white uppercase tracking-wider text-xs mb-3">
              Hỗ trợ kỹ thuật & Liên hệ
            </h5>
            <div className="space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <School className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span>Trường THPT Ten Lơ Man (TP. Hồ Chí Minh)</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Văn phòng Ban Quản lý Bán trú</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Giáo viên chủ nhiệm lớp phụ trách</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© 2026 Hệ thống Quản lý Bán trú Trường THPT Ten Lơ Man (BAN-TRU-TLM).</p>
          <p>Tài liệu chuẩn hóa nghiệp vụ dành cho Học sinh & Phụ huynh.</p>
        </div>
      </div>
    </footer>
  );
}
