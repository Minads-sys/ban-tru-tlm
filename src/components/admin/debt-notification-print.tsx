"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText } from "lucide-react";

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

interface Props {
  bills: DebtNotificationBill[];
  schoolName?: string;
  month: number;
  year: number;
  className?: string;
  onClose: () => void;
  defaultLayout?: "A6_4UP" | "A5_2UP";
}

export function DebtNotificationPrint({
  bills,
  schoolName = "CĂN TIN CHÂU PHƯƠNG THẢO - CN TEN LƠ MAN",
  month,
  year,
  className,
  onClose,
  defaultLayout = "A6_4UP",
}: Props) {
  const [layout, setLayout] = useState<"A6_4UP" | "A5_2UP">(defaultLayout);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    // Sinh ma QR link dang nhap goc mau den trang
    QRCode.toDataURL("https://bantrutlm.com/student-login", {
      width: 280,
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

  // Chia nhom theo layout (4 phieu A6 / trang A4 hoac 2 phieu A5 / trang A4)
  const chunkSize = layout === "A6_4UP" ? 4 : 2;
  const chunkedBills: DebtNotificationBill[][] = [];
  for (let i = 0; i < bills.length; i += chunkSize) {
    chunkedBills.push(bills.slice(i, i + chunkSize));
  }

  const isA5 = layout === "A5_2UP";

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
              onClick={() => setLayout("A6_4UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A6_4UP" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 (4 phiếu A6)
            </button>
            <button
              onClick={() => setLayout("A5_2UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A5_2UP" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 (2 phiếu A5)
            </button>
          </div>

          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            In ngay (Print)
          </Button>

          <Button onClick={onClose} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">
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
              size: A4 portrait;
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
            .a4-page-break {
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
            className={`bg-white text-black shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] max-h-[297mm] h-[297mm] box-border relative overflow-hidden ${
              pageIndex < chunkedBills.length - 1 ? "a4-page-break" : ""
            }`}
            style={{
              display: "grid",
              gridTemplateColumns: isA5 ? "1fr" : "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
            }}
          >
            {group.map((bill, itemIndex) => {
              const fullName = bill.student?.user?.fullName || "";
              const clsName = bill.student?.class?.name || "";

              return (
                <div
                  key={bill.id}
                  className={`box-border flex flex-col justify-between border-black text-black ${
                    isA5
                      ? `px-[12mm] py-[6mm] ${itemIndex === 0 ? "border-b border-dashed" : ""}`
                      : `p-[5.5mm] ${itemIndex % 2 === 0 ? "border-r border-dashed" : ""} ${
                          itemIndex < 2 ? "border-b border-dashed" : ""
                        }`
                  }`}
                  style={{
                    height: "148.5mm",
                    width: isA5 ? "210mm" : "105mm",
                  }}
                >
                  {/* Noi dung chinh */}
                  <div className="flex flex-col h-full justify-between">
                    {/* Header Phieu */}
                    <div className="text-center border-b border-black pb-1 mb-1">
                      <h3
                        className={`font-bold uppercase tracking-tight text-black leading-tight ${
                          isA5 ? "text-[14px]" : "text-[11px]"
                        }`}
                      >
                        {schoolName}
                      </h3>
                      <h1
                        className={`font-extrabold uppercase text-black leading-snug mt-0.5 ${
                          isA5 ? "text-[18px]" : "text-[13.5px]"
                        }`}
                      >
                        THÔNG BÁO
                      </h1>
                      <p
                        className={`font-bold uppercase text-black mt-0.5 ${
                          isA5 ? "text-[13px]" : "text-[10px]"
                        }`}
                      >
                        PHÁT HÀNH PHIẾU THANH TOÁN TIỀN ĂN BÁN TRÚ THÁNG {bill.month}/{bill.year}
                      </p>
                    </div>

                    {/* Kinh gui */}
                    <div className={isA5 ? "my-1" : "my-0.5"}>
                      <p
                        className={`leading-normal text-black ${
                          isA5 ? "text-[13.5px]" : "text-[11px]"
                        }`}
                      >
                        Kính gửi: Quý Phụ huynh em{" "}
                        <span className="uppercase font-bold underline underline-offset-2">
                          {fullName}
                        </span>{" "}
                        - Lớp: <span className="font-bold">{clsName}</span>,
                      </p>

                      <p
                        className={`leading-relaxed text-black text-justify mt-1 indent-3 ${
                          isA5 ? "text-[13px]" : "text-[10.5px]"
                        }`}
                      >
                        Căn tin Châu Phương Thảo tại trường Tenlơman xin thông báo: Phiếu thanh toán tiền ăn bán trú đã được cập nhật trên ứng dụng. Quý Phụ huynh vui lòng kiểm tra thông tin và hoàn tất thanh toán theo các phương thức sau:
                      </p>
                    </div>

                    {/* Phuong thuc 1: Truc tuyen */}
                    <div
                      className={`border border-black rounded bg-transparent ${
                        isA5 ? "p-2.5 my-1" : "p-1.5 my-0.5"
                      }`}
                    >
                      <p
                        className={`font-bold text-black mb-1 ${
                          isA5 ? "text-[13.5px]" : "text-[10.8px]"
                        }`}
                      >
                        1. Thanh toán trực tuyến qua mã QR:
                      </p>

                      <div className="flex items-center gap-3">
                        {qrCodeUrl && (
                          <div className="shrink-0 flex flex-col items-center p-1 border border-black rounded bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeUrl}
                              alt="QR App"
                              className={isA5 ? "w-[75px] h-[75px]" : "w-[60px] h-[60px]"}
                            />
                            <span className={`font-bold text-black mt-0.5 ${isA5 ? "text-[9px]" : "text-[8px]"}`}>
                              Quét mở App
                            </span>
                          </div>
                        )}
                        <div className={`leading-relaxed text-black flex-1 ${isA5 ? "text-[13px]" : "text-[10.2px]"}`}>
                          <p className="font-semibold text-black mb-1">
                            Truy cập link:{" "}
                            <span className="underline font-bold">
                              https://bantrutlm.com/student-login
                            </span>
                          </p>
                          <div className={`space-y-0.5 pl-0.5 ${isA5 ? "text-[12.5px]" : "text-[9.8px]"}`}>
                            <p>• <b>Tên đăng nhập:</b> Điền Họ và Tên học sinh</p>
                            <p>• <b>Mật khẩu:</b> Ngày tháng năm sinh viết liền (ddmmyyyy)</p>
                            <p>• <b>Mã xác nhận:</b> 6 số cuối CCCD / Mã định danh</p>
                          </div>
                        </div>
                      </div>
                      <p
                        className={`mt-1 italic text-black leading-tight ${
                          isA5 ? "text-[11.5px]" : "text-[9.5px]"
                        }`}
                      >
                        Quý Phụ huynh kiểm tra chi tiết phiếu và quét mã QR chuyển khoản trực tiếp trên ứng dụng.
                      </p>
                    </div>

                    {/* Phuong thuc 2: Tien mat */}
                    <div className={`text-black pl-0.5 ${isA5 ? "text-[13px] my-1" : "text-[10.5px] my-0.5"}`}>
                      <p className="font-bold text-black">2. Thanh toán bằng tiền mặt:</p>
                      <p className="text-black pl-3 mt-0.5">
                        Quý Phụ huynh vui lòng đến trực tiếp Căn tin nhà trường để đóng tiền.
                      </p>
                    </div>

                    {/* Luu y */}
                    <div
                      className={`text-black leading-relaxed border-t border-black space-y-0.5 ${
                        isA5 ? "text-[12px] pt-1.5 my-1" : "text-[9.8px] pt-1 my-0.5"
                      }`}
                    >
                      <p className="italic">
                        • Nếu Quý Phụ huynh đã hoàn tất thanh toán trước đó, vui lòng bỏ qua thông báo này.
                      </p>
                      <p>
                        • Mọi thắc mắc hoặc cần hỗ trợ, xin vui lòng liên hệ: <b>0909 932 627</b> (cô Thu Trang).
                      </p>
                    </div>

                    {/* Footer / Ky ten */}
                    <div className={`flex justify-end text-right border-t border-black ${isA5 ? "pt-2" : "pt-1"}`}>
                      <div>
                        <p className={`italic text-black ${isA5 ? "text-[12px]" : "text-[9.5px]"}`}>
                          TP. Hồ Chí Minh, tháng {bill.month} năm {bill.year}
                        </p>
                        <p className={`font-bold uppercase text-black mt-0.5 ${isA5 ? "text-[13px]" : "text-[10.8px]"}`}>
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
