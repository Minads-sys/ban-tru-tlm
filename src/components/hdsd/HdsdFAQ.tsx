"use client";

import { useState } from "react";
import { ChevronDown, Search, HelpCircle, PhoneCall } from "lucide-react";

interface FAQItem {
  id: string;
  q: string;
  a: React.ReactNode;
  category: "login" | "meal" | "payment";
}

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    category: "login",
    q: "Q1: Tôi nhập đúng Họ tên và Ngày sinh nhưng không đăng nhập được?",
    a: (
      <div className="space-y-2">
        <p>Vui lòng kiểm tra các khả năng sau:</p>
        <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
          <li>
            <strong>Kiểm tra Mật khẩu mới:</strong> Nếu bạn đã hoàn thành bước đổi mật khẩu trong lần đầu đăng nhập, hãy nhập <em>mật khẩu mới</em> tự đặt (không còn dùng ngày sinh nữa).
          </li>
          <li>
            <strong>Kiểm tra Mã xác nhận:</strong> Nhập chính xác <strong>6 chữ số cuối</strong> của số Căn cước công dân (CCCD) hoặc Mã số định danh của học sinh (không phải số điện thoại).
          </li>
          <li>
            <strong>Kiểm tra ngày sinh (nếu chưa đổi):</strong> Nhập đủ 8 chữ số dạng <code className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">ddmmyyyy</code> (ví dụ: ngày 05/02/2008 gõ là <code className="bg-orange-50 text-orange-700 px-1 py-0.5 rounded">05022008</code>, không gõ <code className="text-rose-600">522008</code>).
          </li>
          <li>
            <strong>Quên mật khẩu:</strong> Sử dụng tính năng <em>"Quên mật khẩu?"</em> ngay dưới nút Đăng nhập để tự khôi phục lại mật khẩu mặc định (miễn phí 100%), hoặc báo Giáo viên chủ nhiệm để hỗ trợ reset.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "faq-2",
    category: "meal",
    q: "Q2: Con tôi ốm đột xuất vào buổi sáng, có báo cắt suất kịp không?",
    a: (
      <div className="space-y-1.5">
        <p>
          <strong className="text-emerald-700 font-bold">CÓ KỊP</strong>, với điều kiện phụ huynh/học sinh đăng nhập và bấm gửi yêu cầu trước <strong>giờ chốt buổi sáng</strong> của nhà trường (thường là <strong>08:00 sáng</strong>).
        </p>
        <p className="text-slate-600">
          Nếu gửi sau giờ chốt, hệ thống sẽ tự động khóa báo cắt cho ngày hiện tại vì lúc này nhà bếp đã hoàn tất sơ chế và nấu thực phẩm theo số lượng đăng ký.
        </p>
      </div>
    ),
  },
  {
    id: "faq-3",
    category: "meal",
    q: "Q3: Tôi có thể đăng ký cắt suất ăn hoặc đổi món cho tuần sau vào lúc nào?",
    a: (
      <div>
        <p>
          Hệ thống sẽ <strong>tự động mở đăng ký cho tuần kế tiếp từ Thứ Bảy hàng tuần</strong>.
        </p>
        <p className="mt-1 text-slate-600">
          Phụ huynh và học sinh có thể chủ động sắp xếp thời gian vào Thứ Bảy hoặc Chủ Nhật để lên kế hoạch cắt suất hoặc đổi món ăn cho các ngày trong tuần tiếp theo.
        </p>
      </div>
    ),
  },
  {
    id: "faq-4",
    category: "payment",
    q: "Q4: Đã quét mã VietQR và tài khoản ngân hàng trừ tiền nhưng trên web vẫn báo 'Chưa thanh toán'?",
    a: (
      <div className="space-y-2">
        <p>
          Thông thường hệ thống gạch nợ tự động chỉ mất từ <strong>1 - 3 giây</strong>. Trong một số ít trường hợp ngân hàng chuyển mạch ngoài giờ hoặc nghẽn giao dịch, thời gian có thể kéo dài từ 1 - 5 phút.
        </p>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <strong>Cách xử lý:</strong>
          <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-600">
            <li>Bấm <strong>F5</strong> hoặc tải lại trang web sau 1 - 2 phút.</li>
            <li>Nếu sau 15 phút hệ thống vẫn chưa đổi trạng thái, quý phụ huynh chỉ cần chụp lại biên lai chuyển khoản (có mã GD và số tiền) gửi cho Giáo viên chủ nhiệm hoặc Văn phòng Bán trú để được hỗ trợ gạch nợ thủ công ngay lập tức.</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "faq-5",
    category: "payment",
    q: "Q5: Một hóa đơn có thể chia ra chuyển khoản làm nhiều lần được không?",
    a: (
      <div>
        <p className="text-emerald-700 font-bold">
          HOÀN TOÀN ĐƯỢC.
        </p>
        <p className="mt-1 text-slate-600">
          Hệ thống hỗ trợ thanh toán từng phần linh hoạt. Mỗi lần phụ huynh chuyển một số tiền, hệ thống sẽ tự động trừ bớt vào số nợ và cập nhật mã VietQR mới với đúng <strong>Số tiền CÒN NỢ thực tế</strong>. Hóa đơn sẽ hiển thị nhãn <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Đã nộp 1 phần</span> cho đến khi thanh toán đủ 100%.
        </p>
      </div>
    ),
  },
];

export function HdsdFAQ() {
  const [openIds, setOpenIds] = useState<string[]>(["faq-1"]);
  const [searchTerm, setSearchTerm] = useState("");

  const toggle = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredFaqs = FAQS.filter(
    (item) =>
      item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      typeof item.a === "string" && item.a.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm nhanh câu hỏi (đăng nhập, cắt suất, VietQR, lỗi thanh toán...)"
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
        />
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);

            return (
              <div
                key={faq.id}
                className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white transition shadow-2xs hover:border-orange-200"
              >
                <button
                  type="button"
                  onClick={() => toggle(faq.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-800 hover:text-orange-600 transition"
                >
                  <span className="flex items-start gap-2.5">
                    <HelpCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <span>{faq.q}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
                      isOpen ? "rotate-180 text-orange-600" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm border-t border-slate-100 bg-slate-50/40 leading-relaxed text-slate-700 animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-xs sm:text-sm text-slate-500 bg-slate-50 rounded-2xl">
            Không tìm thấy câu hỏi phù hợp với từ khóa &ldquo;{searchTerm}&rdquo;.
          </div>
        )}
      </div>

      {/* Contact prompt */}
      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-rose-50 to-amber-50 border border-orange-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <h6 className="font-bold text-xs sm:text-sm text-slate-900">
              Vẫn cần thêm sự trợ giúp?
            </h6>
            <p className="text-xs text-slate-600">
              Liên hệ ngay Giáo viên chủ nhiệm hoặc Văn phòng Bán trú trường THPT Ten Lơ Man.
            </p>
          </div>
        </div>

        <a
          href="#sec-support"
          className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition shadow-2xs whitespace-nowrap"
        >
          Thông tin liên hệ
        </a>
      </div>
    </div>
  );
}
