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
    // Tao ma QR dan thang toi trang dang nhap hoc sinh
    QRCode.toDataURL("https://bantrutlm.com/student-login", {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url: string) => setQrCodeUrl(url))
      .catch((err: any) => console.error("Loi tao QR Code:", err));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Ham lay ngay thang nam sinh dinh dang ddmmyyyy
  const formatBirthDate = (birthDate?: string | Date | null) => {
    if (!birthDate) return "ddmmyyyy";
    try {
      const d = new Date(birthDate);
      if (isNaN(d.getTime())) return "ddmmyyyy";
      const day = String(d.getUTCDate()).padStart(2, "0");
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const y = d.getUTCFullYear();
      return `${day}${m}${y}`;
    } catch {
      return "ddmmyyyy";
    }
  };

  // Ham lay 6 so cuoi CCCD
  const getVerificationCode = (studentCode?: string) => {
    if (!studentCode) return "6 số cuối CCCD";
    const clean = studentCode.trim();
    if (clean.length >= 6) {
      return clean.slice(-6);
    }
    return clean;
  };

  // Chia nhom theo layout (4 phieu A6 / trang A4 hoac 2 phieu A5 / trang A4)
  const chunkSize = layout === "A6_4UP" ? 4 : 2;
  const chunkedBills: DebtNotificationBill[][] = [];
  for (let i = 0; i < bills.length; i += chunkSize) {
    chunkedBills.push(bills.slice(i, i + chunkSize));
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm overflow-y-auto flex flex-col items-center py-6 print:p-0 print:m-0 print:bg-white print:static print:inset-auto">
      {/* Thanh cong cu dieu khien (An khi in) */}
      <div className="sticky top-4 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 px-5 mb-6 flex flex-wrap items-center justify-between gap-4 max-w-4xl w-[95%] no-print">
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
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                layout === "A6_4UP" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 (4 phiếu A6)
            </button>
            <button
              onClick={() => setLayout("A5_2UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                layout === "A5_2UP" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 (2 phiếu A5)
            </button>
          </div>

          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            In ngay (Print)
          </Button>

          <Button onClick={onClose} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4 mr-1" /> Đóng
          </Button>
        </div>
      </div>

      {/* Style in an chuyen nghiep */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
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
      <div className="flex flex-col gap-6 print:gap-0 w-full items-center">
        {chunkedBills.map((group, pageIndex) => (
          <div
            key={pageIndex}
            className={`bg-white text-slate-900 shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] max-h-[297mm] h-[297mm] box-border relative overflow-hidden ${
              pageIndex < chunkedBills.length - 1 ? "a4-page-break" : ""
            }`}
            style={{
              display: "grid",
              gridTemplateColumns: layout === "A6_4UP" ? "1fr 1fr" : "1fr",
              gridTemplateRows: layout === "A6_4UP" ? "1fr 1fr" : "1fr 1fr",
            }}
          >
            {group.map((bill, itemIndex) => {
              const fullName = bill.student?.user?.fullName || "";
              const clsName = bill.student?.class?.name || "";
              const birthDateStr = formatBirthDate(bill.student?.birthDate);
              const verCode = getVerificationCode(bill.student?.studentCode);

              return (
                <div
                  key={bill.id}
                  className={`box-border p-3.5 flex flex-col justify-between border-slate-300 ${
                    layout === "A6_4UP"
                      ? `${itemIndex % 2 === 0 ? "border-r border-dashed" : ""} ${
                          itemIndex < 2 ? "border-b border-dashed" : ""
                        }`
                      : `${itemIndex === 0 ? "border-b border-dashed" : ""}`
                  }`}
                  style={{
                    height: layout === "A6_4UP" ? "148.5mm" : "148.5mm",
                    width: layout === "A6_4UP" ? "105mm" : "210mm",
                  }}
                >
                  {/* Header Phieu */}
                  <div>
                    <div className="text-center border-b border-slate-400 pb-1.5 mb-1.5">
                      <h3 className="font-bold uppercase tracking-tight text-[10.5px] leading-tight text-slate-800">
                        {schoolName}
                      </h3>
                      <h1 className="font-extrabold uppercase text-[12px] leading-tight text-slate-950 mt-1">
                        THÔNG BÁO
                      </h1>
                      <p className="font-bold uppercase text-[9.5px] text-slate-900 mt-0.5">
                        PHÁT HÀNH PHIẾU THANH TOÁN TIỀN ĂN BÁN TRÚ THÁNG {bill.month}/{bill.year}
                      </p>
                    </div>

                    {/* Kinh gui */}
                    <p className="text-[10px] leading-normal font-semibold text-slate-900 mb-1.5">
                      Kính gửi: Quý Phụ huynh em <span className="uppercase text-[11px] font-bold underline underline-offset-2">{fullName}</span> - Lớp: <span className="font-bold">{clsName}</span>,
                    </p>

                    <p className="text-[9px] leading-relaxed text-slate-800 text-justify mb-2">
                      Căn tin Châu Phương Thảo tại trường Tenlơman xin thông báo: Phiếu thanh toán tiền ăn bán trú đã được cập nhật trên ứng dụng. Quý Phụ huynh vui lòng kiểm tra thông tin và hoàn tất thanh toán theo các phương thức sau:
                    </p>

                    {/* Phuong thuc 1: Truc tuyen */}
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5 mb-1.5">
                      <p className="font-bold text-[9.5px] text-slate-950 mb-1 flex items-center gap-1">
                        1. Thanh toán trực tuyến qua mã QR:
                      </p>
                      
                      <div className="flex items-start gap-2">
                        {qrCodeUrl && (
                          <div className="shrink-0 flex flex-col items-center bg-white p-1 border border-slate-300 rounded">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrCodeUrl} alt="QR App" className="w-14 h-14" />
                            <span className="text-[7.5px] font-bold text-slate-600 mt-0.5">Quét mở App</span>
                          </div>
                        )}
                        <div className="text-[8.8px] leading-relaxed text-slate-800 flex-1">
                          <p className="text-slate-900 font-medium mb-0.5">
                            Truy cập link: <span className="font-bold text-blue-700 underline">https://bantrutlm.com/student-login</span>
                          </p>
                          <div className="bg-white px-1.5 py-1 border border-slate-200 rounded text-[8.5px] space-y-0.5">
                            <p>• <b>Tên đăng nhập:</b> {fullName}</p>
                            <p>• <b>Mật khẩu:</b> {birthDateStr} <span className="italic text-slate-500">(ngày sinh ddmmyyyy)</span></p>
                            <p>• <b>Mã xác nhận:</b> <span className="font-bold text-slate-900">{verCode}</span> <span className="italic text-slate-500">(6 số cuối CCCD)</span></p>
                          </div>
                          <p className="mt-1 text-[8px] italic text-slate-600">
                            Quý Phụ huynh kiểm tra chi tiết phiếu và quét mã QR chuyển khoản trực tiếp trên ứng dụng.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Phuong thuc 2: Tien mat */}
                    <div className="text-[9px] leading-tight text-slate-900 mb-1.5 pl-0.5">
                      <p className="font-bold text-slate-950 mb-0.5">2. Thanh toán bằng tiền mặt:</p>
                      <p className="text-slate-800 pl-2">Quý Phụ huynh vui lòng đến trực tiếp Căn tin nhà trường để đóng tiền.</p>
                    </div>

                    {/* Luu y */}
                    <div className="text-[8.2px] text-slate-700 leading-snug border-t border-slate-200 pt-1 space-y-0.5">
                      <p className="italic">• Nếu Quý Phụ huynh đã hoàn tất thanh toán trước đó, vui lòng bỏ qua thông báo này.</p>
                      <p className="font-medium text-slate-900">• Mọi thắc mắc hoặc cần hỗ trợ, xin vui lòng liên hệ: <b>0909 932 627</b> (cô Thu Trang).</p>
                    </div>
                  </div>

                  {/* Footer / Ky ten */}
                  <div className="flex justify-end text-right pt-0.5">
                    <div>
                      <p className="text-[8px] italic text-slate-600">TP. Hồ Chí Minh, tháng {bill.month} năm {bill.year}</p>
                      <p className="text-[9px] font-bold uppercase text-slate-900">Căn tin Châu Phương Thảo</p>
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
