import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * So sánh tên hoặc mã lớp theo thứ tự tự nhiên (Khối 10 -> 11 -> 12, lớp 1 -> 2 -> ... -> 13)
 */
export function compareClassNames(a: string, b: string): number {
  return (a || "").localeCompare(b || "", "vi", { numeric: true, sensitivity: "base" });
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

export interface SchoolWeekInfo {
  schoolYear: string;        // "2026 - 2027"
  schoolWeekNumber: number;  // 1
  calendarWeekNumber: number;// 37
  calendarYear: number;      // 2026
  startDate: Date;           // Thứ 2
  endDate: Date;             // Thứ 6
  startDateStr: string;      // "2026-09-07"
  endDateStr: string;        // "2026-09-11"
  formattedRange: string;    // "7/9/2026 ĐẾN 11/9/2026"
  days: Array<{
    dateStr: string;
    dayOfWeek: number;       // 2..6
    dayLabel: string;        // "Thứ 2" .. "Thứ 6"
    shortDate: string;       // "07/09"
  }>;
}

/**
 * Lấy thông tin tuần năm học và tuần dương lịch từ ngày bất kỳ
 */
export function getSchoolWeekInfo(dateInput: Date | string): SchoolWeekInfo {
  let d: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    const parts = cleanStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }
  
  // Xác định Thứ 2 của tuần chứa ngày này
  const day = d.getDay(); // 0: CN, 1: T2...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(12, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(12, 0, 0, 0);

  // Xác định Năm học
  const monMonth = monday.getMonth(); // 0..11 (tháng 9 là 8)
  const monYear = monday.getFullYear();
  let schoolStartYear = monYear;
  if (monMonth < 7) { // Tháng 1 - Tháng 7 thuộc học kỳ 2 của năm học bắt đầu từ năm trước
    schoolStartYear = monYear - 1;
  }
  const schoolYear = `${schoolStartYear} - ${schoolStartYear + 1}`;

  // Tìm Thứ 2 đầu tiên của tháng 9 trong schoolStartYear (Tuần 1)
  const sept1 = new Date(schoolStartYear, 8, 1, 12, 0, 0);
  const sept1Day = sept1.getDay();
  const diffToFirstMon = sept1Day === 1 ? 0 : (8 - (sept1Day === 0 ? 7 : sept1Day)) % 7;
  const firstMondaySept = new Date(schoolStartYear, 8, 1 + diffToFirstMon, 12, 0, 0);

  // Tính số tuần năm học
  const diffMs = monday.getTime() - firstMondaySept.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  const schoolWeekNumber = Math.max(1, diffWeeks + 1);

  // Tính tuần dương lịch (ISO Week)
  const calendarWeekNumber = getWeekNumber(monday);
  const calendarYear = monday.getFullYear();

  // Định dạng ngày yyyy-MM-dd
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDateStr = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  const startDateStr = formatDateStr(monday);
  const endDateStr = formatDateStr(friday);
  const formattedRange = `${monday.getDate()}/${monday.getMonth() + 1}/${monday.getFullYear()} ĐẾN ${friday.getDate()}/${friday.getMonth() + 1}/${friday.getFullYear()}`;

  const days = [0, 1, 2, 3, 4].map((i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      dateStr: formatDateStr(dt),
      dayOfWeek: i + 2,
      dayLabel: `Thứ ${i + 2}`,
      shortDate: `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`,
    };
  });

  return {
    schoolYear,
    schoolWeekNumber,
    calendarWeekNumber,
    calendarYear,
    startDate: monday,
    endDate: friday,
    startDateStr,
    endDateStr,
    formattedRange,
    days,
  };
}

/**
 * Lấy thông tin tuần từ số tuần năm học và năm bắt đầu
 */
export function getSchoolWeekFromNumber(weekNumber: number, schoolStartYear: number): SchoolWeekInfo {
  const sept1 = new Date(schoolStartYear, 8, 1, 12, 0, 0);
  const sept1Day = sept1.getDay();
  const diffToFirstMon = sept1Day === 1 ? 0 : (8 - (sept1Day === 0 ? 7 : sept1Day)) % 7;
  const firstMondaySept = new Date(schoolStartYear, 8, 1 + diffToFirstMon, 12, 0, 0);

  const targetMonday = new Date(firstMondaySept);
  targetMonday.setDate(firstMondaySept.getDate() + (weekNumber - 1) * 7);

  return getSchoolWeekInfo(targetMonday);
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
 * Tách họ tên tiếng Việt thành Họ & đệm và Tên chính
 * VD: "ĐÀO QUỐC ANH" -> { lastName: "ĐÀO QUỐC", firstName: "ANH" }
 * VD: "AN" -> { lastName: "", firstName: "AN" }
 */
export function splitVietnameseName(fullName: string): { lastName: string; firstName: string } {
  if (!fullName) return { lastName: "", firstName: "" };
  const clean = fullName.trim().replace(/\s+/g, " ");
  const lastSpaceIdx = clean.lastIndexOf(" ");
  if (lastSpaceIdx === -1) {
    return { lastName: "", firstName: clean };
  }
  return {
    lastName: clean.slice(0, lastSpaceIdx),
    firstName: clean.slice(lastSpaceIdx + 1),
  };
}

/**
 * So sánh 2 tên tiếng Việt theo chuẩn ABC:
 * - Ưu tiên 1: So sánh TÊN chính trước (A - Z)
 * - Ưu tiên 2: Nếu trùng tên, so sánh HỌ và TÊN ĐỆM
 */
export function compareVietnameseNames(fullNameA: string, fullNameB: string): number {
  const nameA = splitVietnameseName(fullNameA);
  const nameB = splitVietnameseName(fullNameB);

  // 1. So sánh Tên trước (theo bảng chữ cái tiếng Việt)
  const cmpFirst = nameA.firstName.localeCompare(nameB.firstName, "vi", { sensitivity: "base" });
  if (cmpFirst !== 0) return cmpFirst;

  // 2. Nếu trùng Tên, so sánh Họ và tên đệm
  return nameA.lastName.localeCompare(nameB.lastName, "vi", { sensitivity: "base" });
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

export interface ParsedDateResult {
  day: number;
  month: number;
  year: number;
  ddmmyyyy: string;
  display: string; // "DD/MM/YYYY"
  dateObj: Date;
}

/**
 * Parse linh hoạt ngày sinh từ nhiều định dạng Excel khác nhau:
 * - String: "6/7/2011", "06/07/2011", "26/3/2011", "1/1/2011", "18/6/2011", "2011-07-06", "15082018"
 * - Date object từ ExcelJS
 * - Số serial Excel (VD: 40730)
 * - Object chứa text/result
 */
export function parseDateValue(raw: any, cellText?: string): ParsedDateResult | null {
  if (raw === null || raw === undefined || raw === "") {
    if (!cellText) return null;
  }

  // 1. Nếu là Date object từ ExcelJS
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    const ddmmyyyy = `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${y}`;
    const display = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    return {
      day: d,
      month: m,
      year: y,
      ddmmyyyy,
      display,
      dateObj: new Date(Date.UTC(y, m - 1, d)),
    };
  }

  // 2. Nếu là số serial của Excel (VD: 40730 cho ngày 06/07/2011)
  if (typeof raw === "number" && !isNaN(raw) && raw > 0) {
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      const ddmmyyyy = `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${y}`;
      const display = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      return {
        day: d,
        month: m,
        year: y,
        ddmmyyyy,
        display,
        dateObj: new Date(Date.UTC(y, m - 1, d)),
      };
    }
  }

  // 3. Nếu là Object (ExcelJS Cell result / richText / formula)
  let str = "";
  if (typeof raw === "object" && raw !== null) {
    if ("result" in raw && raw.result) {
      const parsedRes = parseDateValue(raw.result, cellText);
      if (parsedRes) return parsedRes;
    }
    if ("text" in raw && typeof raw.text === "string") {
      str = raw.text;
    }
  }

  if (!str) {
    str = cellText || String(raw || "").trim();
  }

  str = str.trim();
  if (!str) return null;

  // 4. Định dạng chuỗi có dấu phân tách (/, -, .)
  if (/[\/\-\.]/.test(str)) {
    const parts = str.split(/[\/\-\.]/).map((p) => p.trim());
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const ddmmyyyy = `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${y}`;
          const display = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
          return {
            day: d,
            month: m,
            year: y,
            ddmmyyyy,
            display,
            dateObj: new Date(Date.UTC(y, m - 1, d)),
          };
        }
      } else {
        // DD/MM/YYYY hoặc D/M/YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const ddmmyyyy = `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${y}`;
          const display = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
          return {
            day: d,
            month: m,
            year: y,
            ddmmyyyy,
            display,
            dateObj: new Date(Date.UTC(y, m - 1, d)),
          };
        }
      }
    }
  }

  // 5. Chuỗi thuần số (VD: "15082018" - 8 chữ số DDMMYYYY)
  const digits = str.replace(/\D/g, "");
  if (digits.length === 8) {
    const d = parseInt(digits.substring(0, 2), 10);
    const m = parseInt(digits.substring(2, 4), 10);
    const y = parseInt(digits.substring(4, 8), 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const display = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      return {
        day: d,
        month: m,
        year: y,
        ddmmyyyy: digits,
        display,
        dateObj: new Date(Date.UTC(y, m - 1, d)),
      };
    }
  }

  return null;
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

