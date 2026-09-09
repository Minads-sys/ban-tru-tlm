"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText, FileDown, Loader2 } from "lucide-react";

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
  defaultLayout = "A4_PORTRAIT_4UP",
}: Props) {
  const [layout, setLayout] = useState<DebtPrintLayout>(defaultLayout);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    // Kích hoạt class ẩn layout admin nền trong globals.css để tránh trang trắng thừa khi in
    document.body.classList.add("printing-modal-open");

    // Sinh mã QR link đăng nhập gốc màu đen trắng
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

    return () => {
      document.body.classList.remove("printing-modal-open");
    };
  }, []);

  const isA5 = layout === "A5_LANDSCAPE_2UP";

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanClassName = className
      ? `_Lop_${className.replace(/\s+/g, "_")}`
      : "_Toan_Truong";
    const layoutSuffix = isA5 ? "_A5_Ngang" : "_A4_Doc";
    document.title = `Thong_Bao_Phat_Hanh_Phieu_Thanh_Toan${cleanClassName}_T${String(
      month
    ).padStart(2, "0")}_${year}${layoutSuffix}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 2000);
    }, 100);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await fetch("/api/billing/export-debt-notification-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bills,
          schoolName,
          month,
          year,
          className,
          layout,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể xuất file PDF");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;

      const cleanClassName = className
        ? `_Lop_${className.replace(/\s+/g, "_")}`
        : "_Toan_Truong";
      const layoutSuffix = isA5 ? "_A5_Ngang" : "_A4_Doc";
      const fileName = `Thong_Bao_Phat_Hanh_Phieu_Thanh_Toan${cleanClassName}_T${String(
        month
      ).padStart(2, "0")}_${year}${layoutSuffix}.pdf`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        } catch {}
      }, 30000);

      Swal.fire({
        icon: "success",
        title: "Tải PDF thành công",
        text: `Đã tải về file PDF thông báo nợ (${bills.length} học sinh)!`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error("Lỗi xuất PDF:", error);
      Swal.fire("Lỗi xuất PDF", error.message || "Không thể tạo file PDF", "error");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Chia nhóm theo layout:
  // - A5_LANDSCAPE_2UP: 2 phiếu A6 trên 1 tờ A5 ngang
  // - A4_PORTRAIT_4UP: 4 phiếu A6 trên 1 tờ A4 dọc
  const chunkSize = isA5 ? 2 : 4;
  const chunkedBills: DebtNotificationBill[][] = [];
  for (let i = 0; i < bills.length; i += chunkSize) {
    chunkedBills.push(bills.slice(i, i + chunkSize));
  }

  const expectedPageCount = Math.ceil(bills.length / chunkSize);

  if (!isMounted) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="debt-print-root fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm overflow-y-auto flex flex-col items-center py-6 print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:overflow-visible print:block print:w-full print:h-auto"
    >
      {/* Thanh công cụ điều khiển (Ẩn hoàn toàn khi in) */}
      <div className="sticky top-4 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 px-5 mb-6 flex flex-wrap items-center justify-between gap-4 max-w-4xl w-[95%] no-print font-sans">
        <div>
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            In thông báo phát hành phiếu thanh toán (Chỉ học sinh còn nợ)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tháng {month}/{year} {className ? `• Lớp ${className}` : "• Toàn trường"} • Tổng số:{" "}
            <span className="font-bold text-amber-600">{bills.length} học sinh</span>
            {" • "}
            <span className="text-slate-600">
              Dự kiến: <b className="text-indigo-600">{expectedPageCount} tờ {isA5 ? "A5" : "A4"}</b>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chọn layout in */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setLayout("A4_PORTRAIT_4UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A4_PORTRAIT_4UP"
                  ? "bg-white text-indigo-600 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 dọc (4 phiếu A6 / tờ)
            </button>
            <button
              onClick={() => setLayout("A5_LANDSCAPE_2UP")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                layout === "A5_LANDSCAPE_2UP"
                  ? "bg-white text-indigo-600 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A5 ngang (2 phiếu A6 / tờ)
            </button>
          </div>

          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 shadow hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            title="In trực tiếp ra máy in qua trình duyệt"
          >
            <Printer className="w-4 h-4" />
            In ngay (Print)
          </Button>

          <Button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            title="Tải trực tiếp file PDF chất lượng cao về máy tính"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tạo PDF...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Xuất PDF
              </>
            )}
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

      {/* Style in ấn chuyên nghiệp: Chuẩn Đen Trắng 100% & Khổ giấy cách ly tuyệt đối */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: ${isA5 ? "A5 landscape" : "A4 portrait"} !important;
              margin: 0mm !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: 'Times New Roman', Times, serif !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
            }
            .no-print, .no-print * {
              display: none !important;
            }
            #debt-print-portal-wrapper,
            .debt-print-portal,
            .debt-print-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
            .debt-page-sheet {
              width: 210mm !important;
              height: ${isA5 ? "147mm" : "295.5mm"} !important;
              min-height: ${isA5 ? "147mm" : "295.5mm"} !important;
              max-height: ${isA5 ? "147mm" : "295.5mm"} !important;
              margin: 0 auto !important;
              padding: ${isA5 ? "3mm 4mm" : "3.5mm 4mm"} !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
            .debt-page-sheet:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        `,
        }}
      />

      {/* Vùng xem trước & In */}
      <div
        className="flex flex-col gap-6 print:gap-0 w-full items-center text-black"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {chunkedBills.map((group, pageIndex) => (
          <div
            key={pageIndex}
            className={`debt-page-sheet bg-white text-black shadow-2xl print:shadow-none box-border relative overflow-hidden ${
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
              boxSizing: "border-box",
            }}
          >
            {group.map((bill, itemIndex) => {
              const fullName = bill.student?.user?.fullName || "";
              const clsName = bill.student?.class?.name || "";

              return (
                <div
                  key={bill.id}
                  className={`box-border flex flex-col justify-between border-black text-black p-[5mm] ${
                    isA5
                      ? `${itemIndex === 0 ? "border-r border-dashed" : ""}`
                      : `${itemIndex % 2 === 0 ? "border-r border-dashed" : ""} ${
                          itemIndex < 2 ? "border-b border-dashed" : ""
                        }`
                  }`}
                  style={{
                    height: isA5 ? "100%" : "100%",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Nội dung chính của 1 phiếu A6 */}
                  <div className="flex flex-col h-full justify-between">
                    {/* Header Phiếu */}
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

                    {/* Kính gửi */}
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

                    {/* Phương thức 1: Trực tuyến */}
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
                            <p>• <b>Mật khẩu:</b> Nếu đăng nhập lần đầu điền mật khẩu là Ngày tháng năm sinh viết liền (ddmmyyyy)</p>
                            <p>• <b>Mã xác nhận:</b> 6 số cuối CCCD / Mã định danh</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-1 italic text-black leading-tight text-[9.5px]">
                        Quý Phụ huynh kiểm tra chi tiết phiếu và quét mã QR chuyển khoản trực tiếp trên ứng dụng.
                      </p>
                    </div>

                    {/* Phương thức 2: Tiền mặt */}
                    <div className="text-black pl-0.5 text-[10.5px] my-0.5">
                      <p className="font-bold text-black">2. Thanh toán bằng tiền mặt:</p>
                      <p className="text-black pl-3 mt-0.5">
                        Quý Phụ huynh vui lòng đến trực tiếp Căn tin nhà trường để đóng tiền.
                      </p>
                    </div>

                    {/* Lưu ý */}
                    <div className="text-black leading-relaxed border-t border-black space-y-0.5 text-[9.8px] pt-1 my-0.5">
                      <p className="italic">
                        • Nếu Quý Phụ huynh đã hoàn tất thanh toán trước đó, vui lòng bỏ qua thông báo này.
                      </p>
                      <p>
                        • Mọi thắc mắc hoặc cần hỗ trợ, xin vui lòng liên hệ: <b>0909 932 627</b> (cô Thu Trang).
                      </p>
                    </div>

                    {/* Footer / Ký tên */}
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

  return createPortal(
    <div id="debt-print-portal-wrapper" className="debt-print-portal">
      {content}
    </div>,
    document.body
  );
}
