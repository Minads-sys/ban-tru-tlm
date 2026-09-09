"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText, FileDown } from "lucide-react";

export interface DebtNotificationBill {
  id: string;
  month: number;
  year: number;
  student: {
    id: string;
    studentCode: string;
    boardingCode?: string | null;
    birthDate?: string | Date | null;
    user: {
      fullName: string;
    };
    class: {
      name: string;
    };
  };
}

export type DebtPrintLayout = "A5_LANDSCAPE_2UP" | "A4_PORTRAIT_4UP";

interface Props {
  bills: DebtNotificationBill[];
  schoolName?: string;
  month: number;
  year: number;
  className?: string;
  onClose: () => void;
  defaultLayout?: DebtPrintLayout;
}

export function DebtNotificationPrint({
  bills,
  schoolName = "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN",
  month,
  year,
  className,
  onClose,
  defaultLayout = "A5_LANDSCAPE_2UP",
}: Props) {
  const [layout, setLayout] = useState<DebtPrintLayout>(defaultLayout);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    // Sinh ma QR link dang nhap goc mau den trang
    QRCode.toDataURL("https://bantrutlm.com/student-login", {
      width: 260,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url: string) => setQrCodeUrl(url))
      .catch((err: any) => console.error("Lỗi tạo QR Code:", err));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    const originalTitle = document.title;
    const cleanClassName = className ? `_Lop_${className.replace(/\s+/g, "_")}` : "_Toan_Truong";
    const layoutSuffix = isA5 ? "_A5_Ngang" : "_A4_Doc";
    document.title = `Thong_Bao_Phat_Hanh_Phieu_Thanh_Toan${cleanClassName}_T${String(month).padStart(2, "0")}_${year}${layoutSuffix}`;

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  };

  // Chia nhom theo layout:
  // - A5_LANDSCAPE_2UP: 2 phieu A6 tren 1 to A5 ngang
  // - A4_PORTRAIT_4UP: 4 phieu A6 tren 1 to A4 doc
  const chunkSize = layout === "A5_LANDSCAPE_2UP" ? 2 : 4;
  const chunkedBills: DebtNotificationBill[][] = [];
  for (let i = 0; i < bills.length; i += chunkSize) {
    chunkedBills.push(bills.slice(i, i + chunkSize));
  }

  const isA5 = layout === "A5_LANDSCAPE_2UP";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm overflow-y-auto flex flex-col items-center py-6 print:p-0 print:m-0 print:bg-white print:static print:inset-auto">
      {/* Thanh cong cu dieu khien (An khi in) */}
      <div className="sticky top-4 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 px-5 mb-6 flex flex-wrap items-center justify-between gap-4 max-w-4xl w-[95%] no-print font-sans">
        <div>
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            In thông báo phát hành phiếu thanh toán (Chỉ học sinh còn nợ)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tháng {month}/{year} {className ? `• Lớp ${className}` : "• Toàn trường"} • Tổng số:{" "}
            <span className="font-bold text-amber-600">{bills.length} học sinh</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chon layout in */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setLayout("A5_LANDSCAPE_2UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A5_LANDSCAPE_2UP"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A5 ngang (2 phiếu A6 / tờ)
            </button>
            <button
              onClick={() => setLayout("A4_PORTRAIT_4UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A4_PORTRAIT_4UP"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 dọc (4 phiếu A6 / tờ)
            </button>
          </div>

          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 shadow hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            In ngay (Print)
          </Button>

          <Button
            onClick={handleExportPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            title="Lưu file PDF với tên đặt sẵn chuẩn đẹp (Chọn 'Lưu dưới dạng PDF' trong cửa sổ in)"
          >
            <FileDown className="w-4 h-4" />
            Xuất PDF
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4 mr-1" /> Đóng
          </Button>
        </div>
      </div>

      {/* Style in an chuyen nghiep: Chuan Den Trang 100% va Font Times New Roman */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: ${isA5 ? "A5 landscape" : "A4 portrait"};
              margin: 0mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: 'Times New Roman', Times, serif !important;
            }
            .no-print, .no-print * {
              display: none !important;
            }
            .page-break {
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `,
        }}
      />

      {/* Vung xem truoc & In */}
      <div
        className="flex flex-col gap-6 print:gap-0 w-full items-center text-black"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {chunkedBills.map((group, pageIndex) => (
          <div
            key={pageIndex}
            className={`bg-white text-black shadow-2xl print:shadow-none box-border relative overflow-hidden ${
              pageIndex < chunkedBills.length - 1 ? "page-break" : ""
            }`}
            style={{
              width: "210mm",
              height: isA5 ? "148.5mm" : "297mm",
              minHeight: isA5 ? "148.5mm" : "297mm",
              maxHeight: isA5 ? "148.5mm" : "297mm",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: isA5 ? "1fr" : "1fr 1fr",
            }}
          >
            {group.map((bill, itemIndex) => {
              const fullName = bill.student?.user?.fullName || "";
              const clsName = bill.student?.class?.name || "";

              return (
                <div
                  key={bill.id}
                  className={`box-border flex flex-col justify-between border-black text-black p-[5.5mm] ${
                    isA5
                      ? `${itemIndex === 0 ? "border-r border-dashed" : ""}`
                      : `${itemIndex % 2 === 0 ? "border-r border-dashed" : ""} ${
                          itemIndex < 2 ? "border-b border-dashed" : ""
                        }`
                  }`}
                  style={{
                    height: "148.5mm",
                    width: "105mm",
                  }}
                >
                  {/* Noi dung chinh cua 1 phieu A6 */}
                  <div className="flex flex-col h-full justify-between">
                    {/* Header Phieu */}
                    <div className="text-center border-b border-black pb-1 mb-1">
                      <h3 className="font-bold uppercase tracking-tight text-black text-[11px] leading-tight">
                        {schoolName}
                      </h3>
                      <h1 className="font-extrabold uppercase text-black text-[14px] leading-snug mt-0.5">
                        THÔNG BÁO
                      </h1>
                      <p className="font-bold uppercase text-black text-[10.5px] mt-0.5">
                        PHÁT HÀNH PHIẾU THANH TOÁN TIỀN ĂN BÁN TRÚ THÁNG {bill.month}/{bill.year}
                      </p>
                    </div>

                    {/* Kinh gui */}
                    <div className="my-0.5">
                      <p className="leading-normal text-black text-[11.2px]">
                        Kính gửi: Quý Phụ huynh em{" "}
                        <span className="uppercase font-bold underline underline-offset-2">
                          {fullName}
                        </span>{" "}
                        - Lớp: <span className="font-bold">{clsName}</span>,
                      </p>

                      <p className="leading-relaxed text-black text-justify mt-1 text-[10.5px] indent-3">
                        Căn tin Châu Phương Thảo tại trường Tenlơman xin thông báo: Phiếu thanh toán tiền ăn bán trú đã được cập nhật trên ứng dụng. Quý Phụ huynh vui lòng kiểm tra thông tin và hoàn tất thanh toán theo các phương thức sau:
                      </p>
                    </div>

                    {/* Phuong thuc 1: Truc tuyen */}
                    <div className="border border-black rounded bg-transparent p-1.5 my-0.5">
                      <p className="font-bold text-black mb-1 text-[11px]">
                        1. Thanh toán trực tuyến qua mã QR:
                      </p>

                      <div className="flex items-center gap-2.5">
                        {qrCodeUrl && (
                          <div className="shrink-0 flex flex-col items-center p-1 border border-black rounded bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeUrl}
                              alt="QR App"
                              className="w-[62px] h-[62px]"
                            />
                            <span className="font-bold text-black text-[8px] mt-0.5">
                              Quét mở App
                            </span>
                          </div>
                        )}
                        <div className="leading-relaxed text-black flex-1 text-[10.2px]">
                          <p className="font-semibold text-black mb-1">
                            Truy cập link:{" "}
                            <span className="underline font-bold">
                              https://bantrutlm.com/student-login
                            </span>
                          </p>
                          <div className="space-y-0.5 pl-0.5 text-[9.8px]">
                            <p>• <b>Tên đăng nhập:</b> Điền Họ và Tên học sinh</p>
                            <p>• <b>Mật khẩu:</b> Ngày tháng năm sinh viết liền (ddmmyyyy)</p>
                            <p>• <b>Mã xác nhận:</b> 6 số cuối CCCD / Mã định danh</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-1 italic text-black leading-tight text-[9.5px]">
                        Quý Phụ huynh kiểm tra chi tiết phiếu và quét mã QR chuyển khoản trực tiếp trên ứng dụng.
                      </p>
                    </div>

                    {/* Phuong thuc 2: Tien mat */}
                    <div className="text-black pl-0.5 text-[10.5px] my-0.5">
                      <p className="font-bold text-black">2. Thanh toán bằng tiền mặt:</p>
                      <p className="text-black pl-3 mt-0.5">
                        Quý Phụ huynh vui lòng đến trực tiếp Căn tin nhà trường để đóng tiền.
                      </p>
                    </div>

                    {/* Luu y */}
                    <div className="text-black leading-relaxed border-t border-black space-y-0.5 text-[9.8px] pt-1 my-0.5">
                      <p className="italic">
                        • Nếu Quý Phụ huynh đã hoàn tất thanh toán trước đó, vui lòng bỏ qua thông báo này.
                      </p>
                      <p>
                        • Mọi thắc mắc hoặc cần hỗ trợ, xin vui lòng liên hệ: <b>0909 932 627</b> (cô Thu Trang).
                      </p>
                    </div>

                    {/* Footer / Ky ten */}
                    <div className="flex justify-end text-right border-t border-black pt-1">
                      <div>
                        <p className="italic text-black text-[9.5px]">
                          TP. Hồ Chí Minh, tháng {bill.month} năm {bill.year}
                        </p>
                        <p className="font-bold uppercase text-black mt-0.5 text-[10.8px]">
                          Căn tin Châu Phương Thảo
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
