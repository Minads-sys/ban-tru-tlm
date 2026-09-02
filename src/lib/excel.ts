import ExcelJS from "exceljs";
import { removeVietnameseTones, formatDateDDMMYYYY } from "./utils";

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
 * Template 3: Thời khóa biểu Bán trú
 */
export async function generateScheduleTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAN-TRU-TLM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ThoiKhoaBieu", {
    properties: { defaultColWidth: 15 },
  });

  const headerStyle: Partial<ExcelJS.Style> = {
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

  // Title
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "THỜI KHÓA BIỂU BÁN TRÚ CÁC LỚP - BAN-TRU-TLM";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  titleCell.alignment = { horizontal: "center" };

  // Instructions
  sheet.mergeCells("A2:I2");
  const instrCell = sheet.getCell("A2");
  instrCell.value =
    "Hướng dẫn: Điền KHONG (Không ăn), TIET_4 hoặc TIET_5 cho từng ngày. MaLop phải trùng danh sách lớp.";
  instrCell.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };

  // Headers
  const headers = [
    "STT",
    "MaLop (*)",
    "Thứ 2\n(KHONG/TIET_4/TIET_5)",
    "Thứ 3\n(KHONG/TIET_4/TIET_5)",
    "Thứ 4\n(KHONG/TIET_4/TIET_5)",
    "Thứ 5\n(KHONG/TIET_4/TIET_5)",
    "Thứ 6\n(KHONG/TIET_4/TIET_5)",
    "Thứ 7\n(KHONG/TIET_4/TIET_5)",
    "GhiChu",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 35;
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Column widths
  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 20;
  sheet.getColumn(6).width = 20;
  sheet.getColumn(7).width = 20;
  sheet.getColumn(8).width = 20;
  sheet.getColumn(9).width = 30;

  // Dropdown validations
  const coKhongValidation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"KHONG,TIET_4,TIET_5"'],
    showErrorMessage: true,
    errorTitle: "Giá trị không hợp lệ",
    error: "Chỉ nhận: KHONG, TIET_4 hoặc TIET_5",
  };

  for (let row = 4; row <= 54; row++) {
    for (let col = 3; col <= 8; col++) {
      sheet.getCell(row, col).dataValidation = coKhongValidation;
    }
  }

  // Sample data
  sheet.addRow([1, "1A", "TIET_4", "TIET_4", "TIET_4", "TIET_4", "TIET_4", "KHONG", ""]);
  sheet.addRow([2, "1B", "TIET_5", "TIET_5", "TIET_5", "TIET_5", "TIET_5", "KHONG", "Tùy chọn ghi chú"]);
  sheet.addRow([3, "2A", "KHONG", "TIET_4", "TIET_4", "KHONG", "TIET_4", "KHONG", ""]);

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
    const ngaySinhRaw = row.getCell(5).value;
    let ngaySinhStr = "";
    if (ngaySinhRaw instanceof Date) {
      ngaySinhStr = formatDateDDMMYYYY(ngaySinhRaw);
    } else if (typeof ngaySinhRaw === "string") {
      ngaySinhStr = ngaySinhRaw.replace(/\D/g, "");
    }

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
    if (!matKhau && ngaySinhStr) {
      matKhau = ngaySinhStr;
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
 * Parse file Excel Thời khóa biểu
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
  const validOptions = ["KHONG", "TIET_4", "TIET_5"];

  let headerRowNum = 3;
  sheet.eachRow((row, rowNumber) => {
    const cell = String(row.getCell(2).value || "");
    if (cell.includes("MaLop")) headerRowNum = rowNumber;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNum) return;
    const maLop = String(row.getCell(2).value || "").trim().toUpperCase();
    if (!maLop) return;

    const days: Record<string, string> = {};
    const dayColumns = ["thu2", "thu3", "thu4", "thu5", "thu6", "thu7"];
    for (let col = 3; col <= 8; col++) {
      const val = String(row.getCell(col).value || "KHONG").trim().toUpperCase();
      if (!validOptions.includes(val)) {
        errors.push({
          row: rowNumber,
          column: dayColumns[col - 3],
          message: `Cột ${dayColumns[col - 3]} chỉ nhận KHONG, TIET_4 hoặc TIET_5 (Hiện tại: ${val})`,
        });
      }
      days[dayColumns[col - 3]] = val;
    }

    if (!classIdSet.has(maLop)) {
      errors.push({ row: rowNumber, column: "MaLop", message: `Mã Lớp "${maLop}" không tồn tại` });
    }
    
    if (seenMaLop.has(maLop)) {
      errors.push({ row: rowNumber, column: "MaLop", message: `Mã Lớp "${maLop}" bị trùng trong file` });
    }
    seenMaLop.add(maLop);

    const ghiChu = String(row.getCell(9).value || "").trim();

    data.push({
      stt: rowNumber - headerRowNum,
      maLop,
      thu2: days.thu2 as "KHONG" | "TIET_4" | "TIET_5",
      thu3: days.thu3 as "KHONG" | "TIET_4" | "TIET_5",
      thu4: days.thu4 as "KHONG" | "TIET_4" | "TIET_5",
      thu5: days.thu5 as "KHONG" | "TIET_4" | "TIET_5",
      thu6: days.thu6 as "KHONG" | "TIET_4" | "TIET_5",
      thu7: days.thu7 as "KHONG" | "TIET_4" | "TIET_5",
      ghiChu: ghiChu || undefined,
    });
  });

  return { data, errors, isValid: errors.length === 0 };
}
