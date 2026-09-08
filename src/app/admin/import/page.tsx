"use client";

import React, { useState, useRef, useEffect } from "react";
import { format, parse, startOfWeek, endOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  FileUp,
  Trash2,
  Calendar,
  Layers,
  GraduationCap,
  CalendarDays,
  Info,
  Check,
  X,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

// ==================== TYPES ====================

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

interface ClassRow {
  stt: number;
  maLop: string;
  tenLop: string;
  giaoVienChuNhiem: string;
  ghiChu?: string;
}

interface StudentRow {
  stt: number;
  maHocSinh: string;
  hoTen: string;
  gioiTinh?: "NAM" | "NU";
  ngaySinh?: string;
  tenDangNhap: string;
  matKhauBanDau: string;
  maLop: string;
  cheDoAn: "MAN" | "CHAY" | "CHAO";
  dangKyBanTru: "CO" | "KHONG";
  soDienThoaiPhuHuynh?: string;
  isUpdate?: boolean;
}

interface ScheduleRow {
  stt: number;
  maLop: string;
  thu2: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  thu3: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  thu4: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  thu5: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  thu6: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  thu7: "KHONG" | "TIET_4" | "TIET_5" | "CO";
  ghiChu?: string;
}

type ImportType = "class" | "student" | "schedule" | "special-meal";

interface ToastState {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

// Helper to get current week string (e.g., "2026-W34")
function getCurrentWeekString(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

function getWeekDateRange(weekStr: string): string {
  if (!weekStr || !weekStr.includes("-W")) return "";
  try {
    const d = parse(weekStr, "RRRR-'W'II", new Date());
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    return `Từ Thứ 2 (${format(start, 'dd/MM/yyyy')}) đến Chủ Nhật (${format(end, 'dd/MM/yyyy')})`;
  } catch {
    return "";
  }
}

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState<ImportType>("class");

  // File states per tab
  const [classFile, setClassFile] = useState<File | null>(null);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);

  // Schedule extra params
  const [weekString, setWeekString] = useState<string>(() => getCurrentWeekString());

  // Preview Data states
  const [classData, setClassData] = useState<ClassRow[]>([]);
  const [classErrors, setClassErrors] = useState<ValidationError[]>([]);
  const [classPreviewDone, setClassPreviewDone] = useState<boolean>(false);

  const [studentData, setStudentData] = useState<StudentRow[]>([]);
  const [studentErrors, setStudentErrors] = useState<ValidationError[]>([]);
  const [studentPreviewDone, setStudentPreviewDone] = useState<boolean>(false);

  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([]);
  const [scheduleErrors, setScheduleErrors] = useState<ValidationError[]>([]);
  const [schedulePreviewDone, setSchedulePreviewDone] = useState<boolean>(false);

  // Special Meal states
  const [specialMealFile, setSpecialMealFile] = useState<File | null>(null);
  const [specialMealData, setSpecialMealData] = useState<any[]>([]);
  const [specialMealErrors, setSpecialMealErrors] = useState<ValidationError[]>([]);
  const [specialMealPreviewDone, setSpecialMealPreviewDone] = useState<boolean>(false);
  const [specialMealScheduleName, setSpecialMealScheduleName] = useState<string>("");
  const [specialMealMonth, setSpecialMealMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Loading states
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isImportLoading, setIsImportLoading] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // Drag states
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (type: "success" | "error" | "info", title: string, message: string) => {
    const newToast: ToastState = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Get current state depending on active tab
  const getCurrentFile = (): File | null => {
    if (activeTab === "class") return classFile;
    if (activeTab === "student") return studentFile;
    if (activeTab === "special-meal") return specialMealFile;
    return scheduleFile;
  };

  const setCurrentFile = (file: File | null) => {
    if (activeTab === "class") {
      setClassFile(file);
      setClassData([]);
      setClassErrors([]);
      setClassPreviewDone(false);
    } else if (activeTab === "student") {
      setStudentFile(file);
      setStudentData([]);
      setStudentErrors([]);
      setStudentPreviewDone(false);
    } else if (activeTab === "special-meal") {
      setSpecialMealFile(file);
      setSpecialMealData([]);
      setSpecialMealErrors([]);
      setSpecialMealPreviewDone(false);
    } else {
      setScheduleFile(file);
      setScheduleData([]);
      setScheduleErrors([]);
      setSchedulePreviewDone(false);
    }
  };

  const currentFile = getCurrentFile();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("excel")
      ) {
        setCurrentFile(file);
      } else {
        showToast("error", "Định dạng không hợp lệ", "Vui lòng chọn file Excel (.xlsx hoặc .xls)");
      }
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("excel")
      ) {
        setCurrentFile(file);
      } else {
        showToast("error", "Định dạng không hợp lệ", "Vui lòng kéo thả file Excel (.xlsx hoặc .xls)");
      }
    }
  };

  // Preview action
  const handlePreview = async () => {
    if (!currentFile) {
      showToast("error", "Chưa chọn file", "Vui lòng chọn file Excel trước khi xem trước.");
      return;
    }

    setIsPreviewLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("type", activeTab);
      formData.append("action", "preview");

      if (activeTab === "schedule") {
        const [y, w] = weekString.split("-W").map(Number);
        formData.append("weekNumber", (w || 1).toString());
        formData.append("year", (y || new Date().getFullYear()).toString());
      } else if (activeTab === "special-meal") {
        if (!specialMealScheduleName.trim()) {
          showToast("error", "Thiếu tên lịch", "Vui lòng nhập tên lịch ăn đặc biệt (VD: Ngoại Ngữ, GDQP...).");
          setIsPreviewLoading(false);
          return;
        }
        formData.append("scheduleName", specialMealScheduleName.trim());
        if (specialMealMonth) {
          const [y, m] = specialMealMonth.split("-").map(Number);
          formData.append("year", (y || new Date().getFullYear()).toString());
          formData.append("month", (m || (new Date().getMonth() + 1)).toString());
        } else {
          formData.append("year", new Date().getFullYear().toString());
        }
      }

      const res = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(
          "error",
          "Lỗi kiểm tra dữ liệu",
          result.error || "Không thể đọc dữ liệu từ file Excel."
        );
        if (result.errors) {
          if (activeTab === "class") setClassErrors(result.errors);
          if (activeTab === "student") setStudentErrors(result.errors);
          if (activeTab === "schedule") setScheduleErrors(result.errors);
          if (activeTab === "special-meal") setSpecialMealErrors(result.errors);
        }
        return;
      }

      if (activeTab === "class") {
        setClassData(result.data || []);
        setClassErrors(result.errors || []);
        setClassPreviewDone(true);
      } else if (activeTab === "student") {
        setStudentData(result.data || []);
        setStudentErrors(result.errors || []);
        setStudentPreviewDone(true);
      } else if (activeTab === "schedule") {
        setScheduleData(result.data || []);
        setScheduleErrors(result.errors || []);
        setSchedulePreviewDone(true);
      } else if (activeTab === "special-meal") {
        setSpecialMealData(result.data || []);
        setSpecialMealErrors(result.errors || []);
        setSpecialMealPreviewDone(true);
      }

      if (result.isValid) {
        showToast(
          "success",
          "Kiểm tra thành công",
          `File hợp lệ với ${result.data?.length || 0} dòng dữ liệu. Sẵn sàng import!`
        );
      } else {
        showToast(
          "error",
          "Dữ liệu có lỗi",
          `Phát hiện ${result.errors?.length || 0} lỗi trong file. Vui lòng kiểm tra và sửa lỗi.`
        );
      }
    } catch (err: unknown) {
      console.error(err);
      showToast("error", "Lỗi kết nối", "Không thể gửi yêu cầu xem trước đến máy chủ.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Import action
  const handleImport = async () => {
    if (!currentFile) {
      showToast("error", "Chưa chọn file", "Vui lòng chọn file Excel.");
      return;
    }

    setIsImportLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("type", activeTab);
      formData.append("action", "import");

      if (activeTab === "schedule") {
        const [y, w] = weekString.split("-W").map(Number);
        formData.append("weekNumber", (w || 1).toString());
        formData.append("year", (y || new Date().getFullYear()).toString());
      } else if (activeTab === "special-meal") {
        if (!specialMealScheduleName.trim()) {
          showToast("error", "Thiếu tên lịch", "Vui lòng nhập tên lịch ăn đặc biệt.");
          setIsImportLoading(false);
          return;
        }
        formData.append("scheduleName", specialMealScheduleName.trim());
        if (specialMealMonth) {
          const [y, m] = specialMealMonth.split("-").map(Number);
          formData.append("year", (y || new Date().getFullYear()).toString());
          formData.append("month", (m || (new Date().getMonth() + 1)).toString());
        } else {
          formData.append("year", new Date().getFullYear().toString());
        }
      }

      const res = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(
          "error",
          "Import thất bại",
          result.error || "Có lỗi xảy ra trong quá trình lưu dữ liệu."
        );
        if (result.errors) {
          if (activeTab === "class") setClassErrors(result.errors);
          if (activeTab === "student") setStudentErrors(result.errors);
          if (activeTab === "schedule") setScheduleErrors(result.errors);
          if (activeTab === "special-meal") setSpecialMealErrors(result.errors);
        }
        return;
      }

      showToast("success", "Import thành công", result.message || "Dữ liệu đã được lưu vào hệ thống!");

      // Clear current tab preview state
      setCurrentFile(null);
    } catch (err: unknown) {
      console.error(err);
      showToast("error", "Lỗi kết nối", "Không thể gửi dữ liệu import đến máy chủ.");
    } finally {
      setIsImportLoading(false);
    }
  };

  // Check if row has error helper
  const getRowErrors = (
    rowIndex: number,
    stt: number,
    errors: ValidationError[]
  ): ValidationError[] => {
    // Header is usually at row 3, so first data row is Excel row 4
    // STT 1 -> Excel row 4
    const excelRow = stt + 3;
    return errors.filter((err) => err.row === excelRow || err.row === rowIndex + 4);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              toast.type === "success"
                ? "bg-emerald-50/95 border-emerald-300 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-700 dark:text-emerald-100"
                : toast.type === "error"
                ? "bg-red-50/95 border-red-300 text-red-950 dark:bg-red-950/90 dark:border-red-700 dark:text-red-100"
                : "bg-blue-50/95 border-blue-300 text-blue-950 dark:bg-blue-950/90 dark:border-blue-700 dark:text-blue-100"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            {toast.type === "info" && (
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <p className="font-semibold">{toast.title}</p>
              <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            Nhập dữ liệu từ Excel
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tải lên và đồng bộ danh sách lớp học, học sinh bán trú và thời khóa biểu theo định dạng chuẩn Excel (.xlsx).
          </p>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as ImportType)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-4xl h-auto p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs gap-1">
          <TabsTrigger
            value="class"
            className="flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <Layers className="h-4 w-4 text-slate-600 dark:text-slate-300 group-data-[state=active]:text-white" />
            Danh sách Lớp
          </TabsTrigger>
          <TabsTrigger
            value="student"
            className="flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <GraduationCap className="h-4 w-4 text-slate-600 dark:text-slate-300 group-data-[state=active]:text-white" />
            Danh sách Học sinh
          </TabsTrigger>
          <TabsTrigger
            value="schedule"
            className="flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-300 group-data-[state=active]:text-white" />
            Thời khóa biểu
          </TabsTrigger>
          <TabsTrigger
            value="special-meal"
            className="flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 hover:text-slate-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm group"
          >
            <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-300 group-data-[state=active]:text-white" />
            Lịch Ăn Đặc Biệt
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Class Import */}
        <TabsContent value="class" className="space-y-6">
          <ImportSection
            title="Import Danh sách Lớp học"
            description="Tạo mới hoặc cập nhật tên các lớp học và giáo viên chủ nhiệm trong hệ thống."
            templateUrl="/api/excel/template?type=class"
              templateFilename="Template_DanhSach_Lop.xlsx"
              exportUrl="/api/excel/export/classes"
              exportFilename="DanhSachLop_Export.xlsx"
            file={classFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelectClick={() => fileInputRef.current?.click()}
            onClearFile={() => setCurrentFile(null)}
            isPreviewLoading={isPreviewLoading}
            isImportLoading={isImportLoading}
            onPreview={handlePreview}
            onImport={handleImport}
            previewDone={classPreviewDone}
            errors={classErrors}
            dataCount={classData.length}
          />

          {/* Validation Error Summary */}
          {classErrors.length > 0 && (
            <ErrorSummaryCard errors={classErrors} />
          )}

          {/* Preview Table */}
          {classPreviewDone && (
            <ClassPreviewTable
              data={classData}
              errors={classErrors}
              getRowErrors={getRowErrors}
            />
          )}
        </TabsContent>

        {/* Tab 2: Student Import */}
        <TabsContent value="student" className="space-y-6">
          <ImportSection
            title="Import Danh sách Học sinh & Đăng ký Bán trú"
            description="Tạo tài khoản học sinh, phân lớp, thiết lập chế độ ăn (MẶN/CHAY/CHÁO) và trạng thái đăng ký bán trú."
            templateUrl="/api/excel/template?type=student"
              templateFilename="Template_DanhSach_HocSinh.xlsx"
              exportUrl="/api/excel/export/students"
              exportFilename="DanhSachHocSinh_Export.xlsx"
            file={studentFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelectClick={() => fileInputRef.current?.click()}
            onClearFile={() => setCurrentFile(null)}
            isPreviewLoading={isPreviewLoading}
            isImportLoading={isImportLoading}
            onPreview={handlePreview}
            onImport={handleImport}
            previewDone={studentPreviewDone}
            errors={studentErrors}
            dataCount={studentData.length}
          />

          {/* Validation Error Summary */}
          {studentErrors.length > 0 && (
            <ErrorSummaryCard errors={studentErrors} />
          )}

          {/* Preview Table */}
          {studentPreviewDone && (
            <StudentPreviewTable
              data={studentData}
              errors={studentErrors}
              getRowErrors={getRowErrors}
            />
          )}
        </TabsContent>

        {/* Tab 3: Schedule Import */}
        <TabsContent value="schedule" className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Cấu hình Tuần & Năm học áp dụng
              </CardTitle>
              <CardDescription>
                Chọn tuần và năm học để áp dụng lịch ăn bán trú cho các lớp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start max-w-2xl">
                <div className="space-y-2 flex-1 w-full">
                  <Label htmlFor="schedule-week" className="text-sm font-medium">
                    Chọn Tuần học <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="schedule-week"
                      type="week"
                      value={weekString}
                      onChange={(e) => setWeekString(e.target.value)}
                      className="h-10 flex-1"
                      required
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setWeekString(getCurrentWeekString())}
                      className="h-10 shrink-0"
                    >
                      Tuần hiện tại
                    </Button>
                  </div>
                  {weekString && (
                    <p className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100">
                      {getWeekDateRange(weekString)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <ImportSection
            title="Import Thời khóa biểu Bán trú"
            description="Cập nhật lịch ăn bán trú Thứ 2 đến Thứ 7 cho từng lớp theo tuần học."
            templateUrl="/api/excel/template?type=schedule"
              templateFilename="Template_ThoiKhoaBieu.xlsx"
              exportUrl={weekString ? `/api/excel/export/schedules?weekString=${weekString}` : "/api/excel/export/schedules"}
              exportFilename="ThoiKhoaBieu_Export.xlsx"
            file={scheduleFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelectClick={() => fileInputRef.current?.click()}
            onClearFile={() => setCurrentFile(null)}
            isPreviewLoading={isPreviewLoading}
            isImportLoading={isImportLoading}
            onPreview={handlePreview}
            onImport={handleImport}
            previewDone={schedulePreviewDone}
            errors={scheduleErrors}
            dataCount={scheduleData.length}
          />

          {/* Validation Error Summary */}
          {scheduleErrors.length > 0 && (
            <ErrorSummaryCard errors={scheduleErrors} />
          )}

          {/* Preview Table */}
          {schedulePreviewDone && (
            <SchedulePreviewTable
              data={scheduleData}
              errors={scheduleErrors}
              getRowErrors={getRowErrors}
            />
          )}
        </TabsContent>

        {/* Tab 4: Special Meal Import */}
        <TabsContent value="special-meal" className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Cấu hình Lịch Ăn Đặc Biệt
              </CardTitle>
              <CardDescription>
                Nhập tên phân loại cho lịch ăn đặc biệt này (ví dụ: Ngoại Ngữ, GDQP...). Hệ thống sẽ xem đây là 1 lớp riêng biệt khi phân bổ sân ăn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2">
                  <Label htmlFor="special-schedule-name" className="text-sm font-medium">
                    Tên lịch ăn đặc biệt <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="special-schedule-name"
                    placeholder="Ví dụ: Ngoại Ngữ, GDQP..."
                    value={specialMealScheduleName}
                    onChange={(e) => setSpecialMealScheduleName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="special-meal-month" className="text-sm font-medium">
                      Tháng áp dụng <span className="text-red-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setSpecialMealMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 underline font-normal"
                    >
                      Tháng hiện tại
                    </button>
                  </div>
                  <Input
                    id="special-meal-month"
                    type="month"
                    value={specialMealMonth}
                    onChange={(e) => setSpecialMealMonth(e.target.value)}
                    className="h-10 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Cột &quot;TUẦN 1&quot; đến &quot;TUẦN 4&quot; trong file sẽ tự động khớp theo các tuần của tháng này.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ImportSection
            title="Import Lịch Ăn Bán Trú Đặc Biệt"
            description="Tải lên danh sách học sinh đăng ký ăn theo các tuần và thứ trong tuần. Tự động kiểm tra trùng lặp với thời khóa biểu lớp."
            templateUrl="/api/excel/template?type=special-meal"
            templateFilename="Template_LichAnDacBiet.xlsx"
            file={specialMealFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelectClick={() => fileInputRef.current?.click()}
            onClearFile={() => setCurrentFile(null)}
            isPreviewLoading={isPreviewLoading}
            isImportLoading={isImportLoading}
            onPreview={handlePreview}
            onImport={handleImport}
            previewDone={specialMealPreviewDone}
            errors={specialMealErrors}
            dataCount={specialMealData.length}
          />

          {/* Validation Error Summary */}
          {specialMealErrors.length > 0 && (
            <ErrorSummaryCard errors={specialMealErrors} />
          )}

          {/* Preview Table */}
          {specialMealPreviewDone && (
            <SpecialMealPreviewTable
              data={specialMealData}
              errors={specialMealErrors}
              getRowErrors={getRowErrors}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
      />
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

interface ImportSectionProps {
  title: string;
  description: string;
  templateUrl: string;
  templateFilename: string;
  exportUrl?: string;
  exportFilename?: string;
  file: File | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelectClick: () => void;
  onClearFile: () => void;
  isPreviewLoading: boolean;
  isImportLoading: boolean;
  onPreview: () => void;
  onImport: () => void;
  previewDone: boolean;
  errors: ValidationError[];
  dataCount: number;
}

function ImportSection({
  title,
  description,
  templateUrl,
  templateFilename,
  exportUrl,
  exportFilename,
  file,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelectClick,
  onClearFile,
  isPreviewLoading,
  isImportLoading,
  onPreview,
  onImport,
  previewDone,
  errors,
  dataCount,
}: ImportSectionProps) {
  const hasErrors = errors.length > 0;
  const canImport = previewDone && !hasErrors && dataCount > 0;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {exportUrl && (
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 shrink-0 flex items-center gap-2"
                asChild
              >
                <a href={exportUrl} download={exportFilename}>
                  <Download className="h-4 w-4 text-emerald-600" />
                  Tải danh sách hiện hành
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950 shrink-0 flex items-center gap-2"
              asChild
            >
              <a href={templateUrl} download={templateFilename}>
                <Download className="h-4 w-4 text-blue-600" />
                Tải file mẫu Excel
              </a>
            </Button>
          </div>
        </CardHeader>

      <CardContent className="space-y-6">
        {/* Drag & Drop File Zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onFileSelectClick}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 scale-[0.99]"
              : file
              ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/70 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
          }`}
        >
          {file ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-inner">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB • Nhấn hoặc kéo thả file khác để thay thế
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 mt-1 h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFile();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Hủy chọn file
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileUp className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Kéo và thả file Excel vào đây, hoặc{" "}
                  <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
                    nhấn để chọn file
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Định dạng hỗ trợ: Microsoft Excel (.xlsx, .xls)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              Hãy nhấn <strong>&quot;Xem trước (Preview)&quot;</strong> để kiểm tra dữ liệu trước khi thực hiện import chính thức.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Preview Button */}
            <Button
              type="button"
              variant="outline"
              onClick={onPreview}
              disabled={!file || isPreviewLoading || isImportLoading}
              className="border-slate-300 dark:border-slate-700 h-10 px-5"
            >
              {isPreviewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                  Xem trước (Preview)
                </>
              )}
            </Button>

            {/* Import Button */}
            <Button
              type="button"
              onClick={onImport}
              disabled={!canImport || isImportLoading || isPreviewLoading}
              className={`h-10 px-6 font-medium shadow-md transition-all ${
                canImport
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
              }`}
            >
              {isImportLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang lưu dữ liệu...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Xác nhận Import
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== ERROR SUMMARY COMPONENT ====================

function ErrorSummaryCard({ errors }: { errors: ValidationError[] }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/90 dark:border-red-900/60 dark:bg-red-950/40 p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2.5 text-red-800 dark:text-red-200">
        <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <h3 className="font-semibold text-sm">
          Phát hiện {errors.length} lỗi trong file Excel. Vui lòng sửa file và tải lên lại trước khi import.
        </h3>
      </div>
      <div className="max-h-48 overflow-y-auto pr-2 space-y-1.5 text-xs text-red-700 dark:text-red-300 divide-y divide-red-200/60 dark:divide-red-900/40">
        {errors.map((err, idx) => (
          <div key={idx} className="pt-1.5 first:pt-0 flex items-start justify-between gap-4">
            <span className="font-medium">
              • Dòng {err.row} {err.column ? `[Cột: ${err.column}]` : ""}: {err.message}
            </span>
            <Badge variant="destructive" className="text-[10px] h-5 shrink-0">
              Lỗi dòng {err.row}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== PREVIEW TABLES ====================

function ClassPreviewTable({
  data,
  errors,
  getRowErrors,
}: {
  data: ClassRow[];
  errors: ValidationError[];
  getRowErrors: (idx: number, stt: number, errors: ValidationError[]) => ValidationError[];
}) {
  const hasErrors = errors.length > 0;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Kết quả xem trước dữ liệu</CardTitle>
            <Badge variant="outline" className="bg-white dark:bg-slate-800 font-mono text-xs">
              {data.length} dòng
            </Badge>
          </div>
          <div>
            {hasErrors ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {errors.length} lỗi cần sửa
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Dữ liệu hợp lệ ({data.length}/{data.length})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100/60 dark:bg-slate-800/60">
              <TableHead className="w-16 text-center">STT</TableHead>
              <TableHead className="w-32">Mã Lớp</TableHead>
              <TableHead className="w-48">Tên Lớp</TableHead>
              <TableHead className="w-64">Giáo viên chủ nhiệm</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="w-48 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Không có dữ liệu để hiển thị
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => {
                const rowErrs = getRowErrors(idx, row.stt, errors);
                const isRowError = rowErrs.length > 0;

                return (
                  <TableRow
                    key={idx}
                    className={`transition-colors ${
                      isRowError
                        ? "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-l-red-500"
                        : "bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-l-4 border-l-emerald-500"
                    }`}
                  >
                    <TableCell className="text-center font-mono text-xs">{row.stt}</TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.maLop}
                    </TableCell>
                    <TableCell>{row.tenLop}</TableCell>
                    <TableCell>{row.giaoVienChuNhiem || "-"}</TableCell>
                    <TableCell className="text-slate-500 text-xs">{row.ghiChu || "-"}</TableCell>
                    <TableCell className="text-right">
                      {isRowError ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Lỗi dòng
                          </Badge>
                          <span className="text-[11px] text-red-600 font-medium">
                            {rowErrs.map((e) => e.message).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 ml-auto w-fit">
                          <Check className="h-3 w-3" />
                          Hợp lệ
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function StudentPreviewTable({
  data,
  errors,
  getRowErrors,
}: {
  data: StudentRow[];
  errors: ValidationError[];
  getRowErrors: (idx: number, stt: number, errors: ValidationError[]) => ValidationError[];
}) {
  const hasErrors = errors.length > 0;
  const updateCount = data.filter((r) => r.isUpdate).length;
  const newCount = data.length - updateCount;

  const getMealBadge = (type: "MAN" | "CHAY" | "CHAO") => {
    switch (type) {
      case "MAN":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">MẶN</Badge>;
      case "CHAY":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">CHAY</Badge>;
      case "CHAO":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">CHÁO</Badge>;
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base font-semibold">Kết quả xem trước Học sinh</CardTitle>
            <Badge variant="outline" className="bg-white dark:bg-slate-800 font-mono text-xs">
              {data.length} học sinh
            </Badge>
            {!hasErrors && newCount > 0 && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs flex items-center gap-1">
                <Plus className="h-3 w-3" />
                {newCount} thêm mới
              </Badge>
            )}
            {!hasErrors && updateCount > 0 && (
              <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-xs flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {updateCount} cập nhật
              </Badge>
            )}
          </div>
          <div>
            {hasErrors ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {errors.length} lỗi cần sửa
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Dữ liệu hợp lệ ({data.length}/{data.length})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100/60 dark:bg-slate-800/60">
              <TableHead className="w-12 text-center">STT</TableHead>
              <TableHead className="w-28">Mã HS</TableHead>
              <TableHead className="w-44">Họ và Tên</TableHead>
              <TableHead className="w-20 text-center">Giới tính</TableHead>
              <TableHead className="w-28 text-center">Ngày sinh</TableHead>
              <TableHead className="w-32">Tên đăng nhập</TableHead>
              <TableHead className="w-24">Mật khẩu</TableHead>
              <TableHead className="w-20 text-center">Mã Lớp</TableHead>
              <TableHead className="w-24 text-center">Chế độ ăn</TableHead>
              <TableHead className="w-28 text-center">Bán trú</TableHead>
              <TableHead className="w-32">SĐT Phụ huynh</TableHead>
              <TableHead className="w-48 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-slate-400">
                  Không có dữ liệu để hiển thị
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => {
                const rowErrs = getRowErrors(idx, row.stt, errors);
                const isRowError = rowErrs.length > 0;

                return (
                  <TableRow
                    key={idx}
                    className={`transition-colors ${
                      isRowError
                        ? "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-l-red-500"
                        : "bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-l-4 border-l-emerald-500"
                    }`}
                  >
                    <TableCell className="text-center font-mono text-xs">{row.stt}</TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-xs">
                      {row.maHocSinh}
                    </TableCell>
                    <TableCell className="font-medium">{row.hoTen}</TableCell>
                    <TableCell className="text-center text-xs">
                      {row.gioiTinh === "NU" ? (
                        <Badge variant="outline" className="text-pink-700 bg-pink-50 border-pink-200 text-[10px]">Nữ</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]">Nam</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-slate-700 dark:text-slate-300">
                      {row.ngaySinh || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {row.tenDangNhap}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {row.matKhauBanDau ? "••••••" : "-"}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">
                      {row.maLop}
                    </TableCell>
                    <TableCell className="text-center">{getMealBadge(row.cheDoAn)}</TableCell>
                    <TableCell className="text-center">
                      {row.dangKyBanTru === "CO" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                          Có ĐK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-[10px]">
                          Không ĐK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                      {row.soDienThoaiPhuHuynh || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isRowError ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Lỗi
                          </Badge>
                          <span className="text-[11px] text-red-600 font-medium">
                            {rowErrs.map((e) => e.message).join(", ")}
                          </span>
                        </div>
                      ) : row.isUpdate ? (
                        <Badge className="bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 flex items-center gap-1 ml-auto w-fit text-xs font-semibold">
                          <RefreshCw className="h-3 w-3 text-amber-600" />
                          Cập nhật
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 flex items-center gap-1 ml-auto w-fit text-xs font-semibold">
                          <Plus className="h-3 w-3 text-emerald-600" />
                          Thêm mới
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function SchedulePreviewTable({
  data,
  errors,
  getRowErrors,
}: {
  data: ScheduleRow[];
  errors: ValidationError[];
  getRowErrors: (idx: number, stt: number, errors: ValidationError[]) => ValidationError[];
}) {
  const hasErrors = errors.length > 0;

  const renderDayBadge = (val: string) => {
    if (val === "TIET_5") {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-200">
          Tiết 5
        </span>
      );
    }
    if (val === "TIET_4") {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-200">
          Tiết 4
        </span>
      );
    }
    if (val === "CO") {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
          ✓
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-400 text-xs dark:bg-slate-800 dark:text-slate-500">
        -
      </span>
    );
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">Kết quả xem trước Thời khóa biểu</CardTitle>
            <Badge variant="outline" className="bg-white dark:bg-slate-800 font-mono text-xs">
              {data.length} lớp
            </Badge>
            <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-500">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">Tiết 5</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">Tiết 4</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">- Không ăn</span>
            </div>
          </div>
          <div>
            {hasErrors ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {errors.length} lỗi cần sửa
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Dữ liệu hợp lệ ({data.length}/{data.length})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100/60 dark:bg-slate-800/60">
              <TableHead className="w-12 text-center">STT</TableHead>
              <TableHead className="w-28 font-semibold">Mã Lớp</TableHead>
              <TableHead className="w-16 text-center">Thứ 2</TableHead>
              <TableHead className="w-16 text-center">Thứ 3</TableHead>
              <TableHead className="w-16 text-center">Thứ 4</TableHead>
              <TableHead className="w-16 text-center">Thứ 5</TableHead>
              <TableHead className="w-16 text-center">Thứ 6</TableHead>
              <TableHead className="w-16 text-center">Thứ 7</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="w-44 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  Không có dữ liệu để hiển thị
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => {
                const rowErrs = getRowErrors(idx, row.stt, errors);
                const isRowError = rowErrs.length > 0;

                return (
                  <TableRow
                    key={idx}
                    className={`transition-colors ${
                      isRowError
                        ? "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-l-red-500"
                        : "bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-l-4 border-l-emerald-500"
                    }`}
                  >
                    <TableCell className="text-center font-mono text-xs">{row.stt}</TableCell>
                    <TableCell className="font-bold text-blue-700 dark:text-blue-400">
                      {row.maLop}
                    </TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu2)}</TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu3)}</TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu4)}</TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu5)}</TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu6)}</TableCell>
                    <TableCell className="text-center">{renderDayBadge(row.thu7)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{row.ghiChu || "-"}</TableCell>
                    <TableCell className="text-right">
                      {isRowError ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Lỗi
                          </Badge>
                          <span className="text-[11px] text-red-600 font-medium">
                            {rowErrs.map((e) => e.message).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 ml-auto w-fit">
                          <Check className="h-3 w-3" />
                          Hợp lệ
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function SpecialMealPreviewTable({
  data,
  errors,
  getRowErrors,
}: {
  data: any[];
  errors: ValidationError[];
  getRowErrors: (idx: number, stt: number, errors: ValidationError[]) => ValidationError[];
}) {
  const hasErrors = errors.length > 0;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">Kết quả xem trước Lịch ăn đặc biệt</CardTitle>
            <Badge variant="outline" className="bg-white dark:bg-slate-800 font-mono text-xs">
              {data.length} học sinh
            </Badge>
          </div>
          <div>
            {hasErrors ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {errors.length} lỗi cần sửa
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Dữ liệu hợp lệ ({data.length}/{data.length})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100/60 dark:bg-slate-800/60">
              <TableHead className="w-12 text-center">STT</TableHead>
              <TableHead className="w-48 font-semibold">Họ và tên</TableHead>
              <TableHead className="w-24 text-center">Lớp</TableHead>
              <TableHead>Các tuần & Ca ăn</TableHead>
              <TableHead className="w-44 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Không có dữ liệu để hiển thị
                </TableCell>
              </TableRow>
            ) : (
              data.map((row: any, idx: number) => {
                const rowErrs = getRowErrors(idx, row.stt, errors);
                const hasNoStudent = row.entries?.some((e: any) => e.status === "error_no_student");
                const isRowError = rowErrs.length > 0 || hasNoStudent;

                return (
                  <TableRow
                    key={idx}
                    className={`transition-colors ${
                      isRowError
                        ? "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-l-red-500"
                        : "bg-emerald-50/40 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-l-4 border-l-emerald-500"
                    }`}
                  >
                    <TableCell className="text-center font-mono text-xs">{row.stt}</TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.hoTen}
                    </TableCell>
                    <TableCell className="text-center font-bold text-blue-700 dark:text-blue-400">
                      {row.maLop}
                    </TableCell>
                    <TableCell>
                      {(!row.entries || row.entries.length === 0) ? (
                        <span className="text-xs text-slate-400 italic">Không có ca ăn nào</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 py-1">
                          {row.entries.map((entry: any, eIdx: number) => {
                            const dateLabel = entry.date ? entry.date.split("-").reverse().slice(0, 2).join("/") : "";
                            return (
                              <span
                                key={eIdx}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                  entry.shift === "TIET_4"
                                    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200"
                                    : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200"
                                }`}
                                title={`Ngày ${entry.date} (Tuần năm: ${entry.weekNumber})`}
                              >
                                {entry.monthWeekIndex
                                  ? `Tuần ${entry.monthWeekIndex} (${dateLabel}): `
                                  : `Tuần ${entry.weekNumber}: `}
                                {entry.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                                {entry.note && (
                                  <span className="ml-1 text-[10px] text-slate-500 font-normal">
                                    ({entry.note})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isRowError ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Lỗi
                          </Badge>
                          <span className="text-[11px] text-red-600 font-medium">
                            {rowErrs.map((e) => e.message).join(", ") || "Học sinh không tồn tại"}
                          </span>
                        </div>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 flex items-center gap-1 ml-auto w-fit text-xs font-semibold">
                          <Check className="h-3 w-3 text-emerald-600" />
                          Hợp lệ
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
