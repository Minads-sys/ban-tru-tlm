import ExcelJS from "exceljs";
import { removeVietnameseTones, formatDateDDMMYYYY, parseDateValue, compareClassNames, getWeekNumber } from "./utils";

// ==================== TYPES ====================

export interface ClassImportRow {
  stt: number;
  maLop: string;
  tenLop: string;
  giaoVienChuNhiem: string;
  ghiChu?: string;
}

export interface StudentImportRow {
  stt: number;
  maHocSinh: string;
  hoTen: string;
  gioiTinh: "NAM" | "NU";
  ngaySinh?: string;
  tenDangNhap: string;
  matKhauBanDau: string;
  maLop: string;
  cheDoAn: "MAN" | "CHAY" | "CHAO";
  dangKyBanTru: "CO" | "KHONG";
  soDienThoaiPhuHuynh?: string;
}

export interface ScheduleImportRow {
  stt: number;
  maLop: string;
  thu2: "KHONG" | "TIET_4" | "TIET_5";
  thu3: "KHONG" | "TIET_4" | "TIET_5";
  thu4: "KHONG" | "TIET_4" | "TIET_5";
  thu5: "KHONG" | "TIET_4" | "TIET_5";
  thu6: "KHONG" | "TIET_4" | "TIET_5";
  thu7: "KHONG" | "TIET_4" | "TIET_5";
  ghiChu?: string;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ImportResult<T> {
  data: T[];
  errors: ValidationError[];
  isValid: boolean;
}

// ==================== TẠO TEMPLATE EXCEL ====================

/**
 * Template 1: Danh sách Lớp học
 */
export async function generateClassTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAN-TRU-TLM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("DanhSachLop", {
    properties: { defaultColWidth: 20 },
  });

  // Header styling
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 12 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // Title row
  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "DANH SÁCH LỚP HỌC - BAN-TRU-TLM";
  titleCell.font = { bold: true, size: 14, color: { argb: "FF2563EB" } };
  titleCell.alignment = { horizontal: "center" };

  // Instruction row
  sheet.mergeCells("A2:E2");
  const instrCell = sheet.getCell("A2");
  instrCell.value = "Hướng dẫn: Điền thông tin lớp học vào các cột bên dưới. Mã Lớp không được trùng.";
  instrCell.font = { italic: true, color: { argb: "FF6B7280" } };

  // Headers
  const headers = ["STT", "MaLop (*)", "TenLop (*)", "GiaoVienChuNhiem", "GhiChu"];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Set column widths
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 25;
  sheet.getColumn(4).width = 30;
  sheet.getColumn(5).width = 25;

  // Sample data
  sheet.addRow([1, "1A", "Lớp 1A", "Nguyễn Thị Hoa", "Khối 1"]);
  sheet.addRow([2, "2B", "Lớp 2B", "Trần Văn Minh", "Khối 2"]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Template 2: Danh sách Học sinh
 */
export async function generateStudentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAN-TRU-TLM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("DanhSachHocSinh", {
    properties: { defaultColWidth: 18 },
  });

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // Title
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "DANH SÁCH HỌC SINH & ĐĂNG KÝ BÁN TRÚ - BAN-TRU-TLM";
  titleCell.font = { bold: true, size: 14, color: { argb: "FF16A34A" } };
  titleCell.alignment = { horizontal: "center" };

  // Instructions
  sheet.mergeCells("A2:I2");
  const instrCell = sheet.getCell("A2");
  instrCell.value =
    "Hướng dẫn: CheDoAn chỉ nhận: MAN, CHAY, CHAO. DangKyBanTru nhận: CO hoặc KHONG. MaLop phải trùng với danh sách lớp đã tạo.";
  instrCell.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };

  // Headers
  const headers = [
    "STT",
    "MaHocSinh (*)",
    "HoTen (*)",
    "Giới Tính (*)\n(NAM/NU)",
    "NgaySinh (DD/MM/YYYY)",
    "TenDangNhap (Tự động nếu trống)",
    "MatKhau (Tự động ddmmyyyy)",
    "MaLop (*)",
    "TenLop",
    "CheDoAn (*)\n(MAN/CHAY/CHAO)",
    "DangKyBanTru (*)\n(CO/KHONG)",
    "SoDienThoaiPhuHuynh",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 35;
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Column widths and formats
  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(2).numFmt = '@'; // MaHocSinh (Text)
  sheet.getColumn(3).width = 25;
  sheet.getColumn(4).width = 15; // Giới Tính
  sheet.getColumn(5).width = 20; // NgaySinh
  sheet.getColumn(5).numFmt = '@'; // NgaySinh (Text)
  sheet.getColumn(6).width = 22; // TenDangNhap
  sheet.getColumn(6).numFmt = '@'; // TenDangNhap (Text)
  sheet.getColumn(7).width = 22; // MatKhau
  sheet.getColumn(7).numFmt = '@'; // MatKhau (Text)
  sheet.getColumn(8).width = 12; // MaLop
  sheet.getColumn(8).numFmt = '@'; // MaLop (Text)
  sheet.getColumn(9).width = 20; // TenLop
  sheet.getColumn(10).width = 18; // CheDoAn
  sheet.getColumn(11).width = 20; // DangKyBanTru
  sheet.getColumn(12).width = 22; // SoDienThoaiPhuHuynh
  sheet.getColumn(12).numFmt = '@'; // SoDienThoai (Text)

  // Add dropdown validations
  const cheDoAnValidation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"MAN,CHAY,CHAO"'],
    showErrorMessage: true,
    errorTitle: "Giá trị không hợp lệ",
    error: "Chỉ nhận: MAN, CHAY hoặc CHAO",
  };

  const dangKyValidation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"CO,KHONG"'],
    showErrorMessage: true,
    errorTitle: "Giá trị không hợp lệ",
    error: "Chỉ nhận: CO hoặc KHONG",
  };

  const gioiTinhValidation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"NAM,NU"'],
    showErrorMessage: true,
    errorTitle: "Giá trị không hợp lệ",
    error: "Chỉ nhận: NAM hoặc NU",
  };

  // Apply validation to rows 4-504 (500 students max)
  for (let row = 4; row <= 504; row++) {
    sheet.getCell(`D${row}`).dataValidation = gioiTinhValidation;
    sheet.getCell(`J${row}`).dataValidation = cheDoAnValidation;
    sheet.getCell(`K${row}`).dataValidation = dangKyValidation;
  }

  // Sample data
  sheet.addRow([1, "TH-TLM-123456", "Lê Văn An", "NAM", "15/08/2018", "levanan", "15082018", "1A", "Lớp 1A", "MAN", "CO", "0912345678"]);
  sheet.addRow([2, "TH-TLM-654321", "Phạm Thị Bình", "NU", "20/11/2018", "phamthibinh", "20112018", "1A", "Lớp 1A", "CHAY", "CO", "0987654321"]);
  sheet.addRow([3, "TH-TLM-999888", "Hoàng Văn Chi", "NAM", "05/05/2017", "hoangvanchi", "05052017", "2B", "Lớp 2B", "MAN", "KHONG", "0901112233"]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Template 3: Thời khóa biểu Bán trú (Định dạng Ma trận phân ca)
 *
 * Layout:
 *   Row 1: Title
 *   Row 2: Instructions
 *   Row 3: "Lớp" (merged A3:A4) | "Thứ 2" (merged B3:C3) | "Thứ 3" (merged D3:E3) | ... | "Thứ 6" (merged J3:K3)
 *   Row 4: (merged)            | Tiết 4 | Tiết 5          | Tiết 4 | Tiết 5          | ... | Tiết 4 | Tiết 5
 *   Row 5+: Data – đánh dấu "x" vào ô tương ứng
 */
export async function generateScheduleTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAN-TRU-TLM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ThoiKhoaBieu", {
    properties: { defaultColWidth: 10 },
  });

  // --- Styles ---
  const dayHeaderStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const periodHeaderStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FF1E293B" }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const dataCellBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  // --- Days config ---
  // Col A = Lớp, then each day occupies 2 columns (Tiết 4, Tiết 5)
  // Thứ 2: B-C, Thứ 3: D-E, Thứ 4: F-G, Thứ 5: H-I, Thứ 6: J-K
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
  const totalCols = 1 + days.length * 2; // A + 10 = 11 columns (A..K)

  // --- Row 1: Title ---
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "THỜI KHÓA BIỂU BÁN TRÚ CÁC LỚP - BAN-TRU-TLM";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  titleCell.alignment = { horizontal: "center" };

  // --- Row 2: Instructions ---
  sheet.mergeCells(2, 1, 2, totalCols);
  const instrCell = sheet.getCell("A2");
  instrCell.value =
    "Hướng dẫn: Đánh dấu x vào ô Tiết 4 hoặc Tiết 5 tương ứng với lịch ăn bán trú của từng lớp. Để trống nếu không ăn ngày đó. Tên lớp phải trùng danh sách lớp đã có.";
  instrCell.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };

  // --- Row 3-4: Matrix headers ---
  // A3:A4 merged = "Lớp"
  sheet.mergeCells("A3:A4");
  const lopCell = sheet.getCell("A3");
  lopCell.value = "Lớp";
  lopCell.style = dayHeaderStyle;

  for (let i = 0; i < days.length; i++) {
    const col1 = 2 + i * 2; // first sub-column for this day
    const col2 = col1 + 1;  // second sub-column

    // Merge day name across 2 cols in row 3
    sheet.mergeCells(3, col1, 3, col2);
    const dayCell = sheet.getCell(3, col1);
    dayCell.value = days[i];
    dayCell.style = dayHeaderStyle;

    // Period sub-headers in row 4
    const t4Cell = sheet.getCell(4, col1);
    t4Cell.value = "Tiết 4";
    t4Cell.style = periodHeaderStyle;

    const t5Cell = sheet.getCell(4, col2);
    t5Cell.value = "Tiết 5";
    t5Cell.style = periodHeaderStyle;
  }

  sheet.getRow(3).height = 25;
  sheet.getRow(4).height = 22;

  // --- Column widths ---
  sheet.getColumn(1).width = 12; // Lớp
  for (let c = 2; c <= totalCols; c++) {
    sheet.getColumn(c).width = 8;
  }

  // --- Sample data (matching reference image) ---
  // Each row: [Lớp, T2-Tiết4, T2-Tiết5, T3-T4, T3-T5, T4-T4, T4-T5, T5-T4, T5-T5, T6-T4, T6-T5]
  const sampleRows = [
    ["10A1", "",  "x",  "",  "x",  "x", "",   "",  "x",  "",  "x"],
    ["10A2", "",  "x",  "",  "",   "",  "",   "",  "",   "",  "x"],
    ["10A3", "x", "",   "",  "",   "x", "",   "x", "",   "",  "x"],
    ["10A4", "",  "",   "",  "x",  "",  "",   "",  "",   "x", ""],
    ["10A5", "",  "",   "x", "",   "",  "",   "",  "",   "x", ""],
    ["10A6", "",  "",   "",  "x",  "",  "",   "",  "",   "",  "x"],
  ];

  for (const rowData of sampleRows) {
    const row = sheet.addRow(rowData);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = dataCellBorder;
      cell.alignment = { horizontal: colNumber === 1 ? "left" : "center", vertical: "middle" };
    });
    // Ensure all columns get borders (eachCell with includeEmpty may skip trailing empty cells)
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      if (!cell.border) {
        cell.border = dataCellBorder;
        cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ==================== PARSE EXCEL ====================

/**
 * Parse file Excel Danh sách Lớp
 */
export async function parseClassExcel(buffer: Uint8Array): Promise<ImportResult<ClassImportRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const data: ClassImportRow[] = [];
  const errors: ValidationError[] = [];
  const seenMaLop = new Set<string>();

  // Tìm header row (dòng có "MaLop")
  let headerRowNum = 3;
  sheet.eachRow((row, rowNumber) => {
    const firstCell = String(row.getCell(2).value || "");
    if (firstCell.includes("MaLop")) {
      headerRowNum = rowNumber;
    }
  });

  // Parse data rows
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNum) return; // Skip header
    const maLop = String(row.getCell(2).value || "").trim();
    if (!maLop) return; // Skip empty rows

    const tenLop = String(row.getCell(3).value || "").trim();
    const gvcn = String(row.getCell(4).value || "").trim();
    const ghiChu = String(row.getCell(5).value || "").trim();

    // Validation
    if (!maLop) errors.push({ row: rowNumber, column: "MaLop", message: "Mã Lớp không được để trống" });
    if (seenMaLop.has(maLop)) errors.push({ row: rowNumber, column: "MaLop", message: `Mã Lớp "${maLop}" bị trùng` });
    if (!tenLop) errors.push({ row: rowNumber, column: "TenLop", message: "Tên Lớp không được để trống" });

    seenMaLop.add(maLop);
    data.push({
      stt: rowNumber - headerRowNum,
      maLop,
      tenLop,
      giaoVienChuNhiem: gvcn,
      ghiChu: ghiChu || undefined,
    });
  });

  return { data, errors, isValid: errors.length === 0 };
}

/**
 * Parse file Excel Danh sách Học sinh
 */
export async function parseStudentExcel(
  buffer: Uint8Array,
  existingClassIds: string[],
  existingUsernames: string[] = []
): Promise<ImportResult<StudentImportRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const data: StudentImportRow[] = [];
  const errors: ValidationError[] = [];
  const seenMaHS = new Set<string>();
  const seenUsername = new Set<string>(existingUsernames);
  const validMealTypes = ["MAN", "CHAY", "CHAO"];
  const validBoardingOptions = ["CO", "KHONG"];
  const classIdSet = new Set(existingClassIds);

  let headerRowNum = 3;
  sheet.eachRow((row, rowNumber) => {
    const cell = String(row.getCell(2).value || "");
    if (cell.includes("MaHocSinh")) headerRowNum = rowNumber;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNum) return;
    const maHS = String(row.getCell(2).value || "").trim().toUpperCase();
    if (!maHS) return;

    const hoTen = String(row.getCell(3).value || "").trim();
    const gioiTinh = String(row.getCell(4).value || "NAM").trim().toUpperCase();
    const cell5 = row.getCell(5);
    const parsedBirthDate = parseDateValue(cell5.value, cell5.text);
    const ngaySinhStr = parsedBirthDate ? parsedBirthDate.display : "";

    let tenDN = String(row.getCell(6).value || "").trim().toLowerCase();
    
    // Nếu để trống thì tự động tạo từ họ tên
    if (!tenDN && hoTen) {
      tenDN = removeVietnameseTones(hoTen);
    }

    // Tự động giải quyết trùng lặp tên đăng nhập
    if (tenDN) {
      if (seenUsername.has(tenDN)) {
        let counter = 1;
        let newTenDn = `${tenDN}${counter}`;
        while (seenUsername.has(newTenDn)) {
          counter++;
          newTenDn = `${tenDN}${counter}`;
        }
        tenDN = newTenDn;
      }
    }

    let matKhau = String(row.getCell(7).value || "").trim();
    if (!matKhau && parsedBirthDate) {
      matKhau = parsedBirthDate.ddmmyyyy;
    } else if (!matKhau) {
      matKhau = "123456"; // Mật khẩu mặc định fallback
    }

    const maLop = String(row.getCell(8).value || "").trim().toUpperCase();
    const cheDoAn = String(row.getCell(10).value || "MAN").trim().toUpperCase();
    const dangKy = String(row.getCell(11).value || "CO").trim().toUpperCase();
    const sdt = String(row.getCell(12).value || "").trim();

    // Validations
    if (seenMaHS.has(maHS)) errors.push({ row: rowNumber, column: "MaHocSinh", message: `Mã HS "${maHS}" bị trùng trong file` });
    if (!hoTen) errors.push({ row: rowNumber, column: "HoTen", message: "Họ tên không được để trống" });
    if (!["NAM", "NU"].includes(gioiTinh)) errors.push({ row: rowNumber, column: "GioiTinh", message: `Giới tính "${gioiTinh}" không hợp lệ (NAM/NU)` });
    if (!tenDN) errors.push({ row: rowNumber, column: "TenDangNhap", message: "Tên đăng nhập không được để trống" });
    if (!classIdSet.has(maLop)) errors.push({ row: rowNumber, column: "MaLop", message: `Mã Lớp "${maLop}" không tồn tại trong hệ thống` });
    if (!validMealTypes.includes(cheDoAn)) errors.push({ row: rowNumber, column: "CheDoAn", message: `Chế độ ăn "${cheDoAn}" không hợp lệ (MAN/CHAY/CHAO)` });
    if (!validBoardingOptions.includes(dangKy)) errors.push({ row: rowNumber, column: "DangKyBanTru", message: `Giá trị "${dangKy}" không hợp lệ (CO/KHONG)` });

    seenMaHS.add(maHS);
    seenUsername.add(tenDN);
    data.push({
      stt: rowNumber - headerRowNum,
      maHocSinh: maHS,
      hoTen,
      gioiTinh: gioiTinh as "NAM" | "NU",
      ngaySinh: ngaySinhStr || undefined,
      tenDangNhap: tenDN,
      matKhauBanDau: matKhau,
      maLop,
      cheDoAn: cheDoAn as "MAN" | "CHAY" | "CHAO",
      dangKyBanTru: dangKy as "CO" | "KHONG",
      soDienThoaiPhuHuynh: sdt || undefined,
    });
  });

  return { data, errors, isValid: errors.length === 0 };
}

/**
 * Chuẩn hóa tên ngày trong header Excel (ví dụ "Thứ 2", "Thứ Hai", "T2" -> "thu2")
 */
function normalizeDayHeader(val: any): "thu2" | "thu3" | "thu4" | "thu5" | "thu6" | "thu7" | null {
  if (val === null || val === undefined) return null;
  const raw = typeof val === "object" && val.text ? val.text : String(val);
  const firstLine = raw.split("\n")[0].trim();
  const s = removeVietnameseTones(firstLine).toLowerCase().trim();

  // Bỏ qua nếu dòng này chỉ nói về Tiết
  if (/^tiet\s*[0-9]+$/i.test(s)) return null;

  if (/\bthu\s*2\b|\bthuhai\b|\bthu\s*hai\b|\bt2\b|\bhai\b|\bmon(day)?\b/.test(s)) return "thu2";
  if (/\bthu\s*3\b|\bthuba\b|\bthu\s*ba\b|\bt3\b|\bba\b|\btue(sday)?\b/.test(s)) return "thu3";
  if (/\bthu\s*4\b|\bthutu\b|\bthu\s*tu\b|\bt4\b|\btu\b|\bwed(nesday)?\b/.test(s)) return "thu4";
  if (/\bthu\s*5\b|\bthunam\b|\bthu\s*nam\b|\bt5\b|\bnam\b|\bthur(sday)?\b/.test(s)) return "thu5";
  if (/\bthu\s*6\b|\bthusau\b|\bthu\s*sau\b|\bt6\b|\bsau\b|\bfri(day)?\b/.test(s)) return "thu6";
  if (/\bthu\s*7\b|\bthubay\b|\bthu\s*bay\b|\bt7\b|\bbay\b|\bsat(urday)?\b/.test(s)) return "thu7";
  return null;
}

/**
 * Chuẩn hóa tiêu đề tiết (Tiết 4 -> TIET_4, Tiết 5 -> TIET_5)
 */
function normalizePeriodHeader(val: any): "TIET_4" | "TIET_5" | null {
  if (val === null || val === undefined) return null;
  const raw = typeof val === "object" && val.text ? val.text : String(val);
  const s = removeVietnameseTones(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("tiet4") || s === "t4" || s === "4") return "TIET_4";
  if (s.includes("tiet5") || s === "t5" || s === "5") return "TIET_5";
  return null;
}

/**
 * Kiểm tra xem ô có được đánh dấu (x, X, v, V, 1, ✓...) hay không
 */
function isCellMarked(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = (typeof val === "object" && val.text ? val.text : String(val)).trim().toLowerCase();
  if (!s || s === "0" || s === "-" || s === "khong" || s === "false" || s === "null" || s === "none") return false;
  return true;
}

/**
 * Khớp tên lớp trong Excel với danh sách mã lớp đã có trong hệ thống
 * Hỗ trợ các trường hợp như "Lớp 10A1", "LOP 10A1", "10 a 1", "10a1" -> "10A1"
 */
function findMatchingClassId(raw: string, classIds: string[]): string | null {
  const clean = raw.trim();
  if (!clean) return null;

  // 1. Khớp chính xác
  if (classIds.includes(clean)) return clean;

  // 2. Khớp không phân biệt hoa thường
  const upper = clean.toUpperCase();
  const matchCase = classIds.find((id) => id.toUpperCase() === upper);
  if (matchCase) return matchCase;

  // 3. Bỏ tiền tố "Lớp " hoặc "LOP " (ví dụ "Lớp 10A1" -> "10A1")
  const stripped = clean.replace(/^(lớp|lop)\s+/i, "").trim().toUpperCase();
  const matchStripped = classIds.find((id) => id.toUpperCase() === stripped);
  if (matchStripped) return matchStripped;

  // 4. Bỏ mọi khoảng trắng thừa (ví dụ "10 A 1" -> "10A1")
  const noSpace = stripped.replace(/\s+/g, "");
  const matchNoSpace = classIds.find((id) => id.toUpperCase().replace(/\s+/g, "") === noSpace);
  if (matchNoSpace) return matchNoSpace;

  return null;
}

/**
 * Parse file Excel Thời khóa biểu
 * Hỗ trợ tự động 2 định dạng:
 * 1. Định dạng Ma trận phân ca (Dòng trên là Thứ gộp ô, dòng dưới là Tiết 4 / Tiết 5, đánh dấu 'x' / 'v')
 * 2. Định dạng Cột đơn chuẩn (Mỗi thứ 1 cột với giá trị KHONG / TIET_4 / TIET_5)
 */
export async function parseScheduleExcel(
  buffer: Uint8Array,
  existingClassIds: string[]
): Promise<ImportResult<ScheduleImportRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const data: ScheduleImportRow[] = [];
  const errors: ValidationError[] = [];
  const classIdSet = new Set(existingClassIds);
  const seenMaLop = new Set<string>();

  // 1. Tìm dòng header chứa các Thứ trong tuần
  let dayHeaderRow = -1;
  sheet.eachRow((row, rowNumber) => {
    if (dayHeaderRow !== -1) return;
    let dayCount = 0;
    row.eachCell((cell) => {
      if (normalizeDayHeader(cell.value)) dayCount++;
    });
    if (dayCount >= 2) dayHeaderRow = rowNumber;
  });

  if (dayHeaderRow === -1) {
    // Fallback: tìm dòng có chứa "MaLop" hoặc "Lớp"
    sheet.eachRow((row, rowNumber) => {
      if (dayHeaderRow !== -1) return;
      row.eachCell((cell) => {
        const str = String(cell.value || "").toLowerCase();
        if (str.includes("malop") || str.includes("mã lớp")) dayHeaderRow = rowNumber;
      });
    });
  }

  if (dayHeaderRow === -1) {
    dayHeaderRow = 3;
  }

  const headerRow1 = sheet.getRow(dayHeaderRow);

  // Xác định cột Lớp và cột Ghi chú ở headerRow1
  let classCol = 1;
  let noteCol = -1;
  for (let c = 1; c <= 20; c++) {
    const val1 = String(headerRow1.getCell(c).value || "").toLowerCase();
    if (val1.includes("lop") || val1.includes("lớp")) {
      classCol = c;
    }
    if (val1.includes("ghichu") || val1.includes("ghi chú") || val1.includes("note")) {
      noteCol = c;
    }
  }

  // 2. Nhận diện định dạng: Ma trận phân tiết (Matrix) hay Cột đơn (Classic)
  let isMatrix = false;
  const periodHeaderRow = dayHeaderRow + 1;
  if (dayHeaderRow > 0 && periodHeaderRow <= sheet.rowCount) {
    const nextRow = sheet.getRow(periodHeaderRow);
    const cellClassVal = String(nextRow.getCell(classCol).value || "").trim();
    const isNextRowADataClass = !!findMatchingClassId(cellClassVal, existingClassIds);

    // Nếu dòng kế tiếp không phải là dữ liệu học sinh/lớp thì kiểm tra xem có phải header các tiết không
    if (!isNextRowADataClass) {
      let periodCount = 0;
      nextRow.eachCell((cell) => {
        if (normalizePeriodHeader(cell.value)) periodCount++;
      });
      if (periodCount >= 2) isMatrix = true;
    }
  }

  const headerRow2 = isMatrix ? sheet.getRow(periodHeaderRow) : null;
  if (headerRow2 && classCol === 1) {
    // Kiểm tra lại cột lớp ở headerRow2 nếu cần
    for (let c = 1; c <= 10; c++) {
      const val2 = String(headerRow2.getCell(c).value || "").toLowerCase();
      if (val2.includes("lop") || val2.includes("lớp")) {
        classCol = c;
      }
      if (val2.includes("ghichu") || val2.includes("ghi chú") || val2.includes("note")) {
        noteCol = c;
      }
    }
  }

  // Heuristic dự phòng: Nếu classCol vẫn là 1, kiểm tra xem cột 1 có phải là số thứ tự (STT) và cột 2 là mã lớp không
  const sampleDataRowIndex = isMatrix ? periodHeaderRow + 1 : dayHeaderRow + 1;
  if (classCol === 1 && sampleDataRowIndex <= sheet.rowCount) {
    const sampleRow = sheet.getRow(sampleDataRowIndex);
    const c1 = String(sampleRow.getCell(1).value || "").trim();
    const c2 = String(sampleRow.getCell(2).value || "").trim();
    if (/^\d+$/.test(c1) && !findMatchingClassId(c1, existingClassIds) && findMatchingClassId(c2, existingClassIds)) {
      classCol = 2;
    }
  }

  // 3. Xây dựng bản đồ ánh xạ các cột
  const matrixColMap = new Map<number, { day: string; period: "TIET_4" | "TIET_5" }>();
  const classicColMap = new Map<number, string>();
  const maxCol = Math.max(headerRow1.cellCount, headerRow2 ? headerRow2.cellCount : 0, 20);

  if (isMatrix) {
    let currentDay: string | null = null;
    for (let c = 1; c <= maxCol; c++) {
      const dayVal = headerRow1.getCell(c).value;
      const detectedDay = normalizeDayHeader(dayVal);
      if (detectedDay) {
        currentDay = detectedDay;
      }
      if (headerRow2) {
        const periodVal = headerRow2.getCell(c).value;
        const detectedPeriod = normalizePeriodHeader(periodVal);
        if (currentDay && detectedPeriod) {
          matrixColMap.set(c, { day: currentDay, period: detectedPeriod });
        }
      }
    }
  } else {
    for (let c = 1; c <= maxCol; c++) {
      const dayVal = headerRow1.getCell(c).value;
      const detectedDay = normalizeDayHeader(dayVal);
      if (detectedDay) {
        classicColMap.set(c, detectedDay);
      }
    }
  }

  // 4. Đọc dữ liệu các dòng lớp
  const startDataRow = isMatrix ? periodHeaderRow + 1 : dayHeaderRow + 1;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startDataRow) return;
    const rawClass = String(row.getCell(classCol).value || "").trim();
    if (!rawClass) return; // Bỏ qua dòng trống

    const matchedClassId = findMatchingClassId(rawClass, existingClassIds);
    const finalMaLop = matchedClassId || rawClass.toUpperCase();

    if (!matchedClassId || !classIdSet.has(matchedClassId)) {
      errors.push({
        row: rowNumber,
        column: "MaLop",
        message: `Mã Lớp "${rawClass}" không tồn tại trong hệ thống`,
      });
    }

    if (seenMaLop.has(finalMaLop)) {
      errors.push({
        row: rowNumber,
        column: "MaLop",
        message: `Mã Lớp "${finalMaLop}" bị trùng trong file`,
      });
    }
    seenMaLop.add(finalMaLop);

    const days: Record<string, "KHONG" | "TIET_4" | "TIET_5"> = {
      thu2: "KHONG",
      thu3: "KHONG",
      thu4: "KHONG",
      thu5: "KHONG",
      thu6: "KHONG",
      thu7: "KHONG",
    };

    if (isMatrix) {
      matrixColMap.forEach(({ day, period }, c) => {
        const val = row.getCell(c).value;
        if (isCellMarked(val)) {
          days[day] = period;
        }
      });
    } else {
      classicColMap.forEach((day, c) => {
        const rawVal = String(row.getCell(c).value || "KHONG").trim().toUpperCase();
        if (rawVal === "TIET_4" || rawVal === "4") {
          days[day] = "TIET_4";
        } else if (rawVal === "TIET_5" || rawVal === "5" || rawVal === "CO") {
          days[day] = "TIET_5";
        } else if (rawVal === "KHONG" || rawVal === "-" || !rawVal) {
          days[day] = "KHONG";
        } else {
          errors.push({
            row: rowNumber,
            column: day,
            message: `Cột ${day} chỉ nhận KHONG, TIET_4 hoặc TIET_5 (Hiện tại: ${rawVal})`,
          });
        }
      });
    }

    const ghiChu = noteCol > 0 ? String(row.getCell(noteCol).value || "").trim() : undefined;

    data.push({
      stt: rowNumber - startDataRow + 1,
      maLop: finalMaLop,
      thu2: days.thu2,
      thu3: days.thu3,
      thu4: days.thu4,
      thu5: days.thu5,
      thu6: days.thu6,
      thu7: days.thu7,
      ghiChu: ghiChu || undefined,
    });
  });

  // Sắp xếp danh sách lớp theo khối từ trên xuống và tăng dần (10A1 -> 10A13, 11A1 -> 11A12, 12A1 -> 12A13)
  data.sort((a, b) => compareClassNames(a.maLop, b.maLop));
  data.forEach((row, idx) => {
    row.stt = idx + 1;
  });

  return { data, errors, isValid: errors.length === 0 };
}

// ==================== LỊCH ĐẶC BIỆT ====================

export interface SpecialMealImportRow {
  stt: number;
  hoTen: string;
  maLop: string;
  entries: Array<{
    weekNumber: number;
    monthWeekIndex?: number;
    dayOfWeek: number;
    shift: "TIET_4" | "TIET_5";
    date: string;
  }>;
}

function nthDayOfWeekInMonth(year: number, month: number, dayOfWeek: number, nth: number): Date {
  const targetIsoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const firstDayIso = firstDay.getUTCDay() || 7;
  let daysUntilFirst = targetIsoDay - firstDayIso;
  if (daysUntilFirst < 0) daysUntilFirst += 7;
  const day = 1 + daysUntilFirst + (nth - 1) * 7;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoWeekToDate(year: number, week: number, dayOfWeek: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(Date.UTC(year, 0, 4 - jan4Day + 1));
  const result = new Date(mondayW1);
  result.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7 + (dayOfWeek - 1));
  return result;
}

function parseSpecialMealDayOfWeek(text: string): number | null {
  if (!text) return null;
  const s = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  if (/thu\s*2|\bhai\b|\bt2\b/.test(s)) return 1;
  if (/thu\s*3|\bba\b|\bt3\b/.test(s)) return 2;
  if (/thu\s*4|thu\s*tu|\btu\b|\bt4\b/.test(s)) return 3;
  if (/thu\s*5|\bnam\b|\bt5\b/.test(s)) return 4;
  if (/thu\s*6|\bsau\b|\bt6\b/.test(s)) return 5;
  if (/thu\s*7|\bbay\b|\bt7\b/.test(s)) return 6;
  return null;
}

function parseSpecialMealWeekNumber(text: string): number | null {
  if (!text) return null;
  const s = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
  // Bỏ qua nếu là văn bản hướng dẫn chứa 'tiet' (VD: 'Điền TIẾT 4 hoặc TIẾT 5...')
  if (/tiet/i.test(s)) return null;
  // Khớp 'tuan 1', 'w1', hoặc 't1' (tại ranh giới từ)
  const m = s.match(/(?:\btuan|\bw|\bt)\s*0*(\d+)\b/i);
  if (m) {
    const num = parseInt(m[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 53) return num;
  }
  const pureNum = parseInt(s, 10);
  if (!isNaN(pureNum) && pureNum >= 1 && pureNum <= 53 && String(pureNum) === s) {
    return pureNum;
  }
  return null;
}

function extractExcelCellString(cell: ExcelJS.Cell): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  const val = cell.value;
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text).join("");
    }
    if ("result" in val) {
      return String(val.result || "");
    }
    if ("text" in val) {
      return String(val.text || "");
    }
    return String(val);
  }
  return String(val);
}

export async function parseSpecialMealExcel(
  buffer: Uint8Array,
  year: number,
  classIds: string[],
  month?: number
): Promise<ImportResult<SpecialMealImportRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const data: SpecialMealImportRow[] = [];
  const errors: ValidationError[] = [];

  const columns: Array<{ colIndex: number; weekNumber: number; dayOfWeek: number }> = [];
  let headerRowIndex = 3; // Default

  // 1. Quét tìm dòng header chứa "STT" trong 10 dòng đầu
  for (let r = 1; r <= 10; r++) {
    const row = sheet.getRow(r);
    let found = false;
    for (let c = 1; c <= 20; c++) {
      const val = extractExcelCellString(row.getCell(c)).toUpperCase();
      if (val.includes("STT")) {
        headerRowIndex = r;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // 2. Quét thứ trong tuần chung (nếu có ghi trên tiêu đề hoặc dòng đầu)
  let sheetDefaultDay: number | null = null;
  for (let r = 1; r <= headerRowIndex; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 30; c++) {
      const val = extractExcelCellString(row.getCell(c));
      const day = parseSpecialMealDayOfWeek(val);
      if (day) {
        sheetDefaultDay = day;
        break;
      }
    }
    if (sheetDefaultDay) break;
  }
  // Nếu hoàn toàn không phát hiện thứ nào, mặc định là Thứ 4 (Thứ Tư = 3)
  if (!sheetDefaultDay) {
    sheetDefaultDay = 3;
  }

  // 3. Xác định vị trí các cột STT, Họ và tên, Lớp
  let sttCol = 1, nameCol = 2, classCol = 3;
  const headerRow = sheet.getRow(headerRowIndex);
  for (let c = 1; c <= 30; c++) {
    const s = removeVietnameseTones(extractExcelCellString(headerRow.getCell(c))).toLowerCase().trim();
    if (s.includes("stt")) sttCol = c;
    else if (s.includes("ho ten") || s.includes("hovaten") || s.includes("ten")) nameCol = c;
    else if (s.includes("lop")) classCol = c;
  }
  const minDataCol = Math.max(sttCol, nameCol, classCol) + 1;

  // 4. Nhận diện các cột tuần (từ minDataCol trở đi)
  const maxCol = Math.max(sheet.columnCount || 0, sheet.actualColumnCount || 0, 30);
  for (let c = minDataCol; c <= maxCol; c++) {
    const headerCell = headerRow.getCell(c);
    let valHeader = extractExcelCellString(headerCell);

    // Kiểm tra tuần và thứ trên chính dòng header trước (ví dụ: 'Thứ Tư TUẦN 1' hoặc 'TUẦN 1')
    let weekNum = parseSpecialMealWeekNumber(valHeader);
    let colDay = parseSpecialMealDayOfWeek(valHeader);

    // Nếu không thấy, kiểm tra dòng ngay phía trên (trường hợp tiêu đề 2 tầng: Dòng trên 'Thứ Tư', dòng dưới 'TUẦN 1')
    if (headerRowIndex > 1) {
      const prevCell = sheet.getRow(headerRowIndex - 1).getCell(c);
      let valPrev = extractExcelCellString(prevCell);
      if (!valPrev && prevCell.isMerged && prevCell.master) {
        valPrev = extractExcelCellString(prevCell.master);
      }
      if (!weekNum) weekNum = parseSpecialMealWeekNumber(valPrev);
      if (!colDay) colDay = parseSpecialMealDayOfWeek(valPrev);
    }

    if (weekNum) {
      columns.push({
        colIndex: c,
        weekNumber: weekNum,
        dayOfWeek: colDay || sheetDefaultDay,
      });
    }
  }

  if (columns.length === 0) {
    errors.push({
      row: headerRowIndex,
      column: "Tiêu đề",
      message: "Không tìm thấy cột tuần học nào trong file Excel (VD: 'TUẦN 1', 'TUẦN 2'...). Vui lòng kiểm tra lại dòng tiêu đề các cột.",
    });
  }

  // 5. Đọc dữ liệu từng dòng học sinh
  const startDataRow = headerRowIndex + 1;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startDataRow) return;

    const hoTen = extractExcelCellString(row.getCell(nameCol)).trim();
    const maLopRaw = extractExcelCellString(row.getCell(classCol)).trim();

    if (!hoTen && !maLopRaw) return;

    if (!hoTen) {
      errors.push({ row: rowNumber, column: "Họ Tên", message: "Thiếu họ tên" });
    }

    let maLop = maLopRaw.toUpperCase();
    const matchedClass = findMatchingClassId(maLopRaw, classIds);
    if (matchedClass) {
      maLop = matchedClass;
    } else {
      errors.push({ row: rowNumber, column: "Lớp", message: `Lớp "${maLopRaw}" không hợp lệ` });
    }

    const entries: SpecialMealImportRow["entries"] = [];

    for (const col of columns) {
      if (col.weekNumber < 1 || col.weekNumber > 53) {
        errors.push({ row: rowNumber, column: `Cột ${col.colIndex}`, message: `Số tuần "${col.weekNumber}" không hợp lệ` });
        continue;
      }

      const cellVal = extractExcelCellString(row.getCell(col.colIndex)).trim();
      if (!cellVal) continue;

      const norm = removeVietnameseTones(cellVal).toLowerCase().replace(/[^a-z0-9]/g, "");
      let shift: "TIET_4" | "TIET_5" | null = null;
      if (norm.includes("tiet4") || norm === "t4" || norm === "4") shift = "TIET_4";
      if (norm.includes("tiet5") || norm === "t5" || norm === "5") shift = "TIET_5";

      if (!shift) {
        errors.push({ row: rowNumber, column: `Cột ${col.colIndex}`, message: `Giá trị "${cellVal}" không hợp lệ (TIET_4/TIET_5)` });
      } else {
        let d: Date;
        let isoWeek: number;
        let monthWeekIndex: number | undefined;

        if (month && col.weekNumber <= 5) {
          // Người dùng chọn tháng và cột là Tuần 1..5 trong tháng
          d = nthDayOfWeekInMonth(year, month, col.dayOfWeek, col.weekNumber);
          isoWeek = getWeekNumber(d);
          monthWeekIndex = col.weekNumber;
        } else {
          // Mặc định tính theo tuần ISO trong năm
          d = isoWeekToDate(year, col.weekNumber, col.dayOfWeek);
          isoWeek = col.weekNumber;
        }

        entries.push({
          weekNumber: isoWeek,
          monthWeekIndex,
          dayOfWeek: col.dayOfWeek,
          shift,
          date: d.toISOString().split("T")[0],
        });
      }
    }

    data.push({
      stt: rowNumber - startDataRow + 1,
      hoTen,
      maLop,
      entries,
    });
  });

  return { data, errors, isValid: errors.length === 0 };
}

export async function generateSpecialMealTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAN-TRU-TLM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("LichDacBiet", {
    properties: { defaultColWidth: 15 },
  });

  // Header styling
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 12 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // Title row
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "ĐĂNG KÝ BÁN TRÚ LỊCH ĐẶC BIỆT";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Instruction row
  sheet.mergeCells("A2:G2");
  const instrCell = sheet.getCell("A2");
  instrCell.value = "Điền TIẾT 4 hoặc TIẾT 5 vào các ô. Để trống nếu không ăn. Số tuần phải đúng theo quy ước ISO của hệ thống.";
  instrCell.font = { italic: true, color: { argb: "FF6B7280" } };
  instrCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };

  // Headers
  const headers = ["STT", "HỌ VÀ TÊN HS", "LỚP", "Thứ Tư TUẦN 1", "Thứ Tư TUẦN 2", "Thứ Tư TUẦN 3", "Thứ Tư TUẦN 4"];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Set column widths
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 10;
  for (let c = 4; c <= 7; c++) {
    sheet.getColumn(c).width = 15;
  }

  // Data validation
  const shiftValidation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"TIẾT 4,TIẾT 5"'],
    showErrorMessage: true,
    errorTitle: "Giá trị không hợp lệ",
    error: "Chỉ nhận TIẾT 4 hoặc TIẾT 5",
  };

  for (let r = 4; r <= 100; r++) {
    for (let c = 4; c <= 7; c++) {
      sheet.getCell(r, c).dataValidation = shiftValidation;
    }
  }

  // Sample data
  sheet.addRow([1, "Nguyễn Văn An", "10A1", "TIẾT 4", "", "TIẾT 5", ""]);
  sheet.addRow([2, "Trần Thị Bình", "10A1", "", "TIẾT 5", "", "TIẾT 4"]);
  sheet.addRow([3, "Lê Hoàng Chi", "10A2", "TIẾT 5", "TIẾT 4", "", ""]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
