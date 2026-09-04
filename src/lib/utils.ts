import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format số tiền VND
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format ngày tháng tiếng Việt (DD/MM/YYYY)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Lấy số tuần trong năm từ ngày
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Lấy thứ trong tuần (2=T2, 3=T3, ..., 7=T7, CN=8)
 */
export function getDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 8 : day + 1; // CN=0 -> 8, T2=1 -> 2, etc.
}

/**
 * Map day of week number to field name in ClassWeeklySchedule
 */
export function dayOfWeekToField(dayOfWeek: number): string | null {
  const map: Record<number, string> = {
    2: "monday",
    3: "tuesday",
    4: "wednesday",
    5: "thursday",
    6: "friday",
    7: "saturday",
  };
  return map[dayOfWeek] || null;
}

/**
 * Chuyển Tiếng Việt có dấu thành chữ viết thường viết liền không dấu
 * VD: "Nguyễn Văn An" -> "nguyenvanan"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let result = str.toLowerCase();
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  result = result.replace(/đ/g, "d");
  // Remove accents, punctuation, spaces
  result = result.replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/[^a-z0-9]/g, "");
  return result;
}

/**
 * Format ngày thành ddmmyyyy (VD: 15/08/2018 -> "15082018")
 */
export function formatDateDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}${month}${year}`;
}

/**
 * Get the current time in Vietnam (GMT+7) as a Date object.
 * This Date object will return the correct local components (getHours, getDate, etc) 
 * for Vietnam, even if the server is in UTC or another timezone.
 */
export function getVietnamTime(): Date {
  // Use formatting to get the exact Vietnam time string, then parse it
  const vnTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  return new Date(vnTimeStr);
}

/**
 * Lấy ngày hôm nay ở VN dưới dạng chuỗi YYYY-MM-DD
 */
export function getVietnamTodayString(): string {
  const vnDate = getVietnamTime();
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, "0");
  const d = String(vnDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Lấy ngày hôm nay ở VN dạng UTC Midnight (để so sánh lưu database @db.Date)
 */
export function getVietnamTodayUTC(): Date {
  const vnDate = getVietnamTime();
  return new Date(Date.UTC(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate()));
}

/**
 * Kiểm tra đã quá giờ khóa sổ chưa (Giờ VN)
 */
export function isPastCutoffTime(cutoffTime: string): boolean {
  const vnTime = getVietnamTime();
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  // Compare hours and minutes directly
  if (vnTime.getHours() > hours) return true;
  if (vnTime.getHours() === hours && vnTime.getMinutes() >= minutes) return true;
  return false;
}

/**
 * Chuyển số thành chữ (tiếng Việt)
 */
const defaultNumbers = 'không một hai ba bốn năm sáu bảy tám chín'.split(' ');

export function numberToVietnameseWords(number: number): string {
  if (number === 0) return 'Không đồng';
  if (number < 0) return 'Âm ' + numberToVietnameseWords(Math.abs(number)).toLowerCase();

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const numStr = number.toString();
  const segments: string[] = [];
  
  let tempStr = numStr;
  while (tempStr.length > 0) {
    segments.push(tempStr.slice(-3));
    tempStr = tempStr.slice(0, -3);
  }

  const readThree = (num: string, isFirst: boolean): string => {
    let result = '';
    const n = parseInt(num, 10);
    const hundreds = Math.floor(n / 100);
    const tens = Math.floor((n % 100) / 10);
    const ones = n % 10;

    if (!isFirst || hundreds > 0) {
      result += defaultNumbers[hundreds] + ' trăm ';
      if (tens === 0 && ones > 0) result += 'lẻ ';
    }

    if (tens === 1) {
      result += 'mười ';
    } else if (tens > 1) {
      result += defaultNumbers[tens] + ' mươi ';
    }

    if (ones === 1 && tens > 1) {
      result += 'mốt ';
    } else if (ones === 5 && tens > 0) {
      result += 'lăm ';
    } else if (ones > 0) {
      result += defaultNumbers[ones] + ' ';
    }

    return result.trim();
  };

  let resultStr = '';
  for (let i = 0; i < segments.length; i++) {
    const segmentNum = parseInt(segments[i], 10);
    if (segmentNum > 0) {
      const isFirstSegment = (i === segments.length - 1);
      const segmentWord = readThree(segments[i].padStart(3, '0'), isFirstSegment);
      resultStr = segmentWord + ' ' + units[i] + ' ' + resultStr;
    }
  }

  resultStr = resultStr.trim().replace(/\s+/g, ' ');
  return resultStr.charAt(0).toUpperCase() + resultStr.slice(1) + ' đồng';
}

/**
 * Che mã học sinh (CCCD), chỉ hiển thị 4 số cuối (bảo mật thông tin cho Thu ngân)
 * Ví dụ: "001202012345" -> "********2345"
 */
export function maskStudentCode(code: string | null | undefined): string {
  if (!code) return "";
  const str = String(code).trim();
  if (str.length <= 4) return "****";
  const visiblePart = str.slice(-4);
  const maskedPart = "*".repeat(str.length - 4);
  return `${maskedPart}${visiblePart}`;
}

