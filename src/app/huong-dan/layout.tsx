import type { Metadata } from "next";
import { HdsdNavBar } from "@/components/hdsd/HdsdNavBar";
import { HdsdFooter } from "@/components/hdsd/HdsdFooter";
import { HdsdScrollProgress } from "@/components/hdsd/HdsdScrollProgress";

export const metadata: Metadata = {
  title: "Hướng Dẫn Nghiệp Vụ Bán Trú — THPT Ten Lơ Man",
  description:
    "Cẩm nang hướng dẫn thao tác sử dụng phần mềm Bán Trú dành riêng cho Học sinh & Phụ huynh trường THPT Ten Lơ Man: Đăng nhập 3 yếu tố, cắt suất ăn, đổi món ăn, xem công nợ và thanh toán VietQR tự động.",
  openGraph: {
    title: "Hướng Dẫn Bán Trú — THPT Ten Lơ Man",
    description:
      "Tài liệu thao tác hệ thống bán trú điện tử dành cho học sinh và phụ huynh.",
    images: ["/hdsd/mockup-hero-desktop.jpg"],
  },
};

export default function HdsdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased selection:bg-orange-100 selection:text-orange-900">
      <HdsdScrollProgress />
      <HdsdNavBar />
      <main className="grow">{children}</main>
      <HdsdFooter />
    </div>
  );
}
