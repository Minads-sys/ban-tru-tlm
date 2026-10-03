"use client";

import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Calendar,
  Sparkles,
  Plus,
  Search,
  CheckCircle,
  Loader2,
  Trash2,
  Lock,
  CalendarDays,
  FileSpreadsheet,
  Download,
  Upload,
  Clock,
  Edit,
  BookOpen,
  Info,
} from "lucide-react";
import { compareClassNames, getSchoolWeekFromNumber } from "@/lib/utils";
import ExcelJS from "exceljs";

export interface CohortItem {
  id: string;
  code: string;
  name: string;
  description: string;
  academicYear: number;
  semester: number;
  dayOfWeek: number;
  dayOfWeekLabel: string;
  defaultShift: "TIET_4" | "TIET_5";
  startWeek: number;
  endWeek: number;
  excludedWeeks: number[];
  excludedDates: string[];
  isActive: boolean;
  createdAt: string;
  totalMembersCount: number;
  totalMealsCount: number;
  calculatedDatesCount: number;
  sepDatesCount: number;
  futureDatesCount: number;
  members: Array<{
    memberId: string;
    studentId: string;
    studentCode: string;
    boardingCode: string;
    fullName: string;
    classId: string;
    className: string;
    mealType: string;
    status: string;
    joinedDate: string;
  }>;
  overrides: Array<{
    id: string;
    dateStr: string;
    overrideType: string;
    newShift?: "TIET_4" | "TIET_5" | null;
    reason?: string | null;
  }>;
}

interface StudentOption {
  id: string;
  studentCode: string;
  boardingCode?: string | null;
  classId: string;
  class?: { id: string; name: string };
  user?: { fullName: string };
  mealType: string;
  boardingStatus: string;
}

interface ClassOption {
  id: string;
  name: string;
}

const SAFE_MIN_DATE_STR = "2026-10-01";

export default function SpecialCohortsManager() {
  const [cohorts, setCohorts] = useState<CohortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<"ALL" | "OCT_FORWARD" | "SEP_HISTORY">("ALL");

  // Danh sách học sinh & Lớp học
  const [activeStudents, setActiveStudents] = useState<StudentOption[]>([]);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDayOfWeek, setFormDayOfWeek] = useState(2); // 1: T2, 2: T3...
  const [formDefaultShift, setFormDefaultShift] = useState<"TIET_4" | "TIET_5">("TIET_5");
  const [formStartWeek, setFormStartWeek] = useState(1);
  const [formEndWeek, setFormEndWeek] = useState(18);
  const [formExcludedWeeks, setFormExcludedWeeks] = useState<number[]>([]);
  const [formExcludedDates, setFormExcludedDates] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Picker tab inside Form Modal: GRADE | MULTI_CLASS | INDIVIDUAL | EXCEL
  const [pickerTab, setPickerTab] = useState<"GRADE" | "MULTI_CLASS" | "INDIVIDUAL" | "EXCEL">("GRADE");
  const [pickerFilterClass, setPickerFilterClass] = useState("ALL");
  const [pickerSearchText, setPickerSearchText] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal Danh sách Thành viên & Lịch Ngoại lệ riêng
  const [viewingCohort, setViewingCohort] = useState<CohortItem | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Fetch Cohorts
  const fetchCohorts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/cohorts?academicYear=2026&semester=1");
      const data = await res.json();
      if (res.ok && data.cohorts) {
        setCohorts(data.cohorts);
      }
    } catch (err) {
      console.error("Lỗi khi tải Special Cohorts:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Students & Classes
  const ensureStudentsAndClasses = async () => {
    if (activeStudents.length > 0 && classList.length > 0) return;
    setLoadingStudents(true);
    try {
      const [resStu, resCla] = await Promise.all([
        fetch("/api/students?status=ACTIVE"),
        fetch("/api/classes"),
      ]);
      const stuData = await resStu.json();
      const claData = await resCla.json();
      if (Array.isArray(stuData)) setActiveStudents(stuData);
      if (Array.isArray(claData)) {
        setClassList(claData.sort((a, b) => compareClassNames(a.name, b.name)));
      }
    } catch (err) {
      console.error("Lỗi khi tải học sinh/lớp:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitialCohorts() {
      try {
        const res = await fetch("/api/schedule/cohorts?academicYear=2026&semester=1");
        const data = await res.json();
        if (!ignore && res.ok && data.cohorts) {
          setCohorts(data.cohorts);
        }
      } catch (err) {
        console.error("Lỗi khi tải Special Cohorts:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitialCohorts();
    return () => {
      ignore = true;
    };
  }, []);

  // Filtered Cohorts
  const filteredCohorts = useMemo(() => {
    return cohorts.filter((c) => {
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const matchName = c.name.toLowerCase().includes(t);
        const matchCode = c.code.toLowerCase().includes(t);
        const matchStudent = c.members.some((m) => m.fullName.toLowerCase().includes(t) || m.studentCode.includes(t));
        if (!matchName && !matchCode && !matchStudent) return false;
      }

      if (filterPeriod === "OCT_FORWARD") {
        return c.futureDatesCount > 0;
      }
      if (filterPeriod === "SEP_HISTORY") {
        return c.sepDatesCount > 0;
      }
      return true;
    });
  }, [cohorts, searchTerm, filterPeriod]);

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    await ensureStudentsAndClasses();
    setModalMode("CREATE");
    setEditingCohortId(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormDayOfWeek(2); // Thứ 3
    setFormDefaultShift("TIET_5");
    setFormStartWeek(1);
    setFormEndWeek(18);
    setFormExcludedWeeks([]);
    setFormExcludedDates([]);
    setSelectedStudentIds(new Set());
    setPickerTab("GRADE");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = async (cohort: CohortItem) => {
    await ensureStudentsAndClasses();
    setModalMode("EDIT");
    setEditingCohortId(cohort.id);
    setFormName(cohort.name);
    setFormCode(cohort.code);
    setFormDescription(cohort.description);
    setFormDayOfWeek(cohort.dayOfWeek);
    setFormDefaultShift(cohort.defaultShift);
    setFormStartWeek(cohort.startWeek);
    setFormEndWeek(cohort.endWeek);
    setFormExcludedWeeks(cohort.excludedWeeks || []);
    setFormExcludedDates(cohort.excludedDates || []);
    setSelectedStudentIds(new Set(cohort.members.map((m) => m.studentId)));
    setPickerTab("INDIVIDUAL");
    setIsModalOpen(true);
  };

  // Nút chọn nhanh theo khối
  const handleSelectByGrade = (grade: "10" | "11" | "12") => {
    const studentsInGrade = activeStudents.filter((s) => {
      const cls = s.class?.name || s.classId || "";
      return cls.startsWith(grade);
    });
    const newSet = new Set(selectedStudentIds);
    studentsInGrade.forEach((s) => newSet.add(s.id));
    setSelectedStudentIds(newSet);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `Đã chọn thêm ${studentsInGrade.length} học sinh Khối ${grade}`,
      showConfirmButton: false,
      timer: 1500,
    });
  };

  // Chọn toàn bộ 1 lớp
  const handleSelectClass = (clsId: string) => {
    const studentsInClass = activeStudents.filter((s) => s.classId === clsId);
    const newSet = new Set(selectedStudentIds);
    const allSelected = studentsInClass.every((s) => newSet.has(s.id));
    if (allSelected) {
      studentsInClass.forEach((s) => newSet.delete(s.id));
    } else {
      studentsInClass.forEach((s) => newSet.add(s.id));
    }
    setSelectedStudentIds(newSet);
  };

  // Lưu tạo mới / cập nhật Cohort
  const handleSaveCohort = async () => {
    if (!formName.trim()) {
      Swal.fire("Lỗi", "Vui lòng nhập tên lớp học phần", "warning");
      return;
    }
    if (selectedStudentIds.size === 0) {
      Swal.fire("Lỗi", "Vui lòng chọn ít nhất 1 học sinh bán trú vào học phần", "warning");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "CREATE") {
        const payload = {
          name: formName.trim(),
          code: formCode.trim() || undefined,
          description: formDescription,
          academicYear: 2026,
          semester: 1,
          dayOfWeek: formDayOfWeek,
          defaultShift: formDefaultShift,
          startWeek: formStartWeek,
          endWeek: formEndWeek,
          excludedWeeks: formExcludedWeeks,
          excludedDates: formExcludedDates,
          studentIds: Array.from(selectedStudentIds),
        };

        const res = await fetch("/api/schedule/cohorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tạo lớp học phần");

        Swal.fire("Thành công", data.message, "success");
        setIsModalOpen(false);
        fetchCohorts();
      } else if (modalMode === "EDIT" && editingCohortId) {
        const currentCohort = cohorts.find((c) => c.id === editingCohortId);
        const originalStudentIds = new Set(currentCohort?.members.map((m) => m.studentId) || []);

        const addStudentIds = Array.from(selectedStudentIds).filter((id) => !originalStudentIds.has(id));
        const removeStudentIds = Array.from(originalStudentIds).filter((id) => !selectedStudentIds.has(id));

        const payload = {
          id: editingCohortId,
          name: formName.trim(),
          description: formDescription,
          dayOfWeek: formDayOfWeek,
          defaultShift: formDefaultShift,
          startWeek: formStartWeek,
          endWeek: formEndWeek,
          excludedWeeks: formExcludedWeeks,
          excludedDates: formExcludedDates,
          addStudentIds,
          removeStudentIds,
        };

        const res = await fetch("/api/schedule/cohorts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể cập nhật lớp học phần");

        Swal.fire("Thành công", data.message, "success");
        setIsModalOpen(false);
        fetchCohorts();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Swal.fire("Lỗi", msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Xóa / Ngưng hoạt động Cohort
  const handleDeleteCohort = async (cohort: CohortItem) => {
    const isLockedSep = cohort.sepDatesCount > 0;
    const confirmText = isLockedSep
      ? `Lớp học phần '${cohort.name}' có ${cohort.sepDatesCount} buổi ăn thuộc Tháng 9 đã khóa sổ hóa đơn. Hệ thống sẽ giữ nguyên vẹn dữ liệu Tháng 9 và chuyển học phần sang trạng thái 'Ngưng hoạt động', đồng thời hủy các suất ăn từ 01/10 trở đi. Bạn có chắc chắn không?`
      : `Bạn có chắc chắn muốn xóa hoàn toàn lớp học phần '${cohort.name}' không?`;

    const result = await Swal.fire({
      title: "Xác nhận thao tác",
      text: confirmText,
      icon: isLockedSep ? "info" : "warning",
      showCancelButton: true,
      confirmButtonColor: isLockedSep ? "#2563eb" : "#d33",
      cancelButtonColor: "#64748b",
      confirmButtonText: isLockedSep ? "Đồng ý ngưng hoạt động" : "Xóa vĩnh viễn",
      cancelButtonText: "Hủy",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/schedule/cohorts?id=${cohort.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể thực hiện thao tác");

      Swal.fire("Thành công", data.message, "success");
      fetchCohorts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Swal.fire("Lỗi", msg, "error");
    }
  };

  // Xuất file template Excel 2 cột
  const handleExportSimpleTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("DS_HocSinh_HocPhan");

    sheet.columns = [
      { header: "MÃ BÁN TRÚ / MÃ HS", key: "code", width: 22 },
      { header: "HỌ VÀ TÊN (Tham khảo)", key: "fullName", width: 28 },
      { header: "LỚP", key: "class", width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.addRow(["BT0001", "Nguyễn Văn An", "10A1"]);
    sheet.addRow(["BT0002", "Trần Thị Bích", "10A2"]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Mau_Nhap_HocSinh_HocPhan.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Excel 2 cột
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const sheet = workbook.worksheets[0];

      const importedCodes: string[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const val = row.getCell(1).text?.trim();
        if (val) importedCodes.push(val);
      });

      if (importedCodes.length === 0) {
        Swal.fire("Lỗi file", "Không tìm thấy mã học sinh nào trong cột đầu tiên của file Excel.", "warning");
        return;
      }

      // Khớp với activeStudents
      const codeSet = new Set(importedCodes.map((c) => c.toUpperCase()));
      const matched = activeStudents.filter(
        (s) =>
          codeSet.has((s.boardingCode || "").toUpperCase()) ||
          codeSet.has(s.studentCode.toUpperCase())
      );

      const newSet = new Set(selectedStudentIds);
      matched.forEach((s) => newSet.add(s.id));
      setSelectedStudentIds(newSet);

      Swal.fire(
        "Nhập file thành công",
        `Đã tìm thấy và thêm ${matched.length} / ${importedCodes.length} học sinh bán trú hợp lệ từ file Excel.`,
        "success"
      );
    } catch {
      Swal.fire("Lỗi đọc file", "Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx.", "error");
    } finally {
      e.target.value = "";
    }
  };

  // Bảng ngày tính toán cho Lịch Ngoại lệ của Cohort đang xem
  const viewingCohortWeeksGrid = useMemo(() => {
    if (!viewingCohort) return [];
    const pad = (n: number) => String(n).padStart(2, "0");
    const excludedWeekSet = new Set(viewingCohort.excludedWeeks || []);
    const excludedDateSet = new Set(viewingCohort.excludedDates || []);
    const overrideMap = new Map(viewingCohort.overrides.map((o) => [o.dateStr, o]));

    const weeks = [];
    for (let w = viewingCohort.startWeek; w <= viewingCohort.endWeek; w++) {
      const info = getSchoolWeekFromNumber(w, viewingCohort.academicYear);
      const monday = new Date(info.startDate);
      const dayDiff = Math.max(0, Math.min(5, viewingCohort.dayOfWeek - 1));
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + dayDiff);

      const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
      const isPastSep = dateStr < SAFE_MIN_DATE_STR;
      const isExcludedWeek = excludedWeekSet.has(w);
      const isExcludedDate = excludedDateSet.has(dateStr);
      const ovr = overrideMap.get(dateStr);
      const isCancelled = isExcludedWeek || isExcludedDate || ovr?.overrideType === "CANCEL";
      const shift = ovr?.newShift || viewingCohort.defaultShift;

      weeks.push({
        schoolWeek: w,
        dateStr,
        displayDate: `${pad(targetDate.getDate())}/${pad(targetDate.getMonth() + 1)}`,
        isPastSep,
        isCancelled,
        shift,
        isOverride: !!ovr,
      });
    }
    return weeks;
  }, [viewingCohort]);

  // Cập nhật ngoại lệ cho 1 tuần của Cohort đang xem
  const handleToggleWeekException = async (weekItem: { schoolWeek: number; dateStr: string; isPastSep: boolean; isCancelled: boolean }) => {
    if (!viewingCohort) return;
    if (weekItem.isPastSep) {
      Swal.fire("Đã đóng băng", "Buổi ăn này thuộc Tháng 9/2026 đã khóa sổ hóa đơn nên không thể sửa đổi.", "info");
      return;
    }

    const newExWeeks = new Set(viewingCohort.excludedWeeks || []);
    if (weekItem.isCancelled) {
      newExWeeks.delete(weekItem.schoolWeek);
    } else {
      newExWeeks.add(weekItem.schoolWeek);
    }

    try {
      const res = await fetch("/api/schedule/cohorts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: viewingCohort.id,
          excludedWeeks: Array.from(newExWeeks),
        }),
      });
      if (!res.ok) throw new Error("Không thể cập nhật ngoại lệ tuần");
      await fetchCohorts();
      // Update local viewingCohort
      setViewingCohort((prev) => (prev ? { ...prev, excludedWeeks: Array.from(newExWeeks) } : null));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Swal.fire("Lỗi", msg, "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <Card className="border-purple-200 dark:border-purple-900 bg-gradient-to-r from-purple-50/50 via-white to-indigo-50/30 dark:from-slate-900 dark:to-slate-950">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Quản Lý Lớp Học Phần Đặc Biệt (Dài Hạn)
            </h2>
            <p className="text-xs text-slate-500">
              Mô hình lớp chuyên đề (NN2, GDQP, HSG): Tự động phân tách ca ăn, miễn trừ tuần thi và bảo toàn số liệu Tháng 9.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Filter buttons */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterPeriod("ALL")}
                className={`px-3 py-1.5 rounded-md cursor-pointer ${
                  filterPeriod === "ALL" ? "bg-white dark:bg-slate-900 text-purple-700 shadow-2xs font-bold" : "text-slate-600"
                }`}
              >
                Tất cả học kỳ ({cohorts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod("OCT_FORWARD")}
                className={`px-3 py-1.5 rounded-md cursor-pointer ${
                  filterPeriod === "OCT_FORWARD" ? "bg-white dark:bg-slate-900 text-purple-700 shadow-2xs font-bold" : "text-slate-600"
                }`}
              >
                🟢 Tháng 10 trở đi
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod("SEP_HISTORY")}
                className={`px-3 py-1.5 rounded-md cursor-pointer ${
                  filterPeriod === "SEP_HISTORY" ? "bg-white dark:bg-slate-900 text-purple-700 shadow-2xs font-bold" : "text-slate-600"
                }`}
              >
                🔒 Tháng 9 (Đã khóa)
              </button>
            </div>

            <Button
              onClick={handleOpenCreateModal}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer h-9 shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Lớp Học Phần Mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Search & Overview Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Tìm theo tên học phần, mã hoặc tên học sinh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Tổng số: <strong>{filteredCohorts.length}</strong> lớp học phần</span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle className="h-3.5 w-3.5" />
            Đã đồng bộ sang Chốt suất Bếp & Sân ăn
          </span>
        </div>
      </div>

      {/* 3. Cohorts Cards Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-purple-600" />
          Đang tải danh sách lớp học phần đặc biệt...
        </div>
      ) : filteredCohorts.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
          <BookOpen className="h-10 w-10 text-purple-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Chưa có lớp học phần đặc biệt nào phù hợp.
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Bấm nút &quot;Tạo Lớp Học Phần Mới&quot; để thiết lập các nhóm chuyên đề dài hạn như Ngoại ngữ 2, Giáo dục quốc phòng hoặc Đội tuyển HSG.
          </p>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo Lớp Học Phần Ngay
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCohorts.map((cohort) => {
            const hasSep = cohort.sepDatesCount > 0;

            return (
              <Card
                key={cohort.id}
                className="overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {cohort.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                        <span>{cohort.code}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {cohort.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0.5">
                          🟢 Đang hoạt động
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px] font-semibold py-0.5">
                          ⏸️ Ngưng hoạt động
                        </Badge>
                      )}
                      {hasSep && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0">
                          🔒 Có {cohort.sepDatesCount} buổi T9
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 flex-1 text-xs">
                  {/* Schedule Details */}
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-purple-600" />
                        Lịch học cố định:
                      </span>
                      <strong className="text-purple-800 dark:text-purple-300 font-semibold">
                        {cohort.dayOfWeekLabel} hàng tuần
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-purple-600" />
                        Ca ăn mặc định:
                      </span>
                      <Badge
                        className={`text-[10px] font-bold ${
                          cohort.defaultShift === "TIET_4"
                            ? "bg-orange-50 text-orange-800 border-orange-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                      >
                        {cohort.defaultShift === "TIET_4" ? "Tiết 4 (10:15)" : "Tiết 5 (11:00)"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                        Khoảng tuần học:
                      </span>
                      <span>
                        Tuần {cohort.startWeek} &rarr; Tuần {cohort.endWeek}
                        {cohort.excludedWeeks.length > 0 && (
                          <span className="text-rose-500 font-medium ml-1">
                            (Nghỉ {cohort.excludedWeeks.length} tuần)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Sĩ số & Tổng suất ăn */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded border border-purple-100 bg-purple-50/50 dark:bg-purple-950/20">
                      <div className="text-[11px] text-purple-600 font-medium">Sĩ số thành viên</div>
                      <div className="text-sm font-bold text-purple-900 dark:text-purple-100">
                        {cohort.totalMembersCount} học sinh
                      </div>
                    </div>
                    <div className="p-2 rounded border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20">
                      <div className="text-[11px] text-indigo-600 font-medium">Tổng suất dự kiến</div>
                      <div className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                        {cohort.totalMealsCount || cohort.totalMembersCount * cohort.calculatedDatesCount} suất
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Card Action Buttons */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 flex items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewingCohort(cohort);
                        setIsMembersModalOpen(true);
                      }}
                      className="h-8 px-2.5 text-[11px] font-semibold border-slate-200 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5 mr-1 text-purple-600" />
                      DS Học sinh ({cohort.totalMembersCount})
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewingCohort(cohort);
                        setIsCalendarModalOpen(true);
                      }}
                      className="h-8 px-2.5 text-[11px] font-semibold border-slate-200 hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1 text-purple-600" />
                      Lịch & Ngoại lệ
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEditModal(cohort)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-purple-600 cursor-pointer"
                      title="Sửa cấu hình lớp học phần"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCohort(cohort)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Ngưng hoạt động hoặc xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. Modal: Tạo / Cập nhật Lớp học phần */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-purple-200">
          <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {modalMode === "CREATE" ? "Tạo Lớp Học Phần Đặc Biệt Mới" : `Cập Nhật Lớp Học Phần: ${formName}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cài đặt lịch lặp cố định, chọn học sinh bán trú (ACTIVE) theo Khối/Lớp hoặc Excel, hệ thống tự động đồng bộ sang Chốt suất Bếp & Sân ăn.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Thông tin học phần */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tên lớp học phần *</Label>
                <Input
                  placeholder="VD: NN2 Tiếng Hàn K10, GDQP Khối 11..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Thứ học cố định</Label>
                <select
                  value={formDayOfWeek}
                  onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value={1}>Thứ 2</option>
                  <option value={2}>Thứ 3</option>
                  <option value={3}>Thứ 4</option>
                  <option value={4}>Thứ 5</option>
                  <option value={5}>Thứ 6</option>
                  <option value={6}>Thứ 7</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Ca ăn mặc định</Label>
                <select
                  value={formDefaultShift}
                  onChange={(e) => setFormDefaultShift(e.target.value as "TIET_4" | "TIET_5")}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value="TIET_5">Tiết 5 (11:00) - Phổ biến</option>
                  <option value="TIET_4">Tiết 4 (10:15)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tuần bắt đầu</Label>
                <Input
                  type="number"
                  min={1}
                  max={35}
                  value={formStartWeek}
                  onChange={(e) => setFormStartWeek(Number(e.target.value))}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tuần kết thúc</Label>
                <Input
                  type="number"
                  min={1}
                  max={35}
                  value={formEndWeek}
                  onChange={(e) => setFormEndWeek(Number(e.target.value))}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-slate-700">Mô tả / Ghi chú</Label>
                <Input
                  placeholder="Ghi chú thêm về phòng học, GV phụ trách..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
              </div>
            </div>

            {/* Bộ Nạp Học Sinh Đa Cấp Độ */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Chọn học sinh tham gia học phần ({selectedStudentIds.size} em đã chọn)
                  </span>
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPickerTab("GRADE")}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      pickerTab === "GRADE" ? "bg-white text-purple-700 font-bold shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    1. Theo Khối (1-Click)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("MULTI_CLASS")}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      pickerTab === "MULTI_CLASS" ? "bg-white text-purple-700 font-bold shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    2. Cả Lớp
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("INDIVIDUAL")}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      pickerTab === "INDIVIDUAL" ? "bg-white text-purple-700 font-bold shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    3. Nhặt từng em
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("EXCEL")}
                    className={`px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 ${
                      pickerTab === "EXCEL" ? "bg-white text-purple-700 font-bold shadow-2xs" : "text-slate-600"
                    }`}
                  >
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                    4. Excel 2 cột
                  </button>
                </div>
              </div>

              {/* Sub-tabs content */}
              {loadingStudents ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <span>Đang tải dữ liệu học sinh bán trú...</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: THEO KHỐI */}
                  {pickerTab === "GRADE" && (
                    <div className="space-y-3 py-2">
                      <div className="text-xs text-slate-500">
                        Phù hợp cho các môn học cả khối như Giáo dục quốc phòng hoặc Chuyên đề khối. Bấm để thêm toàn bộ học sinh bán trú của khối đó:
                      </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectByGrade("10")}
                      className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-left transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                        <span>🎓 Khối 10</span>
                        <span className="text-[11px] bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                          {activeStudents.filter((s) => (s.class?.name || s.classId).startsWith("10")).length} em
                        </span>
                      </div>
                      <div className="text-[11px] text-blue-700">Chọn tất cả học sinh bán trú Khối 10</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectByGrade("11")}
                      className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-left transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-indigo-900 flex items-center justify-between">
                        <span>🎓 Khối 11</span>
                        <span className="text-[11px] bg-indigo-100 px-1.5 py-0.5 rounded font-mono">
                          {activeStudents.filter((s) => (s.class?.name || s.classId).startsWith("11")).length} em
                        </span>
                      </div>
                      <div className="text-[11px] text-indigo-700">Chọn tất cả học sinh bán trú Khối 11</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectByGrade("12")}
                      className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                        <span>🎓 Khối 12</span>
                        <span className="text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                          {activeStudents.filter((s) => (s.class?.name || s.classId).startsWith("12")).length} em
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700">Chọn tất cả học sinh bán trú Khối 12</div>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: CẢ LỚP */}
              {pickerTab === "MULTI_CLASS" && (
                <div className="space-y-2 py-2">
                  <div className="text-xs text-slate-500">
                    Tick chọn vào lớp để thêm toàn bộ học sinh bán trú của lớp đó vào học phần:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                    {classList.map((cls) => {
                      const stuInClass = activeStudents.filter((s) => s.classId === cls.id);
                      const selectedInClass = stuInClass.filter((s) => selectedStudentIds.has(s.id)).length;
                      const isAll = stuInClass.length > 0 && selectedInClass === stuInClass.length;

                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleSelectClass(cls.id)}
                          className={`p-2 rounded border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                            isAll
                              ? "bg-purple-600 text-white border-purple-600 font-bold"
                              : selectedInClass > 0
                              ? "bg-purple-50 border-purple-300 text-purple-900 font-medium"
                              : "bg-slate-50 border-slate-200 hover:border-purple-300 text-slate-700"
                          }`}
                        >
                          <span>{cls.name}</span>
                          <span className="text-[10px] opacity-80 font-mono">
                            {selectedInClass}/{stuInClass.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: NHẶT TỪNG EM (Smart Drawer) */}
              {pickerTab === "INDIVIDUAL" && (
                <div className="space-y-2 py-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={pickerFilterClass}
                      onChange={(e) => setPickerFilterClass(e.target.value)}
                      className="h-8 px-2.5 rounded border border-slate-200 text-xs bg-white"
                    >
                      <option value="ALL">Tất cả lớp ({classList.length} lớp)</option>
                      {classList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <div className="sm:col-span-2 relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Tìm tên học sinh hoặc mã bán trú BT..."
                        value={pickerSearchText}
                        onChange={(e) => setPickerSearchText(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-100 z-10 text-[11px]">
                        <TableRow>
                          <TableHead className="w-10 text-center p-2">Chọn</TableHead>
                          <TableHead className="w-24 text-center p-2">Mã BT</TableHead>
                          <TableHead className="p-2">Họ và tên</TableHead>
                          <TableHead className="w-20 text-center p-2">Lớp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {activeStudents
                          .filter((s) => {
                            if (pickerFilterClass !== "ALL" && s.classId !== pickerFilterClass) return false;
                            if (pickerSearchText.trim()) {
                              const t = pickerSearchText.toLowerCase();
                              const nameMatch = (s.user?.fullName || "").toLowerCase().includes(t);
                              const codeMatch = s.studentCode.toLowerCase().includes(t);
                              const btMatch = (s.boardingCode || "").toLowerCase().includes(t);
                              if (!nameMatch && !codeMatch && !btMatch) return false;
                            }
                            return true;
                          })
                          .slice(0, 100)
                          .map((s) => {
                            const isChecked = selectedStudentIds.has(s.id);
                            return (
                              <TableRow
                                key={s.id}
                                onClick={() => {
                                  const n = new Set(selectedStudentIds);
                                  if (isChecked) n.delete(s.id);
                                  else n.add(s.id);
                                  setSelectedStudentIds(n);
                                }}
                                className={`cursor-pointer ${isChecked ? "bg-purple-50/70" : "hover:bg-slate-50"}`}
                              >
                                <TableCell className="text-center p-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-purple-600 h-3.5 w-3.5"
                                  />
                                </TableCell>
                                <TableCell className="text-center font-mono font-bold text-blue-700 p-2">
                                  {s.boardingCode || s.studentCode}
                                </TableCell>
                                <TableCell className="font-medium p-2">{s.user?.fullName}</TableCell>
                                <TableCell className="text-center font-bold p-2">{s.class?.name || s.classId}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* TAB 4: IMPORT EXCEL 2 CỘT */}
              {pickerTab === "EXCEL" && (
                <div className="p-4 rounded-lg border border-dashed border-purple-200 bg-purple-50/30 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-slate-800">Nhập danh sách học sinh từ file Excel (2 cột):</strong>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Chỉ cần Cột A: Mã Bán Trú (hoặc Mã HS), Cột B: Họ và tên. Hệ thống tự động khớp vào danh sách.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportSimpleTemplate}
                      className="text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 h-8"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Tải file mẫu Excel
                    </Button>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      id="excel-cohort-upload"
                      onChange={handleImportExcelFile}
                      className="hidden"
                    />
                    <label
                      htmlFor="excel-cohort-upload"
                      className="w-full h-10 px-4 rounded-lg border border-dashed border-purple-300 bg-white hover:bg-purple-50 flex items-center justify-center gap-2 cursor-pointer text-purple-700 font-semibold"
                    >
                      <Upload className="h-4 w-4" />
                      Chọn file Excel (.xlsx) từ máy tính để nạp
                    </label>
                  </div>
                </div>
              )}
                </>
              )}

              {/* Thanh ghim danh sách đã chọn (Selected Drawer Summary) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-700">
                  ⚡ Đã chọn: <strong className="text-purple-700">{selectedStudentIds.size} học sinh bán trú</strong>
                </span>
                {selectedStudentIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds(new Set())}
                    className="text-red-500 hover:underline cursor-pointer font-medium"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving} className="text-xs">
              Hủy
            </Button>
            <Button
              onClick={handleSaveCohort}
              disabled={saving || !formName.trim() || selectedStudentIds.size === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Đang lưu và đồng bộ...
                </>
              ) : (
                "Lưu Lớp Học Phần & Đồng Bộ Suất Ăn"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Modal: Danh sách Thành viên Lớp học phần */}
      <Dialog open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
        <DialogContent className="max-w-3xl w-[94vw] max-h-[85vh] flex flex-col p-0 gap-0 border-purple-200">
          <DialogHeader className="p-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Danh Sách Học Sinh: {viewingCohort?.name} ({viewingCohort?.members.length} em)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <Table>
              <TableHeader className="bg-slate-100 text-xs">
                <TableRow>
                  <TableHead className="w-12 text-center p-2">STT</TableHead>
                  <TableHead className="w-24 text-center p-2">Mã BT</TableHead>
                  <TableHead className="p-2">Họ và tên</TableHead>
                  <TableHead className="w-20 text-center p-2">Lớp</TableHead>
                  <TableHead className="w-24 text-center p-2">Món ăn</TableHead>
                  <TableHead className="w-28 text-center p-2">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {viewingCohort?.members.map((m, idx) => (
                  <TableRow key={m.memberId} className="hover:bg-slate-50">
                    <TableCell className="text-center text-slate-400 p-2">{idx + 1}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-blue-700 p-2">
                      {m.boardingCode}
                    </TableCell>
                    <TableCell className="font-semibold p-2 text-slate-900">{m.fullName}</TableCell>
                    <TableCell className="text-center font-bold p-2">{m.className}</TableCell>
                    <TableCell className="text-center p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {m.mealType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center p-2">
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        ACTIVE
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsMembersModalOpen(false)} className="text-xs">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Modal: Lịch Học & Ngoại lệ Tuần */}
      <Dialog open={isCalendarModalOpen} onOpenChange={setIsCalendarModalOpen}>
        <DialogContent className="max-w-3xl w-[94vw] max-h-[85vh] flex flex-col p-0 gap-0 border-purple-200">
          <DialogHeader className="p-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Lịch Học & Ngoại Lệ: {viewingCohort?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Lưới tuần học kỳ: Click vào tuần để bật/tắt (nghỉ thi, nghỉ lễ). Các buổi thuộc Tháng 9 được đóng băng để bảo toàn hóa đơn.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Ghi chú:</strong> Các ô có biểu tượng <Lock className="h-3 w-3 inline text-slate-500" /> thuộc Tháng 9/2026 đã đóng sổ tiền ăn nên chỉ để tra cứu.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {viewingCohortWeeksGrid.map((wItem) => (
                <div
                  key={wItem.schoolWeek}
                  onClick={() => handleToggleWeekException(wItem)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                    wItem.isPastSep
                      ? "bg-slate-100/80 border-slate-200 text-slate-500 opacity-80"
                      : wItem.isCancelled
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-white border-purple-200 hover:border-purple-400 text-slate-900 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Tuần {wItem.schoolWeek}</span>
                    {wItem.isPastSep ? (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Lock className="h-3 w-3" /> T9
                      </span>
                    ) : wItem.isCancelled ? (
                      <Badge className="bg-rose-100 text-rose-700 text-[10px] py-0">Nghỉ</Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700 text-[10px] py-0">Học</Badge>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-slate-500">{wItem.displayDate}</div>

                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Ca:</span>
                    <strong className={wItem.shift === "TIET_4" ? "text-orange-600" : "text-blue-600"}>
                      {wItem.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsCalendarModalOpen(false)} className="text-xs">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
