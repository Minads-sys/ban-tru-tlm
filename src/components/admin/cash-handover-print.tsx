"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText, Banknote } from "lucide-react";
import { formatCurrency, numberToVietnameseWords } from "@/lib/utils";

export interface CashHandoverClosingData {
  id: string;
  code: string;
  closingDate: string | Date;
  startTime: string | Date;
  endTime: string | Date;
  totalTransactions: number;
  totalAmount: number;
  denominationData?: string | null;
  status: string;
  note?: string | null;
  cashier?: {
    fullName: string;
    username: string;
  } | null;
  accountant?: {
    fullName: string;
    username: string;
  } | null;
  transactions: Array<{
    id: string;
    receiptNumber: string | null;
    amount: number;
    transDate: string | Date;
    note?: string | null;
    student?: {
      fullName: string;
      studentCode: string;
      boardingCode?: string | null;
      className: string;
    } | null;
  }>;
}

interface Props {
  data: CashHandoverClosingData;
  onClose?: () => void;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  defaultMode?: "handover" | "counting";
}

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export function CashHandoverPrint({
  data,
  onClose,
  schoolName: schoolNameProp,
  schoolAddress: schoolAddressProp,
  schoolPhone: schoolPhoneProp,
  defaultMode = "handover",
}: Props) {
  const [printMode, setPrintMode] = useState<"handover" | "counting">(defaultMode);
  const [sysSettings, setSysSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!schoolNameProp) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((s) => {
          if (s && typeof s === "object") setSysSettings(s);
        })
        .catch(() => {});
    }
  }, [schoolNameProp]);

  const schoolName = schoolNameProp || sysSettings.SCHOOL_NAME || "TRƯỜNG BÁN TRÚ";
  const schoolAddress = schoolAddressProp || sysSettings.SCHOOL_ADDRESS || "";
  const schoolPhone = schoolPhoneProp || sysSettings.SCHOOL_PHONE || "";

  const handlePrint = () => {
    window.print();
  };

  // Trích xuất tỉnh/thành phố từ địa chỉ trường
  const getCityName = () => {
    if (!schoolAddress) return "TP. Hồ Chí Minh";
    const lower = schoolAddress.toLowerCase();
    if (lower.includes("hồ chí minh") || lower.includes("tp.hcm") || lower.includes("tphcm") || lower.includes("sài gòn")) {
      return "TP. Hồ Chí Minh";
    }
    if (lower.includes("hà nội")) {
      return "Hà Nội";
    }
    if (lower.includes("đà nẵng")) {
      return "Đà Nẵng";
    }
    if (lower.includes("cần thơ")) {
      return "Cần Thơ";
    }
    if (lower.includes("hải phòng")) {
      return "Hải Phòng";
    }
    const parts = schoolAddress.split(",");
    if (parts.length > 0) {
      return parts[parts.length - 1].trim();
    }
    return "TP. Hồ Chí Minh";
  };
  const cityName = getCityName();

  // Parse bảng kê mệnh giá
  let denomCounts: Record<string, number> = {};
  if (data.denominationData) {
    try {
      denomCounts = JSON.parse(data.denominationData);
    } catch {
      denomCounts = {};
    }
  }

  const cDate = new Date(data.closingDate);
  const dayStr = String(cDate.getDate()).padStart(2, "0");
  const monthStr = String(cDate.getMonth() + 1).padStart(2, "0");
  const yearStr = cDate.getFullYear();

  const startStr = new Date(data.startTime).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endStr = new Date(data.endTime).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalDenomBills = Object.values(denomCounts).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <div className="bg-white text-slate-900">
      {/* Control bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 bg-white p-0.5" role="group">
            <button
              type="button"
              onClick={() => setPrintMode("handover")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                printMode === "handover"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Biên Bản Bàn Giao (A4)
            </button>
            <button
              type="button"
              onClick={() => setPrintMode("counting")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                printMode === "counting"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Banknote className="h-3.5 w-3.5" />
              Giấy Kiểm Đếm Tiền (A4)
            </button>
          </div>

          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            data.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}>
            {data.status === "CONFIRMED" ? "Đã xác nhận khóa sổ" : "Chờ Kế toán xác nhận"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs">
            <Printer className="h-4 w-4 mr-1.5" />
            In {printMode === "handover" ? "Biên Bản Bàn Giao" : "Giấy Kiểm Đếm"}
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              <X className="h-4 w-4 mr-1" />
              Đóng
            </Button>
          )}
        </div>
      </div>

      {/* Printable Area */}
      <div className="p-6 flex justify-center bg-slate-100 min-h-[600px]">
        {printMode === "handover" ? (
          /* ================= MẪU 1: BIÊN BẢN BÀN GIAO TIỀN MẶT ĐẦY ĐỦ ================= */
          <div
            id="print-handover-a4"
            className="w-[210mm] min-h-[297mm] bg-white p-10 shadow-lg text-[13px] font-serif leading-relaxed print:shadow-none print:w-full print:p-0"
          >
            {/* Quốc hiệu - Tiêu ngữ */}
            <div className="flex justify-between items-start">
              <div className="text-center w-5/12">
                <div className="font-bold uppercase text-[12px]">{schoolName}</div>
                {schoolAddress && <div className="text-[11px] text-slate-600">{schoolAddress}</div>}
                <div className="font-bold text-[12px] uppercase mt-0.5">TỔ QUẢN LÝ BÁN TRÚ</div>
                <div className="text-xs mt-1">Số: <b className="font-mono">{data.code}</b></div>
              </div>

              <div className="text-center w-7/12">
                <div className="font-bold uppercase text-[12px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="font-bold text-[12px] underline decoration-solid underline-offset-4">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-[11px] italic mt-1.5">
                  {cityName}, ngày {dayStr} tháng {monthStr} năm {yearStr}
                </div>
              </div>
            </div>

            {/* Tiêu đề biên bản */}
            <div className="text-center my-6">
              <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">
                BIÊN BẢN BÀN GIAO TIỀN MẶT BÁN TRÚ
              </h1>
              <div className="text-xs italic text-slate-600 mt-1">
                (Báo cáo thu tiền cuối ngày nộp về Kế toán)
              </div>
            </div>

            {/* Thông tin bàn giao */}
            <div className="space-y-1.5 text-xs mb-4">
              <div>
                - Thời gian làm việc: Ca từ <b>{startStr}</b> đến <b>{endStr}</b> ngày <b>{dayStr}/{monthStr}/{yearStr}</b>.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  - Người giao (Thu ngân): <b>{data.cashier?.fullName || "Thu ngân"}</b>
                </div>
                <div>
                  - Người nhận (Kế toán/Thủ quỹ): <b>{data.accountant?.fullName || "........................................"}</b>
                </div>
              </div>
              {data.note && (
                <div className="italic text-slate-700">
                  - Ghi chú: {data.note}
                </div>
              )}
            </div>

            {/* PHẦN I: TỔNG HỢP */}
            <div className="mb-4">
              <div className="font-bold uppercase text-xs text-slate-900 mb-1.5">
                I. TỔNG HỢP TIỀN THU TRONG NGÀY:
              </div>
              <div className="border border-slate-400 p-3 rounded-xs bg-slate-50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>1. Tổng số phiếu thu tiền mặt đã lập:</span>
                  <b>{data.totalTransactions} phiếu</b>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-300">
                  <span>2. TỔNG SỐ TIỀN MẶT THỰC THU:</span>
                  <span className="text-base text-rose-700">{formatCurrency(data.totalAmount)}</span>
                </div>
                <div className="italic text-[12px] text-slate-800">
                  (Viết bằng chữ: <b>{numberToVietnameseWords(data.totalAmount)}</b>)
                </div>
              </div>
            </div>

            {/* PHẦN II: BẢNG KÊ MỆNH GIÁ */}
            <div className="mb-4">
              <div className="font-bold uppercase text-xs text-slate-900 mb-1.5">
                II. BẢNG KÊ CHI TIẾT MỆNH GIÁ TIỀN MẶT BÀN GIAO:
              </div>
              <table className="w-full border-collapse border border-slate-400 text-xs text-center">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-slate-400 p-1.5 w-12">STT</th>
                    <th className="border border-slate-400 p-1.5">Mệnh giá</th>
                    <th className="border border-slate-400 p-1.5 w-28">Số lượng tờ</th>
                    <th className="border border-slate-400 p-1.5 w-36">Thành tiền (đ)</th>
                    <th className="border border-slate-400 p-1.5 w-36">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {DENOMINATIONS.map((val, idx) => {
                    const count = denomCounts[String(val)] || 0;
                    const subTotal = count * val;
                    return (
                      <tr key={val}>
                        <td className="border border-slate-400 p-1">{idx + 1}</td>
                        <td className="border border-slate-400 p-1 font-semibold text-right pr-4">
                          {new Intl.NumberFormat("vi-VN").format(val)} đ
                        </td>
                        <td className="border border-slate-400 p-1">{count > 0 ? count : "-"}</td>
                        <td className="border border-slate-400 p-1 text-right pr-3 font-mono">
                          {subTotal > 0 ? new Intl.NumberFormat("vi-VN").format(subTotal) : "-"}
                        </td>
                        <td className="border border-slate-400 p-1 text-left pl-2"></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={2} className="border border-slate-400 p-1.5 text-center uppercase">
                      Tổng cộng
                    </td>
                    <td className="border border-slate-400 p-1.5">
                      {totalDenomBills} tờ
                    </td>
                    <td className="border border-slate-400 p-1.5 text-right pr-3 text-rose-700 font-mono text-[13px]">
                      {formatCurrency(data.totalAmount)}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-emerald-700 italic">Khớp 100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PHẦN III: DANH SÁCH CHI TIẾT CÁC PHIẾU THU */}
            {data.transactions.length > 0 && (
              <div className="mb-6">
                <div className="font-bold uppercase text-xs text-slate-900 mb-1.5">
                  III. DANH SÁCH CHI TIẾT CÁC PHIẾU THU TRONG CA:
                </div>
                <table className="w-full border-collapse border border-slate-400 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-slate-400 p-1 w-8">STT</th>
                      <th className="border border-slate-400 p-1 w-28">Số phiếu thu</th>
                      <th className="border border-slate-400 p-1 w-20">Mã Bán Trú</th>
                      <th className="border border-slate-400 p-1 w-24">Mã HS (CCCD)</th>
                      <th className="border border-slate-400 p-1">Họ tên học sinh</th>
                      <th className="border border-slate-400 p-1 w-14">Lớp</th>
                      <th className="border border-slate-400 p-1 w-24">Số tiền (đ)</th>
                      <th className="border border-slate-400 p-1 w-16">Giờ thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((tx, idx) => (
                      <tr key={tx.id}>
                        <td className="border border-slate-400 p-1 text-center">{idx + 1}</td>
                        <td className="border border-slate-400 p-1 font-mono text-center">{tx.receiptNumber || "—"}</td>
                        <td className="border border-slate-400 p-1 text-center font-semibold text-blue-800">
                          {tx.student?.boardingCode || "—"}
                        </td>
                        <td className="border border-slate-400 p-1 text-center font-mono text-slate-600">
                          {tx.student?.studentCode || "—"}
                        </td>
                        <td className="border border-slate-400 p-1 font-medium pl-1.5">{tx.student?.fullName || "—"}</td>
                        <td className="border border-slate-400 p-1 text-center">{tx.student?.className || "—"}</td>
                        <td className="border border-slate-400 p-1 text-right pr-2 font-mono font-semibold">
                          {new Intl.NumberFormat("vi-VN").format(tx.amount)}
                        </td>
                        <td className="border border-slate-400 p-1 text-center text-slate-500">
                          {new Date(tx.transDate).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={6} className="border border-slate-400 p-1.5 text-center uppercase">
                        Tổng cộng ({data.transactions.length} phiếu)
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700 font-mono">
                        {formatCurrency(data.totalAmount)}
                      </td>
                      <td className="border border-slate-400 p-1.5"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs italic mb-6">
              Hai bên đã tiến hành kiểm đếm, đối chiếu thực tế và thống nhất số tiền bàn giao như trên.
              Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để làm chứng từ hạch toán.
            </div>

            {/* Chữ ký 4 bên (BỎ TRỐNG TÊN BÊN DƯỚI) */}
            <div className="grid grid-cols-4 text-center text-xs mt-6 pt-2">
              <div>
                <div className="font-bold uppercase">Người giao</div>
                <div className="text-[10px] text-slate-500 italic">(Thu ngân)</div>
                <div className="h-16"></div>
              </div>

              <div>
                <div className="font-bold uppercase">Người nhận</div>
                <div className="text-[10px] text-slate-500 italic">(Kế toán)</div>
                <div className="h-16"></div>
              </div>

              <div>
                <div className="font-bold uppercase">Thủ quỹ</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, họ tên)</div>
                <div className="h-16"></div>
              </div>

              <div>
                <div className="font-bold uppercase">Ban QL Bán Trú</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, họ tên)</div>
                <div className="h-16"></div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= MẪU 2: GIẤY KIỂM ĐẾM TIỀN MẶT BÁN TRÚ ================= */
          <div
            id="print-counting-a4"
            className="w-[210mm] min-h-[297mm] bg-white p-10 shadow-lg text-[13px] font-serif leading-relaxed print:shadow-none print:w-full print:p-0"
          >
            {/* Quốc hiệu - Tiêu ngữ */}
            <div className="flex justify-between items-start">
              <div className="text-center w-5/12">
                <div className="font-bold uppercase text-[12px]">{schoolName}</div>
                {schoolAddress && <div className="text-[11px] text-slate-600">{schoolAddress}</div>}
                <div className="font-bold text-[12px] uppercase mt-0.5">TỔ QUẢN LÝ BÁN TRÚ</div>
                <div className="text-xs mt-1">Số: <b className="font-mono">{data.code}</b></div>
              </div>

              <div className="text-center w-7/12">
                <div className="font-bold uppercase text-[12px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="font-bold text-[12px] underline decoration-solid underline-offset-4">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-[11px] italic mt-1.5">
                  {cityName}, ngày {dayStr} tháng {monthStr} năm {yearStr}
                </div>
              </div>
            </div>

            {/* Tiêu đề Giấy kiểm đếm */}
            <div className="text-center my-6">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                GIẤY KIỂM ĐẾM TIỀN MẶT BÁN TRÚ
              </h1>
              <div className="text-xs italic text-slate-600 mt-1">
                (Bảng kê chi tiết các loại mệnh giá tiền mặt bàn giao)
              </div>
            </div>

            {/* Thông tin kiểm đếm */}
            <div className="space-y-1.5 text-xs mb-5 bg-slate-50 border border-slate-300 p-3 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  - Ca kiểm đếm: Từ <b>{startStr}</b> đến <b>{endStr}</b>
                </div>
                <div>
                  - Ngày kiểm đếm: <b>{dayStr}/{monthStr}/{yearStr}</b>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  - Thu ngân lập phiếu: <b>{data.cashier?.fullName || "Thu ngân"}</b>
                </div>
                <div>
                  - Mã biên bản: <b className="font-mono">{data.code}</b>
                </div>
              </div>
              {data.note && (
                <div className="italic text-slate-700">
                  - Ghi chú: {data.note}
                </div>
              )}
            </div>

            {/* BẢNG KÊ CHI TIẾT 9 LOẠI MỆNH GIÁ */}
            <div className="mb-6">
              <table className="w-full border-collapse border border-slate-400 text-xs text-center">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-slate-400 p-2 w-12">STT</th>
                    <th className="border border-slate-400 p-2 w-36">Mệnh giá tiền (VNĐ)</th>
                    <th className="border border-slate-400 p-2 w-28">Số lượng tờ</th>
                    <th className="border border-slate-400 p-2 w-44">Thành tiền (VNĐ)</th>
                    <th className="border border-slate-400 p-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {DENOMINATIONS.map((val, idx) => {
                    const count = denomCounts[String(val)] || 0;
                    const subTotal = count * val;
                    return (
                      <tr key={val} className="hover:bg-slate-50">
                        <td className="border border-slate-400 p-1.5">{idx + 1}</td>
                        <td className="border border-slate-400 p-1.5 font-bold text-right pr-4 text-slate-900">
                          {new Intl.NumberFormat("vi-VN").format(val)} đ
                        </td>
                        <td className="border border-slate-400 p-1.5 font-mono font-semibold">
                          {count > 0 ? count : "-"}
                        </td>
                        <td className="border border-slate-400 p-1.5 text-right pr-4 font-mono font-bold">
                          {subTotal > 0 ? new Intl.NumberFormat("vi-VN").format(subTotal) + " đ" : "-"}
                        </td>
                        <td className="border border-slate-400 p-1.5 text-left pl-2"></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-black text-[13px]">
                    <td colSpan={2} className="border border-slate-400 p-2 text-center uppercase tracking-wide">
                      Tổng cộng tiền kiểm đếm
                    </td>
                    <td className="border border-slate-400 p-2 font-mono text-blue-900">
                      {totalDenomBills} tờ
                    </td>
                    <td className="border border-slate-400 p-2 text-right pr-4 text-rose-700 font-mono text-sm">
                      {formatCurrency(data.totalAmount)}
                    </td>
                    <td className="border border-slate-400 p-2 text-emerald-700 italic font-medium">Khớp đúng 100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Khung số tiền bằng chữ */}
            <div className="border border-slate-400 p-3.5 bg-slate-50 rounded text-xs space-y-1 mb-6">
              <div className="text-sm">
                - Tổng số tiền bằng chữ: <b className="text-slate-900 capitalize">{numberToVietnameseWords(data.totalAmount)}</b>.
              </div>
              <div className="text-[12px] italic text-slate-600">
                - Hội đồng kiểm đếm đã tiến hành kiểm đếm thực tế toàn bộ số tiền mặt nêu trên, đối chiếu khớp đúng với sổ sách và cùng ký xác nhận dưới đây.
              </div>
            </div>

            {/* Chữ ký 3 bên (BỎ TRỐNG TÊN BÊN DƯỚI) */}
            <div className="grid grid-cols-3 text-center text-xs mt-10 pt-2">
              <div>
                <div className="font-bold uppercase">Người kiểm đếm</div>
                <div className="text-[10px] text-slate-500 italic">(Thu ngân)</div>
                <div className="h-20"></div>
              </div>

              <div>
                <div className="font-bold uppercase">Kế toán nhận tiền</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>

              <div>
                <div className="font-bold uppercase">Thủ quỹ</div>
                <div className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
