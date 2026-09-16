import Link from "next/link";
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
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Sparkles,
  QrCode,
  Copy,
  ExternalLink,
  ChevronRight,
  UserCheck,
  CalendarDays,
  Smartphone
} from "lucide-react";

import { HdsdHero } from "@/components/hdsd/HdsdHero";
import { HdsdSidebar } from "@/components/hdsd/HdsdSidebar";
import { HdsdSectionCard } from "@/components/hdsd/HdsdSectionCard";
import { HdsdStepList } from "@/components/hdsd/HdsdStepList";
import { HdsdInfoBox } from "@/components/hdsd/HdsdInfoBox";
import { HdsdMockupImage } from "@/components/hdsd/HdsdMockupImage";
import { HdsdFAQ } from "@/components/hdsd/HdsdFAQ";

export default function HdsdPage() {
  return (
    <div className="pb-16">
      {/* Hero Header */}
      <HdsdHero />

      {/* Main Container with Sticky Sidebar and Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Left Navigation */}
          <HdsdSidebar />

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-12 min-w-0">

            {/* =========================================================================
                SECTION 1: GIỚI THIỆU TỔNG QUAN
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-overview"
              sectionNumber="1"
              title="Giới Thiệu Tổng Quan Cổng Bán Trú Học Sinh"
              badge="Tổng quan hệ thống"
              themeColor="orange"
              icon={<BookOpen className="w-6 h-6" />}
            >
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                Hệ thống <strong>Quản lý Suất ăn Bán trú - Trường THPT Ten Lơ Man (BAN-TRU-TLM)</strong> được xây dựng nhằm hiện đại hóa công tác quản lý dinh dưỡng học đường, tạo sự thuận tiện, minh bạch tối đa và nhanh chóng cho Học sinh và Quý phụ huynh.
              </p>

              {/* 5 Core Feature Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 my-4">
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-100/80">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs mb-2.5 shadow-2xs">
                    ✂️
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                    Báo Cắt Suất Ăn
                  </h4>
                  <p className="text-xs text-slate-600">
                    Báo trước khi nghỉ học, giảm trừ tiền ăn trực tiếp vào hóa đơn tiền ăn tháng.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100/80">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-2.5 shadow-2xs">
                    🍲
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                    Đổi Món Linh Hoạt
                  </h4>
                  <p className="text-xs text-slate-600">
                    Chuyển đổi tạm thời giữa Cơm mặn, Cơm chay, Cháo dinh dưỡng theo từng ngày.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100/80">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs mb-2.5 shadow-2xs">
                    📊
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                    Xem Công Nợ Realtime
                  </h4>
                  <p className="text-xs text-slate-600">
                    Nắm rõ số ngày ăn dự kiến, số ngày đã cắt suất và số tiền cần nộp thực tế.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100/80">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-xs mb-2.5 shadow-2xs">
                    ⚡
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                    VietQR Tự Động 3s
                  </h4>
                  <p className="text-xs text-slate-600">
                    Quét mã trên App ngân hàng bất kỳ, hệ thống gạch nợ hóa đơn ngay trong 1 - 3 giây.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100/80 sm:col-span-2 md:col-span-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center font-bold text-xs mb-2.5 shadow-2xs">
                    📑
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mb-1">
                    Minh Bạch Lịch Sử Hóa Đơn & Giao Dịch
                  </h4>
                  <p className="text-xs text-slate-600">
                    Tra cứu chi tiết từng đợt nộp tiền, xem lịch sử chuyển khoản đối soát từng giây trong suốt cả năm học.
                  </p>
                </div>
              </div>

              <HdsdInfoBox type="note" title="Khả năng tương thích trên mọi thiết bị">
                Hệ thống hoạt động tối ưu trên tất cả các trình duyệt web: Máy tính để bàn, Laptop, Máy tính bảng và Điện thoại thông minh (giao diện được thiết kế tối ưu riêng cho màn hình di động).
              </HdsdInfoBox>

              {/* PDF Download Section */}
              <div className="mt-4 p-5 rounded-3xl bg-linear-to-r from-orange-500/10 via-rose-500/10 to-amber-500/10 border border-orange-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 font-extrabold text-slate-900 text-sm sm:text-base">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span>Tài liệu hướng dẫn sử dụng dạng PDF</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Quý phụ huynh và học sinh có thể tải về máy hoặc in ra giấy để tham khảo khi cần.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href="/huong-dan-hoc-sinh.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
                  >
                    <span>Xem file PDF</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 2: ĐĂNG NHẬP & ĐỔI MẬT KHẨU LẦN ĐẦU
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-login"
              sectionNumber="2"
              title="Hướng Dẫn Đăng Nhập & Đổi Mật Khẩu Lần Đầu"
              badge="Bắt buộc 3 yếu tố"
              themeColor="orange"
              icon={<KeyRound className="w-6 h-6" />}
            >
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-2">
                  2.1. Địa chỉ truy cập & Cổng đăng nhập
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3">
                  Đường dẫn truy cập trực tiếp:{" "}
                  <Link
                    href="/student-login"
                    className="font-mono text-orange-600 hover:underline font-bold"
                  >
                    https://bantrutlm.com/student-login
                  </Link>{" "}
                  (hoặc vào trang chủ chọn <em>Cổng học sinh & phụ huynh</em>).
                </p>
              </div>

              {/* 3-Factor Credentials Table */}
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-2">
                  2.2. Thông tin đăng nhập bảo mật 3 yếu tố
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3">
                  Để đảm bảo đúng học sinh và bảo mật thông tin tài chính cá nhân, hệ thống yêu cầu 3 trường thông tin:
                </p>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs my-3">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Trường thông tin</th>
                        <th className="p-3.5">Hướng dẫn nhập</th>
                        <th className="p-3.5">Ví dụ minh họa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">
                          1. Họ và tên học sinh
                        </td>
                        <td className="p-3.5 text-slate-600">
                          Nhập đầy đủ Họ và tên học sinh theo danh sách trường (hệ thống thông minh hỗ trợ cả gõ tiếng Việt có dấu hoặc không dấu).
                        </td>
                        <td className="p-3.5 font-mono text-xs bg-slate-50/80 text-slate-800 rounded">
                          <span className="font-semibold text-orange-600">Nguyễn Văn An</span> hoặc <span className="text-slate-600">Nguyen Van An</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">
                          2. Mật khẩu
                        </td>
                        <td className="p-3.5 text-slate-600">
                          Nhập liền <strong>8 chữ số ngày tháng năm sinh</strong> của học sinh theo định dạng <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-mono">ddmmyyyy</code>.
                        </td>
                        <td className="p-3.5 font-mono text-xs bg-slate-50/80 text-slate-800 rounded">
                          Sinh ngày 15/08/2008 → Nhập: <code className="font-bold text-rose-600">15082008</code><br />
                          Sinh ngày 05/02/2009 → Nhập: <code className="font-bold text-rose-600">05022009</code>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">
                          3. Mã xác nhận
                        </td>
                        <td className="p-3.5 text-slate-600">
                          Nhập <strong>6 chữ số cuối cùng</strong> trong dãy số Căn cước công dân (CCCD) hoặc Mã định danh cá nhân của học sinh.
                        </td>
                        <td className="p-3.5 font-mono text-xs bg-slate-50/80 text-slate-800 rounded">
                          Số CCCD là 079208<strong className="text-orange-600 font-bold">012345</strong> → Nhập: <code className="font-bold text-orange-600">012345</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mockup Image 1: Login */}
              <HdsdMockupImage
                src="/hdsd/mockup-login.jpg"
                alt="Giao diện Đăng nhập Cổng Học sinh"
                caption="Hình 1: Màn hình Cổng Đăng nhập Học sinh & Phụ huynh bảo mật 3 yếu tố"
                badge="Màn hình đăng nhập"
              />

              {/* Step List: Login */}
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 mb-2">
                  2.3. Các bước đăng nhập:
                </h4>
                <HdsdStepList
                  color="orange"
                  steps={[
                    { step: 1, title: "Nhập Họ và tên học sinh", desc: "Gõ đúng họ và tên đầy đủ theo hồ sơ nhập học." },
                    { step: 2, title: "Nhập Mật khẩu mặc định", desc: "8 chữ số ngày tháng năm sinh (ddmmyyyy)." },
                    { step: 3, title: "Nhập Mã xác nhận", desc: "6 số cuối của số Căn cước công dân (CCCD)." },
                    { step: 4, title: "Bấm nút 'Đăng nhập'", desc: "Hệ thống kiểm tra đối soát và chuyển vào trang làm việc." },
                  ]}
                />
              </div>

              <HdsdInfoBox type="tip" title="Tài khoản bị ngưng hoạt động?">
                Nếu hệ thống báo <em>&ldquo;Tài khoản bán trú của bạn đã bị ngưng hoạt động&rdquo;</em>, điều này có nghĩa học sinh hiện chưa đăng ký tham gia bán trú hoặc đã hoàn tất thủ tục hủy bán trú. Vui lòng liên hệ Giáo viên chủ nhiệm hoặc Ban Quản lý Bán trú để được hỗ trợ.
              </HdsdInfoBox>

              {/* Force Change Password Section */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 mb-2">
                  2.4. Bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Nhằm tăng cường an toàn dữ liệu cá nhân và bảo vệ giao dịch tiền ăn, ngay sau khi đăng nhập thành công lần đầu bằng Mật khẩu ngày sinh mặc định, hệ thống sẽ tự động chuyển hướng đến màn hình <strong>&ldquo;Bắt buộc đổi mật khẩu&rdquo;</strong> (<code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">/force-change-password</code>).
                </p>

                {/* Mockup Image 2: Force Change Password */}
                <HdsdMockupImage
                  src="/hdsd/mockup-change-password.jpg"
                  alt="Màn hình Bắt buộc đổi mật khẩu lần đầu"
                  caption="Hình 2: Màn hình Bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên"
                  badge="Bảo mật tài khoản"
                />

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2 my-4">
                  <h5 className="font-extrabold text-slate-900">
                    Quy tắc đặt mật khẩu mới:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>Độ dài tối thiểu:</strong> Mật khẩu mới phải có <strong>ít nhất 6 ký tự</strong> (khuyến khích kết hợp chữ và số: ví dụ <code className="text-orange-600 font-mono font-bold">Tenloman@2026</code>, <code className="text-orange-600 font-mono font-bold">An123456</code>...).</li>
                    <li><strong>Không trùng mật khẩu cũ:</strong> Không được đặt trùng với 8 số ngày tháng năm sinh mặc định.</li>
                    <li><strong>Khớp xác nhận:</strong> Ô &ldquo;Nhập lại mật khẩu mới&rdquo; phải trùng khớp 100% với ô &ldquo;Mật khẩu mới&rdquo;.</li>
                    <li><strong>Lưu giữ cẩn thận:</strong> Hãy ghi nhớ mật khẩu mới để sử dụng cho các lần đăng nhập tiếp theo.</li>
                  </ul>
                </div>

                <HdsdInfoBox type="success" title="Sau khi đổi mật khẩu thành công">
                  Hệ thống tự động đưa bạn trở về cổng đăng nhập. <strong>Từ lần thứ hai trở đi</strong>, bạn đăng nhập bằng Họ tên + <strong>Mật khẩu MỚI vừa đặt</strong> + 6 số cuối CCCD.
                </HdsdInfoBox>
              </div>

              {/* Forgot Password Self-Service */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 mb-2">
                  2.5. Khôi phục mật khẩu tự phục vụ khi bị quên (Miễn phí 100%)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                  Nếu bạn lỡ quên mật khẩu mới, hệ thống hỗ trợ <strong>tính năng Tự phục vụ 24/7 hoàn toàn miễn phí</strong> ngay trên giao diện mà không cần chờ mã OTP SMS hay Email:
                </p>

                {/* Mockup Image 3: Forgot Password */}
                <HdsdMockupImage
                  src="/hdsd/mockup-forgot-password.jpg"
                  alt="Màn hình Khôi phục mật khẩu học sinh"
                  caption="Hình 3: Giao diện Khôi phục mật khẩu tự phục vụ đối soát 4 trường thông tin"
                  badge="Khôi phục tự phục vụ"
                />

                <HdsdStepList
                  color="blue"
                  steps={[
                    { step: 1, title: "Bấm 'Quên mật khẩu?'", desc: "Tại màn hình đăng nhập (/student-login), bấm vào liên kết 'Quên mật khẩu?'." },
                    { step: 2, title: "Điền 4 trường đối soát", desc: "Gồm: Họ tên học sinh, Số CCCD (hệ thống tự thông minh nhận diện 11 hay 12 số), Ngày sinh, và Số điện thoại Phụ huynh đã đăng ký tại trường." },
                    { step: 3, title: "Bấm 'Xác minh & Khôi phục'", desc: "Hệ thống sẽ đặt lại mật khẩu về lại Ngày sinh mặc định (ddmmyyyy). Bấm đăng nhập lại và tiến hành đổi mật khẩu mới." },
                  ]}
                />

                <HdsdInfoBox type="warning" title="Phòng chống đoán mò thông tin">
                  Hệ thống giới hạn tối đa <strong>5 lần thử sai trong 15 phút</strong>. Nếu không nhớ số điện thoại phụ huynh đã khai báo ban đầu, vui lòng liên hệ Giáo viên chủ nhiệm để được hỗ trợ cấp lại.
                </HdsdInfoBox>
              </div>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 3: GIAO DIỆN TRANG CHỦ & HỒ SƠ
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-home"
              sectionNumber="3"
              title="Giao Diện Trang Chủ & Hồ Sơ Học Sinh"
              badge="Tổng quan Dashboard"
              themeColor="purple"
              icon={<LayoutDashboard className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Sau khi đăng nhập thành công, hệ thống chuyển tới màn hình bảng điều khiển trung tâm:
              </p>

              {/* Mockup Image 4: Home Dashboard */}
              <HdsdMockupImage
                src="/hdsd/mockup-home.jpg"
                alt="Giao diện Trang chủ và 4 Tab nghiệp vụ"
                caption="Hình 4: Bảng điều khiển chính gồm Hồ sơ học sinh và 4 Tab nghiệp vụ bán trú"
                badge="Màn hình chính"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-extrabold text-slate-900 text-sm mb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Thẻ thông tin học sinh (Profile Card)</span>
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li>Họ và tên học sinh, Lớp học hiện tại.</li>
                    <li>Số CCCD / Mã định danh học sinh.</li>
                    <li>Ngày sinh & Giới tính.</li>
                    <li>Chế độ suất ăn mặc định (Cơm mặn / Cơm chay / Cháo).</li>
                    <li>Số điện thoại phụ huynh đăng ký.</li>
                    <li>Huy hiệu trạng thái: <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">Đang ăn bán trú</span>.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-extrabold text-slate-900 text-sm mb-2 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-orange-600" />
                    <span>4 Tab nghiệp vụ chính</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span>1. Cắt suất ăn: Báo nghỉ ăn có trừ tiền</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>2. Đổi món ăn: Đổi món theo ngày</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>3. DS công nợ: Phiếu tiền ăn & mã VietQR</span>
                    </div>
                    <div className="flex items-center gap-2 text-sky-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <span>4. Lịch sử thanh toán: Tra cứu cả năm học</span>
                    </div>
                  </div>
                </div>
              </div>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 4: BÁO CẮT SUẤT ĂN
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-cut"
              sectionNumber="4"
              title="Nghiệp Vụ 1: Báo Cắt Suất Ăn (Giảm Trừ Tiền Vào Hóa Đơn)"
              badge="Giảm trừ tiền ăn"
              themeColor="red"
              icon={<UtensilsCrossed className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Áp dụng khi học sinh nghỉ học (bị ốm, gia đình có việc bận, đi thi cử...) để nhà bếp không chuẩn bị suất ăn và <strong>học sinh được trừ tiền suất ăn vào hóa đơn cuối tháng</strong>.
              </p>

              {/* Visual CSS Flowchart */}
              <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-rose-50 to-orange-50 border border-rose-200">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider mb-3 text-center">
                  Sơ đồ quy trình Cắt suất ăn
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs font-semibold">
                    <span className="block text-rose-600 font-bold mb-1">Bước 1</span>
                    Chọn Ngày muốn cắt suất
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs font-semibold">
                    <span className="block text-rose-600 font-bold mb-1">Bước 2</span>
                    Nhập Lý do & Bấm Gửi yêu cầu
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs font-semibold">
                    <span className="block text-amber-600 font-bold mb-1">Bước 3</span>
                    Ghi nhận: &ldquo;Chờ duyệt&rdquo;
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs font-semibold">
                    <span className="block text-emerald-600 font-bold mb-1">Bước 4</span>
                    Duyệt thành công → Khấu trừ tiền
                  </div>
                </div>
              </div>

              {/* Rules & Conditions */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm">
                  4.1. Quy tắc & Điều kiện cắt suất hợp lệ:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-orange-500" />
                      <span>Thời gian được báo trước</span>
                    </div>
                    <p className="text-slate-600 text-xs">
                      Báo cắt trong tuần hiện tại. Hệ thống mở đăng ký tuần kế tiếp từ <strong>Thứ Bảy hàng tuần</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-rose-500" />
                      <span>Giờ chốt sáng (Cutoff Time)</span>
                    </div>
                    <p className="text-slate-600 text-xs">
                      Cắt cho chính ngày hôm nay phải gửi trước <strong>08:00 sáng</strong>. Sau giờ chốt, hệ thống khóa lại.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mockup Image 5: Cancel Meal */}
              <HdsdMockupImage
                src="/hdsd/mockup-cancel-meal.jpg"
                alt="Giao diện Báo Cắt Suất Ăn và Danh sách theo dõi"
                caption="Hình 5: Tab Cắt Suất Ăn gồm Form báo cắt và Bảng theo dõi trạng thái Chờ duyệt / Đã duyệt"
                badge="Nghiệp vụ cắt suất"
              />

              {/* Step by Step */}
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm mb-2">
                  4.2. Các bước thực hiện:
                </h4>
                <HdsdStepList
                  color="red"
                  steps={[
                    { step: 1, title: "Chọn Tab 'Cắt suất ăn'", desc: "Trên màn hình chính, bấm vào tab Cắt suất ăn màu cam đỏ." },
                    { step: 2, title: "Chọn Ngày cắt suất", desc: "Bấm vào ô lịch và chọn ngày học sinh nghỉ ăn." },
                    { step: 3, title: "Nhập lý do cụ thể", desc: "Gõ lý do rõ ràng (Ví dụ: Cháu bị sốt nghỉ ốm, Đi thi học sinh giỏi, Nhà có việc bận...)." },
                    { step: 4, title: "Bấm 'Gửi yêu cầu'", desc: "Hệ thống ghi nhận và chuyển trạng thái sang Chờ duyệt." },
                  ]}
                />
              </div>

              {/* Status explanation */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Ý nghĩa trạng thái tại bảng &ldquo;Lịch sử Cắt suất&rdquo;:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <strong className="block text-amber-700 font-bold mb-0.5">Chờ duyệt:</strong>
                    Đã ghi nhận, đang chờ Nhà trường phê duyệt.
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <strong className="block text-emerald-700 font-bold mb-0.5">Đã duyệt:</strong>
                    Nhà trường đã chấp thuận, tiền sẽ được trừ vào phiếu thu tháng.
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                    <strong className="block text-rose-700 font-bold mb-0.5">Từ chối:</strong>
                    Yêu cầu không hợp lệ hoặc gửi sau giờ quy định.
                  </div>
                </div>
              </div>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 5: ĐỔI MÓN ĂN
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-dish"
              sectionNumber="5"
              title="Nghiệp Vụ 2: Đăng Ký Đổi Món Ăn Theo Ngày"
              badge="Linh hoạt thực đơn"
              themeColor="green"
              icon={<ArrowLeftRight className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Áp dụng khi học sinh muốn đổi khẩu vị sang loại món ăn khác trong từng ngày cụ thể (ví dụ ngày Rằm/mùng 1 ăn cơm chay, hoặc khi sức khỏe yếu cần ăn cháo dinh dưỡng) thay vì món mặc định thường ngày.
              </p>

              {/* Rules */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs sm:text-sm">
                <h4 className="font-extrabold text-emerald-900">
                  Quy tắc & Điều kiện đổi món:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li><strong>Thời hạn đăng ký:</strong> Phải đăng ký trước <strong>16:30 chiều ngày hôm trước</strong>. Không thể đổi món cho ngày hôm nay hoặc ngày đã qua.</li>
                  <li><strong>Ràng buộc với Cắt suất:</strong> Nếu ngày đó đã có yêu cầu Cắt suất ăn đang có hiệu lực (Chờ duyệt hoặc Đã duyệt), hệ thống sẽ từ chối đổi món.</li>
                  <li><strong>Mở tuần tiếp theo:</strong> Hệ thống mở cho tuần sau từ Thứ Bảy hàng tuần.</li>
                </ul>
              </div>

              {/* 3 Food Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-center text-xs sm:text-sm">
                <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200">
                  <div className="text-2xl mb-1">🍖</div>
                  <strong className="font-extrabold text-orange-900 block">Cơm mặn</strong>
                  <span className="text-xs text-slate-500">Thực đơn chuẩn phong phú</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl mb-1">🥗</div>
                  <strong className="font-extrabold text-emerald-900 block">Cơm chay</strong>
                  <span className="text-xs text-slate-500">Món chay dinh dưỡng thanh tịnh</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-2xl mb-1">🥣</div>
                  <strong className="font-extrabold text-amber-900 block">Cháo dinh dưỡng</strong>
                  <span className="text-xs text-slate-500">Dễ tiêu hóa khi thể trạng yếu</span>
                </div>
              </div>

              {/* Cancel Swap steps */}
              <div className="pt-2">
                <h4 className="font-extrabold text-slate-900 text-sm mb-2">
                  Hủy yêu cầu đổi món (Quay về món mặc định):
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Trong bảng &ldquo;Lịch sử Đổi món&rdquo;, đối với các ngày trong tương lai (chưa diễn ra và chưa khóa sổ 16:30), bên cạnh sẽ có nút <strong className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Hủy đổi</strong>. Chỉ cần bấm nút và xác nhận là suất ăn sẽ trở về chế độ ban đầu.
                </p>
              </div>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 6: CÔNG NỢ & THANH TOÁN VIETQR
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-debt"
              sectionNumber="6"
              title="Nghiệp Vụ 3: Xem Công Nợ & Thanh Toán Tiền Ăn Trực Tuyến"
              badge="VietQR Gạch nợ 3s"
              themeColor="amber"
              icon={<CreditCard className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tab <strong>&ldquo;DS công nợ&rdquo;</strong> giúp phụ huynh theo dõi chi tiết các khoản tiền ăn theo từng tháng và thực hiện chuyển khoản thanh toán trực tuyến tự động qua chuẩn VietQR thông minh.
              </p>

              {/* Mockup Image 6: Payment */}
              <HdsdMockupImage
                src="/hdsd/mockup-payment.jpg"
                alt="Giao diện Phiếu tiền ăn và mã VietQR thanh toán tự động"
                caption="Hình 6: Hóa đơn tiền ăn chi tiết kèm mã VietQR tự động điền sẵn số tiền và nội dung"
                badge="Giao dịch VietQR"
              />

              {/* Stats on invoice */}
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm mb-2">
                  6.1. Các thông số minh bạch trên phiếu tiền ăn:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Số ngày ăn dự kiến</span>
                    <strong className="text-sm font-extrabold text-slate-900">22 ngày</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-emerald-700 block">Đã duyệt cắt suất</span>
                    <strong className="text-sm font-extrabold text-emerald-800">-2 ngày</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Tổng tiền hóa đơn</span>
                    <strong className="text-sm font-extrabold text-slate-900">800.000đ</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-rose-700 block">SỐ TIỀN CÒN NỢ</span>
                    <strong className="text-sm font-extrabold text-rose-700">720.000đ</strong>
                  </div>
                </div>
              </div>

              {/* How to Pay via VietQR */}
              <div className="pt-2">
                <h4 className="font-extrabold text-slate-900 text-sm mb-2">
                  6.2. Thanh toán qua mã VietQR thông minh (Khuyên dùng — Nhanh nhất):
                </h4>
                <HdsdStepList
                  color="amber"
                  steps={[
                    { step: 1, title: "Mở ứng dụng Ngân hàng", desc: "Mở App bất kỳ trên điện thoại (Vietcombank, BIDV, Agribank, VietinBank, Techcombank, MB, Momo...)." },
                    { step: 2, title: "Chọn Quét QR Pay", desc: "Hướng camera quét Mã QR hiển thị trực tiếp trên hóa đơn." },
                    { step: 3, title: "Hệ thống tự điền 100% dữ liệu", desc: "Đúng số tài khoản BIDV, đúng số tiền còn nợ, đúng nội dung chuyển khoản mã học sinh." },
                    { step: 4, title: "Gạch nợ tức thì 1 - 3 giây", desc: "Ngay khi chuyển tiền thành công, trạng thái hóa đơn lập tức đổi thành Đã thanh toán đủ mà không cần F5 tải lại trang." },
                  ]}
                />
              </div>

              {/* Manual Transfer details */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
                <h5 className="font-extrabold text-slate-900">
                  6.3. Chuyển khoản thủ công (Nếu không tiện quét mã QR):
                </h5>
                <p className="text-slate-600">
                  Phụ huynh có thể bấm nút <strong>&ldquo;Sao chép&rdquo;</strong> trên màn hình và chuyển khoản theo thông tin:
                </p>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                  <div>• Ngân hàng thụ hưởng: <strong>BIDV</strong></div>
                  <div>• Số tài khoản: <strong>96247BANTRUTLM08</strong></div>
                  <div>• Tên tài khoản: <strong>HOANG KIM</strong></div>
                  <div>• Cú pháp nội dung: <strong className="text-orange-600">BSTLM [Mã học sinh] T[Tháng][Năm]</strong></div>
                  <div className="text-slate-500 italic text-[11px]">(Ví dụ học sinh mã BT00012 nộp tháng 09/2026: BSTLM BT00012 T0926)</div>
                </div>
              </div>

              <HdsdInfoBox type="warning" title="Bắt buộc ghi đúng cú pháp nội dung chuyển khoản">
                Phụ huynh vui lòng bấm nút <strong>Sao chép</strong> nội dung trên màn hình để tránh sai sót. Nếu ghi sai cú pháp hoặc thiếu mã học sinh, hệ thống không thể tự động nhận diện gạch nợ ngay lập tức.
              </HdsdInfoBox>
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 7: LỊCH SỬ HÓA ĐƠN & GIAO DỊCH
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-history"
              sectionNumber="7"
              title="Nghiệp Vụ 4: Tra Cứu Lịch Sử Hóa Đơn & Giao Dịch Cả Năm"
              badge="Tra cứu minh bạch"
              themeColor="blue"
              icon={<History className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tab <strong>&ldquo;Lịch sử thanh toán&rdquo;</strong> cho phép phụ huynh và học sinh tra cứu toàn bộ hồ sơ tiền ăn, đối soát từng khoản tiền đã nộp trong suốt cả năm học.
              </p>

              <HdsdStepList
                color="blue"
                steps={[
                  { step: 1, title: "Chọn Tab 'Lịch sử thanh toán'", desc: "Truy cập tab thứ tư trên thanh điều hướng." },
                  { step: 2, title: "Chọn Năm học cần xem", desc: "Màn hình hiển thị tổng số tiền đã đóng và số hóa đơn đã hoàn tất trong năm." },
                  { step: 3, title: "Chọn Tháng cụ thể", desc: "Bấm vào menu xổ xuống để xem chi tiết từng tháng (số ngày ăn, số ngày cắt suất, tiền còn lại)." },
                  { step: 4, title: "Xem nhật ký giao dịch ngân hàng", desc: "Liệt kê chi tiết từng lần chuyển khoản: số tiền, thời gian chính xác từng giây và mã đối soát giao dịch." },
                ]}
              />
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 8: ĐĂNG XUẤT AN TOÀN
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-logout"
              sectionNumber="8"
              title="Hướng Dẫn Đăng Xuất An Toàn"
              badge="Bảo vệ tài khoản"
              themeColor="orange"
              icon={<LogOut className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Khi hoàn tất thao tác, đặc biệt là khi sử dụng máy tính ở phòng thực hành trường, quán internet hoặc mượn thiết bị của người khác, hãy nhớ đăng xuất tài khoản:
              </p>

              <HdsdStepList
                color="orange"
                steps={[
                  { step: 1, title: "Nhìn lên góc trên cùng bên phải", desc: "Tại thanh tiêu đề của màn hình làm việc." },
                  { step: 2, title: "Bấm nút 'Đăng xuất'", desc: "Biểu tượng cánh cửa mở kèm chữ Đăng xuất." },
                  { step: 3, title: "Kết thúc phiên an toàn", desc: "Hệ thống xóa phiên đăng nhập trên thiết bị và đưa bạn về cổng đăng nhập bảo mật." },
                ]}
              />
            </HdsdSectionCard>

            {/* =========================================================================
                SECTION 9: CÂU HỎI THƯỜNG GẶP (FAQ)
            ========================================================================= */}
            <HdsdSectionCard
              id="sec-faq"
              sectionNumber="9"
              title="Những Lưu Ý Quan Trọng & Câu Hỏi Thường Gặp (FAQ)"
              badge="Giải đáp nhanh 24/7"
              themeColor="orange"
              icon={<HelpCircle className="w-6 h-6" />}
            >
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Tổng hợp các thắc mắc phổ biến nhất của Quý phụ huynh và Học sinh trong quá trình sử dụng hệ thống bán trú:
              </p>

              {/* Client FAQ Accordion Component with Live Search */}
              <HdsdFAQ />
            </HdsdSectionCard>

          </div>
        </div>
      </div>
    </div>
  );
}
