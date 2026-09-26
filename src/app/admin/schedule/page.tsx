"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Swal from "sweetalert2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Save, Loader2, Copy, CheckCircle, X, ChevronLeft, ChevronRight, Trash2, Info, Sparkles, Search, Filter, ExternalLink, Plus, UserPlus, Calendar, Clock, Users, Check, ArrowUpDown, Download, Upload, FileSpreadsheet, AlertTriangle, GraduationCap, FileUp } from "lucide-react";
import { format, parse, startOfWeek, endOfWeek, addDays, addWeeks } from "date-fns";
import { compareClassNames, removeVietnameseTones } from "@/lib/utils";

interface SpecialMealItem {
  id: string;
  studentId: string;
  studentCode: string;
  boardingCode: string;
  fullName: string;
  classId: string;
  className: string;
  dateStr: string;
  displayDate: string;
  dayOfWeekName: string;
  shift: "TIET_4" | "TIET_5";
  scheduleName: string;
  source: string;
  createdAt: string;
}

interface ScheduleData {
  classId: string;
  className: string;
  totalBoarding: number;
  maleBoarding: number;
  femaleBoarding: number;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
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

export default function SchedulePage() {
  const { data: session } = useSession();
  const isAccountant = session?.user?.role === "ACCOUNTANT";

  const [weekString, setWeekString] = useState<string>(() => getCurrentWeekString());
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [draftSchedules, setDraftSchedules] = useState<ScheduleData[] | null>(null);
  const [defaultVisibleDays, setDefaultVisibleDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [visibleDays, setVisibleDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [hideEmptyClasses, setHideEmptyClasses] = useState(false);

  // Special Meal States
  const [specialMeals, setSpecialMeals] = useState<SpecialMealItem[]>([]);
  const [specialScheduleNames, setSpecialScheduleNames] = useState<string[]>([]);
  const [specialTotalAllWeeksCount, setSpecialTotalAllWeeksCount] = useState(0);
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [specialFilterSchedule, setSpecialFilterSchedule] = useState("ALL");
  const [specialFilterDate, setSpecialFilterDate] = useState("ALL");
  const [specialSearchTerm, setSpecialSearchTerm] = useState("");
  const [specialAllWeeks, setSpecialAllWeeks] = useState(false);
  const [specialLoading, setSpecialLoading] = useState(false);
  const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set());
  const [isBulkUpdatingShift, setIsBulkUpdatingShift] = useState(false);

  // Add Special Meal Modal States
  const [isAddSpecialModalOpen, setIsAddSpecialModalOpen] = useState(false);
  const [addScheduleMode, setAddScheduleMode] = useState<"NEW" | "EXISTING">("NEW");
  const [addScheduleName, setAddScheduleName] = useState("");
  const [addShift, setAddShift] = useState<"TIET_4" | "TIET_5">("TIET_5");
  const [addDateTab, setAddDateTab] = useState<"WEEK_DAY" | "SPECIFIC">("WEEK_DAY");
  const [addSelectedDays, setAddSelectedDays] = useState<number[]>([3]); // 1=T2..6=T7, default 3 (Thứ 4)
  const [addSpecificDates, setAddSpecificDates] = useState<string[]>([]);
  const [addCustomDateInput, setAddCustomDateInput] = useState<string>("");
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [addFilterClass, setAddFilterClass] = useState<string>("ALL");
  const [addStudentSearch, setAddStudentSearch] = useState<string>("");
  const [addSelectedStudentIds, setAddSelectedStudentIds] = useState<Set<string>>(new Set());
  const [loadingActiveStudents, setLoadingActiveStudents] = useState(false);
  const [isSavingSpecialMeal, setIsSavingSpecialMeal] = useState(false);

  // Cải tiến: Chọn tuần trên lịch và ca ăn riêng từng tuần
  const [addSelectedWeeks, setAddSelectedWeeks] = useState<number[]>([40]);
  const [addWeekShifts, setAddWeekShifts] = useState<Record<number, "TIET_4" | "TIET_5">>({ 40: "TIET_5" });

  // Cải tiến: Tab nạp học sinh (Manual vs Excel)
  const [studentSourceTab, setStudentSourceTab] = useState<"MANUAL" | "EXCEL">("MANUAL");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isExcelPreviewing, setIsExcelPreviewing] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<any[] | null>(null);
  const [excelPreviewSummary, setExcelPreviewSummary] = useState<{
    totalRows: number;
    validCount: number;
    conflictCount: number;
    skippedCount: number;
  } | null>(null);
  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);

  // Tạo danh sách các tuần học trên lịch (16 tuần từ tuần hiện tại)
  const availableCalendarWeeks = useMemo(() => {
    if (!weekString) return [];
    try {
      const base = parse(weekString, "RRRR-'W'II", new Date());
      const baseMonday = startOfWeek(base, { weekStartsOn: 1 });
      const weeks: Array<{
        isoWeek: number;
        schoolWeek: number;
        year: number;
        startDate: Date;
        endDate: Date;
        rangeLabel: string;
        dateByDay: Record<number, { dateStr: string; display: string }>;
      }> = [];

      for (let i = 0; i < 16; i++) {
        const mon = addWeeks(baseMonday, i);
        const sun = addDays(mon, 6);
        const y = mon.getFullYear();
        const isoW = parseInt(format(mon, "II"), 10);
        const schoolW = isoW >= 37 ? isoW - 36 : isoW + 16;

        const dateByDay: Record<number, { dateStr: string; display: string }> = {};
        for (let d = 1; d <= 6; d++) {
          const targetD = addDays(mon, d - 1);
          dateByDay[d] = {
            dateStr: format(targetD, "yyyy-MM-dd"),
            display: format(targetD, "dd/MM/yyyy"),
          };
        }

        weeks.push({
          isoWeek: isoW,
          schoolWeek: schoolW,
          year: y,
          startDate: mon,
          endDate: sun,
          rangeLabel: `${format(mon, "dd/MM")} - ${format(sun, "dd/MM/yyyy")}`,
          dateByDay,
        });
      }
      return weeks;
    } catch {
      return [];
    }
  }, [weekString]);

  const openAddSpecialModal = async () => {
    setIsAddSpecialModalOpen(true);
    // Tự động gán tuần hiện tại nếu chưa chọn
    if (availableCalendarWeeks.length > 0 && addSelectedWeeks.length === 0) {
      const firstWeek = availableCalendarWeeks[0].isoWeek;
      setAddSelectedWeeks([firstWeek]);
      setAddWeekShifts({ [firstWeek]: addShift });
    }

    // Tự động gán tên lịch từ bộ lọc hiện tại hoặc lịch đầu tiên
    if (specialFilterSchedule && specialFilterSchedule !== "ALL") {
      setAddScheduleMode("EXISTING");
      setAddScheduleName(specialFilterSchedule);
    } else if (specialScheduleNames.length > 0 && !addScheduleName) {
      setAddScheduleName(specialScheduleNames[0]);
    }

    // Tải danh sách học sinh bán trú và lớp nếu chưa tải
    if (activeStudents.length === 0) {
      setLoadingActiveStudents(true);
      try {
        const [resStudents, resClasses] = await Promise.all([
          fetch("/api/students?status=ACTIVE"),
          fetch("/api/classes"),
        ]);
        const studentsData = await resStudents.json();
        const classesData = await resClasses.json();
        if (Array.isArray(studentsData)) {
          setActiveStudents(studentsData);
        }
        if (Array.isArray(classesData)) {
          setClassList(classesData.sort((a: any, b: any) => compareClassNames(a.name, b.name)));
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách học sinh bán trú:", err);
      } finally {
        setLoadingActiveStudents(false);
      }
    }
  };

  // Tính toán danh sách ngày & ca ăn áp dụng
  const getCalculatedDateShifts = (): Array<{
    dateStr: string;
    display: string;
    dowName: string;
    shift: "TIET_4" | "TIET_5";
    weekNumber: number;
    schoolWeekNumber: number;
  }> => {
    if (addDateTab === "WEEK_DAY") {
      const results: Array<{
        dateStr: string;
        display: string;
        dowName: string;
        shift: "TIET_4" | "TIET_5";
        weekNumber: number;
        schoolWeekNumber: number;
      }> = [];
      const dayNames: Record<number, string> = {
        1: "Thứ Hai",
        2: "Thứ Ba",
        3: "Thứ Tư",
        4: "Thứ Năm",
        5: "Thứ Sáu",
        6: "Thứ Bảy",
      };

      for (const w of availableCalendarWeeks) {
        if (addSelectedWeeks.includes(w.isoWeek)) {
          const shift = addWeekShifts[w.isoWeek] || addShift;
          for (const d of [...addSelectedDays].sort((a, b) => a - b)) {
            const dateObj = w.dateByDay[d];
            if (dateObj) {
              results.push({
                dateStr: dateObj.dateStr,
                display: dateObj.display,
                dowName: dayNames[d] || `Thứ ${d + 1}`,
                shift,
                weekNumber: w.isoWeek,
                schoolWeekNumber: w.schoolWeek,
              });
            }
          }
        }
      }
      return results;
    } else {
      const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      return [...addSpecificDates].sort().map((dStr) => {
        const d = new Date(dStr + "T00:00:00");
        const dow = d.getDay();
        return {
          dateStr: dStr,
          display: format(d, "dd/MM/yyyy"),
          dowName: dayNames[dow],
          shift: addShift,
          weekNumber: parseInt(format(d, "II"), 10),
          schoolWeekNumber: 1,
        };
      });
    }
  };

  const getCalculatedDates = () => getCalculatedDateShifts();

  // Chọn nhanh theo Khối 10, 11, 12
  const handleSelectByGrade = (grade: "10" | "11" | "12") => {
    const newSet = new Set(addSelectedStudentIds);
    activeStudents.forEach((s) => {
      const cName = (s.class?.name || s.classId || "").trim().toUpperCase();
      if (cName.startsWith(grade)) {
        newSet.add(s.id);
      }
    });
    setAddSelectedStudentIds(newSet);
  };

  // Xuất file mẫu Excel theo cấu hình tuần & ca ăn
  const handleExportCustomTemplate = async () => {
    const dateShifts = getCalculatedDateShifts();
    if (dateShifts.length === 0) {
      Swal.fire("Chưa chọn tuần/ngày", "Vui lòng chọn ít nhất một tuần trên lịch và thứ trong tuần để xuất file mẫu.", "warning");
      return;
    }

    setIsExportingTemplate(true);
    try {
      const weeksConfig = dateShifts.map((ds) => ({
        weekNumber: ds.weekNumber,
        schoolWeekNumber: ds.schoolWeekNumber,
        dayOfWeek: addSelectedDays[0] || 3,
        dayName: ds.dowName,
        dateStr: ds.display.slice(0, 5),
        shift: ds.shift,
      }));

      const res = await fetch("/api/excel/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "special-meal",
          weeksConfig,
        }),
      });

      if (!res.ok) throw new Error("Không thể tạo template Excel");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Template_LichAnDacBiet_${addScheduleName.trim() || "Moi"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      Swal.fire("Lỗi", "Không thể tải file mẫu: " + err.message, "error");
    } finally {
      setIsExportingTemplate(false);
    }
  };

  // Kiểm tra file Excel (Preview)
  const handlePreviewExcel = async () => {
    if (!excelFile) {
      Swal.fire("Chưa chọn file", "Vui lòng chọn hoặc kéo thả file Excel cần kiểm tra.", "warning");
      return;
    }
    if (!addScheduleName.trim()) {
      Swal.fire("Thiếu tên lịch", "Vui lòng nhập hoặc chọn tên lịch ăn đặc biệt.", "warning");
      return;
    }

    setIsExcelPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", excelFile);
      formData.append("type", "special-meal");
      formData.append("action", "preview");
      formData.append("scheduleName", addScheduleName.trim());
      formData.append("year", new Date().getFullYear().toString());

      const res = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (res.ok) {
        setExcelPreviewData(result.data || []);
        setExcelPreviewSummary(result.summary || null);
        if (result.errors && result.errors.length > 0) {
          Swal.fire({
            title: "Cảnh báo dữ liệu",
            html: `File có ${result.errors.length} cảnh báo/lỗi định dạng. Vui lòng xem bảng bên dưới.`,
            icon: "warning",
          });
        }
      } else {
        Swal.fire("Lỗi kiểm tra", result.error || "Không thể kiểm tra file Excel.", "error");
      }
    } catch (err: any) {
      Swal.fire("Lỗi", "Không thể kết nối đến máy chủ: " + err.message, "error");
    } finally {
      setIsExcelPreviewing(false);
    }
  };

  // Lưu lịch ăn đặc biệt từ danh sách thủ công
  const handleSaveAddSpecialMeals = async () => {
    if (isAccountant) return;

    if (!addScheduleName.trim()) {
      Swal.fire("Thiếu tên lịch", "Vui lòng nhập hoặc chọn tên lịch ăn đặc biệt (VD: NN2 Tieng Han, GDQP...).", "warning");
      return;
    }

    const targetDateShifts = getCalculatedDateShifts();
    if (targetDateShifts.length === 0) {
      Swal.fire("Thiếu ngày áp dụng", "Vui lòng chọn ít nhất một ngày/tuần áp dụng suất ăn.", "warning");
      return;
    }

    if (addSelectedStudentIds.size === 0) {
      Swal.fire("Chưa chọn học sinh", "Vui lòng tích chọn ít nhất một bạn học sinh trong danh sách bán trú.", "warning");
      return;
    }

    setIsSavingSpecialMeal(true);
    try {
      const res = await fetch("/api/schedule/special-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleName: addScheduleName.trim(),
          studentIds: Array.from(addSelectedStudentIds),
          dateShifts: targetDateShifts.map((ds) => ({ date: ds.dateStr, shift: ds.shift })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await Swal.fire({
          title: "Thành công!",
          text: data.message || `Đã thêm thành công ${data.count} suất ăn đặc biệt.`,
          icon: "success",
          confirmButtonColor: "#2563eb",
        });
        setIsAddSpecialModalOpen(false);
        setAddSelectedStudentIds(new Set());
        fetchSpecialMeals();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể lưu học sinh vào lịch đặc biệt.", "error");
      }
    } catch (err: any) {
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ: " + (err?.message || ""), "error");
    } finally {
      setIsSavingSpecialMeal(false);
    }
  };

  // Lưu lịch ăn đặc biệt từ file Excel đã preview
  const handleImportExcel = async () => {
    if (!excelFile || !excelPreviewData) {
      Swal.fire("Chưa kiểm tra file", "Vui lòng bấm 'Kiểm tra file (Preview)' trước khi lưu vào lịch ăn.", "warning");
      return;
    }
    if (!addScheduleName.trim()) {
      Swal.fire("Thiếu tên lịch", "Vui lòng nhập hoặc chọn tên lịch ăn đặc biệt.", "warning");
      return;
    }

    setIsExcelImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", excelFile);
      formData.append("type", "special-meal");
      formData.append("action", "import");
      formData.append("scheduleName", addScheduleName.trim());
      formData.append("year", new Date().getFullYear().toString());

      const res = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (res.ok) {
        await Swal.fire({
          title: "Import thành công!",
          html: `
            <div class="text-left text-sm space-y-1.5 p-2">
              <p>• Suất tạo mới: <strong class="text-emerald-600">${result.created || 0}</strong> suất</p>
              <p>• Suất cập nhật: <strong class="text-blue-600">${result.updated || 0}</strong> suất</p>
              ${result.prioritizedRegularCount ? `<p class="text-amber-600 font-semibold">• Ưu tiên theo TKB thường niên: <strong>${result.prioritizedRegularCount}</strong> suất</p>` : ""}
              <p>• Bỏ qua: <strong class="text-slate-500">${result.skipped || 0}</strong> suất</p>
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#2563eb",
        });

        setIsAddSpecialModalOpen(false);
        setExcelFile(null);
        setExcelPreviewData(null);
        setExcelPreviewSummary(null);
        fetchSpecialMeals();
      } else {
        Swal.fire("Lỗi Import", result.error || "Không thể lưu dữ liệu.", "error");
      }
    } catch (err: any) {
      Swal.fire("Lỗi", "Không thể lưu dữ liệu: " + err.message, "error");
    } finally {
      setIsExcelImporting(false);
    }
  };

  const fetchSpecialMeals = async () => {
    if (!weekString) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    setSpecialLoading(true);
    try {
      let url = `/api/schedule/special-meals?year=${year}&weekNumber=${weekNumber}`;
      if (specialAllWeeks) url += "&allWeeks=true";
      if (specialFilterSchedule && specialFilterSchedule !== "ALL") {
        url += `&scheduleName=${encodeURIComponent(specialFilterSchedule)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSpecialMeals(data.items || []);
        setSpecialScheduleNames(data.scheduleNames || []);
        setSpecialTotalAllWeeksCount(data.totalAllWeeksCount ?? 0);
      }
    } catch (e) {
      console.error("Lỗi khi tải lịch ăn đặc biệt:", e);
    } finally {
      setSpecialLoading(false);
    }
  };

  const availableDates = useMemo(() => {
    const map = new Map<string, { dateStr: string; displayDate: string; dayOfWeekName: string; count: number }>();
    for (const sm of specialMeals) {
      if (specialFilterSchedule !== "ALL" && sm.scheduleName !== specialFilterSchedule) continue;
      const existing = map.get(sm.dateStr);
      if (existing) {
        existing.count++;
      } else {
        map.set(sm.dateStr, {
          dateStr: sm.dateStr,
          displayDate: sm.displayDate,
          dayOfWeekName: sm.dayOfWeekName,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [specialMeals, specialFilterSchedule]);

  useEffect(() => {
    if (specialFilterDate !== "ALL" && !availableDates.some((d) => d.dateStr === specialFilterDate)) {
      setSpecialFilterDate("ALL");
    }
  }, [availableDates, specialFilterDate]);

  useEffect(() => {
    fetchSpecialMeals();
    setSelectedMealIds(new Set());
  }, [weekString, specialAllWeeks, specialFilterSchedule]);

  const handleToggleShift = async (sm: SpecialMealItem) => {
    if (isAccountant) return;
    const newShift = sm.shift === "TIET_4" ? "TIET_5" : "TIET_4";
    const oldShift = sm.shift;
    const newShiftLabel = newShift === "TIET_4" ? "Tiết 4" : "Tiết 5";

    // Optimistic UI update
    setSpecialMeals((prev) =>
      prev.map((item) => (item.id === sm.id ? { ...item, shift: newShift } : item))
    );
    setUpdatingShiftId(sm.id);

    try {
      const res = await fetch("/api/schedule/special-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sm.id, shift: newShift }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Hoàn tác nếu có lỗi
        setSpecialMeals((prev) =>
          prev.map((item) => (item.id === sm.id ? { ...item, shift: oldShift } : item))
        );
        Swal.fire("Lỗi", data.error || "Không thể đổi ca ăn", "error");
      } else {
        const Toast = Swal.mixin({
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
        Toast.fire({
          icon: "success",
          title: `Đã chuyển HS ${sm.fullName} sang ${newShiftLabel}`,
        });
      }
    } catch (err: any) {
      setSpecialMeals((prev) =>
        prev.map((item) => (item.id === sm.id ? { ...item, shift: oldShift } : item))
      );
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ: " + (err?.message || ""), "error");
    } finally {
      setUpdatingShiftId(null);
    }
  };

  const handleBulkUpdateShift = async (targetShift: "TIET_4" | "TIET_5") => {
    if (isAccountant || selectedMealIds.size === 0) return;
    const shiftLabel = targetShift === "TIET_4" ? "Tiết 4" : "Tiết 5";
    const ids = Array.from(selectedMealIds);

    const result = await Swal.fire({
      title: `Chuyển sang ${shiftLabel}?`,
      text: `Bạn có chắc chắn muốn chuyển ${ids.length} suất ăn đã chọn sang ${shiftLabel}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: `Chuyển sang ${shiftLabel}`,
      cancelButtonText: "Hủy",
      confirmButtonColor: targetShift === "TIET_4" ? "#f97316" : "#2563eb",
    });

    if (!result.isConfirmed) return;

    setIsBulkUpdatingShift(true);
    try {
      const res = await fetch("/api/schedule/special-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, shift: targetShift }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSpecialMeals((prev) =>
          prev.map((item) => (selectedMealIds.has(item.id) ? { ...item, shift: targetShift } : item))
        );
        setSelectedMealIds(new Set());
        Swal.fire("Thành công", data.message || `Đã chuyển ${ids.length} suất sang ${shiftLabel}`, "success");
      } else {
        Swal.fire("Lỗi", data.error || "Không thể cập nhật ca ăn hàng loạt", "error");
      }
    } catch (err: any) {
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ: " + (err?.message || ""), "error");
    } finally {
      setIsBulkUpdatingShift(false);
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (isAccountant || selectedMealIds.size === 0) return;
    const ids = Array.from(selectedMealIds);

    const result = await Swal.fire({
      title: `Xóa ${ids.length} suất ăn đã chọn?`,
      text: `Bạn có chắc chắn muốn xóa vĩnh viễn ${ids.length} suất ăn đặc biệt đã chọn? Thao tác này không thể khôi phục.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa các mục đã chọn",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/schedule/special-meals?ids=${ids.join(",")}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSpecialMeals((prev) => prev.filter((item) => !selectedMealIds.has(item.id)));
        setSelectedMealIds(new Set());
        Swal.fire("Đã xóa", data.message || `Đã xóa thành công ${ids.length} suất ăn`, "success");
        fetchSpecialMeals();
      } else {
        Swal.fire("Lỗi", data.error || "Không thể xóa các suất ăn đã chọn", "error");
      }
    } catch (err: any) {
      Swal.fire("Lỗi", "Lỗi kết nối máy chủ: " + (err?.message || ""), "error");
    }
  };

  const handleDeleteSpecialMeal = async (id: string, studentName: string, dateStr: string) => {
    if (isAccountant) return;
    const result = await Swal.fire({
      title: "Xác nhận xóa suất ăn đặc biệt?",
      text: `Bạn có chắc chắn muốn xóa suất ăn đặc biệt của học sinh "${studentName}" vào ngày ${dateStr}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/schedule/special-meals?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          Swal.fire("Thành công", data.message, "success");
          fetchSpecialMeals();
        } else {
          Swal.fire("Lỗi", data.error || "Không thể xóa", "error");
        }
      } catch {
        Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
      }
    }
  };

  const handleDeleteBulkSpecialMeals = async (schedName: string, isAllWeeks: boolean = false) => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    const isWipeAll = schedName === "ALL";
    const title = isWipeAll
      ? "Xóa sạch TẤT CẢ lịch đặc biệt?"
      : isAllWeeks
      ? `Xóa sạch lịch "${schedName}" (Tất cả các tuần)?`
      : `Xóa lịch "${schedName}" trong Tuần ${weekNumber}?`;

    const text = isWipeAll
      ? "Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ tất cả suất ăn đặc biệt trong hệ thống? Thao tác này không thể khôi phục."
      : isAllWeeks
      ? `Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ suất ăn của lịch "${schedName}" trên TẤT CẢ các tuần? Thao tác này không thể khôi phục.`
      : `Bạn có chắc muốn xóa tất cả suất ăn của lịch "${schedName}" trong Tuần ${weekNumber}/${year}?`;

    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận xóa ngay",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        let url = "/api/schedule/special-meals";
        if (isWipeAll) {
          url += "?deleteAll=true";
        } else if (isAllWeeks) {
          url += `?scheduleName=${encodeURIComponent(schedName)}&allWeeks=true`;
        } else {
          url += `?scheduleName=${encodeURIComponent(schedName)}&year=${year}&weekNumber=${weekNumber}`;
        }

        const res = await fetch(url, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          Swal.fire("Thành công", data.message, "success");
          if (isWipeAll || isAllWeeks) {
            setSpecialFilterSchedule("ALL");
          }
          fetchSpecialMeals();
        } else {
          Swal.fire("Lỗi", data.error || "Không thể xóa", "error");
        }
      } catch {
        Swal.fire("Lỗi", "Lỗi kết nối máy chủ", "error");
      }
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.DEFAULT_VISIBLE_DAYS) {
          const parsed = JSON.parse(data.DEFAULT_VISIBLE_DAYS);
          setDefaultVisibleDays(parsed);
          setVisibleDays(parsed);
        }
      } catch (e) {}
    };
    fetchSettings();
  }, []);

  const fetchSchedules = async () => {
    if (!weekString) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?year=${year}&weekNumber=${weekNumber}`);
      const data = await res.json();
      
      const sortedList = (data.data || []).sort((a: ScheduleData, b: ScheduleData) =>
        compareClassNames(a.classId, b.classId)
      );

      if (data.isNew) {
        setSchedules([]);
        setDraftSchedules(sortedList);
        setHasChanges(false);
      } else {
        setSchedules(sortedList);
        setDraftSchedules(null);
        setHasChanges(false);
      }
      setVisibleDays(defaultVisibleDays);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải thời khóa biểu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [weekString]);

  const createNewSchedule = async () => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    const result = await Swal.fire({
      title: "Tạo thời khóa biểu mới?",
      text: `Tuần ${weekNumber}/${year} chưa có TKB. Bạn có muốn tạo khung TKB mới (tự động lấy sĩ số HS bán trú hiện tại) không?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Có, tạo mới",
      cancelButtonText: "Không",
    });

    if (result.isConfirmed && draftSchedules) {
      setSchedules(draftSchedules);
      setHasChanges(true);
    }
  };

  const toggleDay = (classId: string, day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday") => {
    if (isAccountant) return;
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.classId !== classId) return s;
        let nextState = "NONE";
        if (s[day] === "NONE") nextState = "TIET_4";
        else if (s[day] === "TIET_4") nextState = "TIET_5";
        return { ...s, [day]: nextState };
      })
    );
    setSaved(false);
    setHasChanges(true);
  };

  const saveSchedules = async () => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, weekNumber, schedules }),
      });
      if (res.ok) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 3000);
      } else {
        Swal.fire("Lỗi", "Lỗi khi lưu thời khóa biểu", "error");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi lưu", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async () => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    const result = await Swal.fire({
      title: "Xóa toàn bộ TKB tuần này?",
      text: `Bạn có chắc muốn xóa vĩnh viễn dữ liệu thời khóa biểu của tuần ${weekNumber} / ${year} không?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa ngay",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const res = await fetch(`/api/schedule?year=${year}&weekNumber=${weekNumber}`, {
          method: "DELETE",
        });
        if (res.ok) {
          Swal.fire("Thành công", `Đã xóa TKB tuần ${weekNumber}`, "success");
          fetchSchedules(); // reload data
        } else {
          Swal.fire("Lỗi", "Lỗi khi xóa thời khóa biểu", "error");
        }
      } catch {
        Swal.fire("Lỗi", "Lỗi kết nối khi xóa", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  const copyFromPrevWeek = async () => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;
    const prevWeek = weekNumber - 1;

    if (prevWeek < 1) {
      Swal.fire("Thông báo", "Không thể copy từ tuần trước đó", "warning");
      return;
    }
    try {
      const res = await fetch(`/api/schedule?year=${year}&weekNumber=${prevWeek}`);
      const data = await res.json();
      if (!data.isNew && data.data && data.data.length > 0) {
        setSchedules(data.data);
        setSaved(false);
        setHasChanges(true);
        Swal.fire("Thành công", `Đã copy TKB từ tuần ${prevWeek}`, "success");
      } else {
        Swal.fire("Thông báo", `Tuần ${prevWeek} chưa có dữ liệu TKB`, "info");
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi copy", "error");
    }
  };

  const dayLabel = (val: string) => {
    if (val === "TIET_4") return <Badge className="bg-orange-100 text-orange-700 cursor-pointer select-none">Tiết 4</Badge>;
    if (val === "TIET_5") return <Badge className="bg-blue-100 text-blue-700 cursor-pointer select-none">Tiết 5</Badge>;
    return <Badge className="bg-gray-100 text-gray-400 cursor-pointer select-none">Trống</Badge>;
  };

  const navigateWeek = (offset: number) => {
    if (!weekString) return;
    try {
      const d = parse(weekString, "RRRR-'W'II", new Date());
      const newDate = addWeeks(d, offset);
      setWeekString(format(newDate, "RRRR-'W'II"));
    } catch {}
  };

  const clearDay = (day: keyof ScheduleData, dayName: string) => {
    if (isAccountant) return;
    Swal.fire({
      title: `Xóa TKB ${dayName}?`,
      text: `Bạn có chắc muốn chuyển TKB của TẤT CẢ lớp trong ngày ${dayName} về "Trống"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    }).then((res) => {
      if (res.isConfirmed) {
        setSchedules((prev) => prev.map(s => ({ ...s, [day]: "NONE" })));
        setSaved(false);
        setHasChanges(true);
      }
    });
  };

  const isDayClearable = (day: keyof ScheduleData) => {
    if (schedules.length === 0) return false;
    return schedules.some((s) => s[day] !== "NONE");
  };

  const currentYear = weekString ? weekString.split("-W")[0] : new Date().getFullYear();
  const currentWeek = weekString ? weekString.split("-W")[1] : 1;

  let weekDates = { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "" };
  if (weekString) {
    try {
      const base = parse(weekString, "RRRR-'W'II", new Date());
      const mon = startOfWeek(base, { weekStartsOn: 1 });
      weekDates.monday = format(mon, "dd/MM");
      weekDates.tuesday = format(addDays(mon, 1), "dd/MM");
      weekDates.wednesday = format(addDays(mon, 2), "dd/MM");
      weekDates.thursday = format(addDays(mon, 3), "dd/MM");
      weekDates.friday = format(addDays(mon, 4), "dd/MM");
      weekDates.saturday = format(addDays(mon, 5), "dd/MM");
    } catch {}
  }

  // Tính tổng suất ăn dự kiến cho mỗi ngày (chỉ đếm lớp có lịch ăn)
  const getDayTotal = (day: string) => {
    return schedules
      .filter(s => s[day as keyof ScheduleData] !== "NONE")
      .reduce((sum, s) => sum + s.totalBoarding, 0);
  };

  // Lọc danh sách lớp hiển thị (ẩn lớp trống nếu bật filter)
  const displaySchedules = hideEmptyClasses
    ? schedules.filter(s =>
        visibleDays.some(day => s[day as keyof ScheduleData] !== "NONE")
      )
    : schedules;

  const calculatedDates = getCalculatedDates();

  const filteredActiveStudents = activeStudents.filter((s) => {
    if (addFilterClass !== "ALL" && s.classId !== addFilterClass) return false;
    if (!addStudentSearch.trim()) return true;
    const term = addStudentSearch.toLowerCase().trim();
    const normTerm = removeVietnameseTones(term);
    const name = s.user?.fullName?.toLowerCase() || "";
    const normName = removeVietnameseTones(name);
    const bCode = s.boardingCode?.toLowerCase() || "";
    const sCode = s.studentCode?.toLowerCase() || "";
    const cName = s.class?.name?.toLowerCase() || "";

    return (
      name.includes(term) ||
      normName.includes(normTerm) ||
      bCode.includes(term) ||
      sCode.includes(term) ||
      cName.includes(term)
    );
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-600" />
          Thời khóa biểu Bán trú
        </h1>

        {/* Nút mở danh sách Lịch ăn đặc biệt */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsSpecialModalOpen(true)}
          className="h-10 border-purple-300 text-purple-700 bg-purple-50/90 hover:bg-purple-100 hover:text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 flex items-center gap-2 shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold">Lịch ăn đặc biệt</span>
          {specialMeals.length > 0 ? (
            <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {specialMeals.length} suất
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
              0
            </Badge>
          )}
        </Button>
      </div>

      {isAccountant && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-amber-800">Chế độ chỉ xem (Kế toán)</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Tài khoản Kế toán có quyền tra cứu lịch ăn các lớp theo tuần nhưng không thể tạo mới, sao chép, chỉnh sửa hoặc xóa thời khóa biểu.
            </div>
          </div>
        </div>
      )}

      {/* Bộ chọn tuần */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-start flex-wrap">
            <div className="space-y-2 flex-1 min-w-[300px]">
              <Label className="font-medium">Chọn Tuần học</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigateWeek(-1)}
                  className="h-10 px-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Input
                  type="week"
                  value={weekString}
                  onChange={(e) => setWeekString(e.target.value)}
                  className="w-48 h-10"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setWeekString(getCurrentWeekString())}
                  className="h-10"
                >
                  Tuần hiện tại
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigateWeek(1)}
                  className="h-10 px-2"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {weekString && (
                  <p className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100 w-fit">
                    {getWeekDateRange(weekString)}
                  </p>
                )}
                {specialMeals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSpecialModalOpen(true)}
                    className="text-xs font-semibold text-purple-700 bg-purple-100/80 hover:bg-purple-200 border border-purple-200 px-3 py-2 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span>Tuần này có {specialMeals.length} suất ăn đặc biệt ({Array.from(new Set(specialMeals.map(s => s.scheduleName))).join(", ")}) &rarr;</span>
                  </button>
                )}
              </div>
            </div>
            
            {!isAccountant && (
              <div className="flex gap-2 items-center flex-wrap pt-7">
                <Button onClick={copyFromPrevWeek} variant="outline" className="h-10">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy từ tuần trước
                </Button>
                <Button 
                  onClick={saveSchedules} 
                  disabled={saving || (!hasChanges && !saved)} 
                  className={`h-10 ${hasChanges ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : saved ? (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {saved ? "Đã lưu!" : hasChanges ? "Lưu TKB *" : "Lưu TKB"}
                </Button>
                {hasChanges && (
                  <span className="text-sm font-medium text-amber-600 animate-pulse">
                    ⚠️ Có thay đổi chưa lưu
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bảng TKB */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-4">
            <span>Lịch ăn bán trú - Tuần {currentWeek} / {currentYear}</span>
            {schedules.length > 0 && !loading && !isAccountant && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={deleteSchedule}
                title="Xóa hoàn toàn lịch tuần này"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Xóa lịch tuần
              </Button>
            )}
          </CardTitle>

          {/* Toggle Cột */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Cột:</span>
            <div className="flex gap-1">
              {[
                { id: "monday", label: "T2" },
                { id: "tuesday", label: "T3" },
                { id: "wednesday", label: "T4" },
                { id: "thursday", label: "T5" },
                { id: "friday", label: "T6" },
                { id: "saturday", label: "T7" }
              ].map((day) => {
                const isActive = visibleDays.includes(day.id);
                return (
                  <Button
                    key={day.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-2 text-xs ${isActive ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                    onClick={() => {
                      let newDays = [...visibleDays];
                      if (isActive) {
                        newDays = newDays.filter(d => d !== day.id);
                      } else {
                        newDays.push(day.id);
                      }
                      setVisibleDays(newDays);
                    }}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none ml-3">
              <input
                type="checkbox"
                checked={hideEmptyClasses}
                onChange={(e) => setHideEmptyClasses(e.target.checked)}
                className="rounded border-slate-300 h-3.5 w-3.5 accent-indigo-600"
              />
              Ẩn lớp trống
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="text-gray-500 mt-2">Đang tải...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lớp</TableHead>
                  <TableHead className="text-center">Bán trú</TableHead>
                  <TableHead className="text-center">Nam</TableHead>
                  <TableHead className="text-center">Nữ</TableHead>
                  {visibleDays.includes("monday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 2
                        {!isAccountant && isDayClearable("monday") && (
                          <button onClick={() => clearDay("monday", "Thứ 2")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 2">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.monday && <div className="text-[11px] font-normal text-slate-500">{weekDates.monday}</div>}
                    </TableHead>
                  )}
                  {visibleDays.includes("tuesday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 3
                        {!isAccountant && isDayClearable("tuesday") && (
                          <button onClick={() => clearDay("tuesday", "Thứ 3")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 3">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.tuesday && <div className="text-[11px] font-normal text-slate-500">{weekDates.tuesday}</div>}
                    </TableHead>
                  )}
                  {visibleDays.includes("wednesday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 4
                        {!isAccountant && isDayClearable("wednesday") && (
                          <button onClick={() => clearDay("wednesday", "Thứ 4")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 4">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.wednesday && <div className="text-[11px] font-normal text-slate-500">{weekDates.wednesday}</div>}
                    </TableHead>
                  )}
                  {visibleDays.includes("thursday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 5
                        {!isAccountant && isDayClearable("thursday") && (
                          <button onClick={() => clearDay("thursday", "Thứ 5")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 5">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.thursday && <div className="text-[11px] font-normal text-slate-500">{weekDates.thursday}</div>}
                    </TableHead>
                  )}
                  {visibleDays.includes("friday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 6
                        {!isAccountant && isDayClearable("friday") && (
                          <button onClick={() => clearDay("friday", "Thứ 6")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 6">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.friday && <div className="text-[11px] font-normal text-slate-500">{weekDates.friday}</div>}
                    </TableHead>
                  )}
                  {visibleDays.includes("saturday") && (
                    <TableHead className="text-center group">
                      <div className="flex items-center justify-center gap-1">
                        Thứ 7
                        {!isAccountant && isDayClearable("saturday") && (
                          <button onClick={() => clearDay("saturday", "Thứ 7")} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Xóa toàn bộ Thứ 7">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {weekDates.saturday && <div className="text-[11px] font-normal text-slate-500">{weekDates.saturday}</div>}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length > 0 && (
                  <TableRow className="bg-blue-50/80 border-b-2 border-blue-200">
                    <TableCell className="font-bold text-blue-900 text-xs">Tổng suất</TableCell>
                    <TableCell className="text-center font-black text-blue-700">
                      {schedules.reduce((sum, s) => sum + s.totalBoarding, 0)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500">
                      {schedules.reduce((sum, s) => sum + s.maleBoarding, 0)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500">
                      {schedules.reduce((sum, s) => sum + s.femaleBoarding, 0)}
                    </TableCell>
                    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const)
                      .filter(day => visibleDays.includes(day))
                      .map(day => (
                        <TableCell key={day} className="text-center font-black text-blue-700 text-sm">
                          {getDayTotal(day)}
                        </TableCell>
                      ))}
                  </TableRow>
                )}
                {displaySchedules.map((s) => (
                  <TableRow key={s.classId}>
                    <TableCell className="font-medium">{s.className}</TableCell>
                    <TableCell className="text-center font-bold text-blue-700">{s.totalBoarding}</TableCell>
                    <TableCell className="text-center text-slate-600">{s.maleBoarding}</TableCell>
                    <TableCell className="text-center text-slate-600">{s.femaleBoarding}</TableCell>
                    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const)
                      .filter(day => visibleDays.includes(day))
                      .map(
                        (day) => (
                          <TableCell
                            key={day}
                            className={`text-center ${isAccountant ? "cursor-default" : "cursor-pointer"}`}
                            onClick={() => !isAccountant && toggleDay(s.classId, day)}
                          >
                            {dayLabel(s[day])}
                          </TableCell>
                        )
                      )}
                  </TableRow>
                ))}
                {schedules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4 + visibleDays.length} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <p className="text-gray-500 font-medium">Tuần này chưa có Thời khóa biểu Bán trú.</p>
                        {!isAccountant && (
                          <Button onClick={createNewSchedule} className="bg-blue-600 hover:bg-blue-700">
                            <CalendarDays className="h-4 w-4 mr-2" />
                            Tạo thời khóa biểu mới
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray-500 mt-3">
            {!isAccountant
              ? "💡 Bấm vào ô Trống/Tiết 4/Tiết 5 để chuyển đổi lịch ra về. Sau khi chỉnh sửa xong, bấm Lưu TKB."
              : "💡 Bạn đang ở chế độ xem thời khóa biểu (Kế toán)."}
          </p>
        </CardContent>
      </Card>

      {/* Dialog Quản lý Lịch Ăn Đặc Biệt */}
      <Dialog open={isSpecialModalOpen} onOpenChange={setIsSpecialModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between pr-6">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Danh Sách Lịch Ăn Đặc Biệt
                </DialogTitle>
                <DialogDescription>
                  {specialAllWeeks
                    ? "Hiển thị toàn bộ lịch ăn đặc biệt của tất cả các tuần"
                    : `Lịch ăn đặc biệt trong Tuần ${currentWeek} / ${currentYear} (${getWeekDateRange(weekString)})`}
                </DialogDescription>
              </div>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 font-semibold px-3 py-1 text-xs">
                {specialAllWeeks
                  ? `Tổng: ${specialMeals.length} suất (Tất cả tuần)`
                  : `Tuần ${currentWeek}: ${specialMeals.length} suất ${specialTotalAllWeeksCount > 0 ? `(Toàn trường: ${specialTotalAllWeeksCount})` : ""}`}
              </Badge>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm học sinh, lớp, mã bán trú..."
                  value={specialSearchTerm}
                  onChange={(e) => setSpecialSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-500" />
                <select
                  value={specialFilterDate}
                  onChange={(e) => setSpecialFilterDate(e.target.value)}
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm dark:bg-slate-900 dark:border-slate-800"
                >
                  <option value="ALL">Tất cả ngày {availableDates.length > 0 ? `(${availableDates.length} ngày)` : ""}</option>
                  {availableDates.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.dayOfWeekName} - {d.displayDate} ({d.count} suất)
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Name Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={specialFilterSchedule}
                  onChange={(e) => setSpecialFilterSchedule(e.target.value)}
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm dark:bg-slate-900 dark:border-slate-800"
                >
                  <option value="ALL">Tất cả lịch ({specialScheduleNames.length})</option>
                  {specialScheduleNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Current Week vs All Weeks */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant={specialAllWeeks ? "outline" : "default"}
                  onClick={() => setSpecialAllWeeks(false)}
                  className={`h-9 text-xs font-semibold ${!specialAllWeeks ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}`}
                >
                  Tuần hiện tại ({currentWeek})
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={specialAllWeeks ? "default" : "outline"}
                  onClick={() => setSpecialAllWeeks(true)}
                  className={`h-9 text-xs font-semibold ${specialAllWeeks ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}
                >
                  Tất cả các tuần {specialTotalAllWeeksCount > 0 ? `(${specialTotalAllWeeksCount})` : ""}
                </Button>
              </div>

              {/* Nút Thêm học sinh vào lịch */}
              {!isAccountant && (
                <Button
                  size="sm"
                  type="button"
                  onClick={openAddSpecialModal}
                  className="h-9 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Thêm học sinh vào lịch
                </Button>
              )}

              {/* Bulk delete buttons */}
              {!isAccountant && (
                <>
                  {specialFilterSchedule !== "ALL" ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => handleDeleteBulkSpecialMeals(specialFilterSchedule, specialAllWeeks)}
                      className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {specialAllWeeks
                        ? `Xóa sạch lịch "${specialFilterSchedule}" (Tất cả tuần)`
                        : `Xóa lịch "${specialFilterSchedule}" tuần ${currentWeek}`}
                    </Button>
                  ) : (
                    (specialMeals.length > 0 || specialTotalAllWeeksCount > 0) && (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteBulkSpecialMeals("ALL", true)}
                        className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Xóa sạch tất cả lịch ({specialTotalAllWeeksCount || specialMeals.length} suất)
                      </Button>
                    )
                  )}
                </>
              )}
            </div>
          </DialogHeader>

          {/* Table container */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {specialLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
                <p className="text-sm">Đang tải danh sách lịch đặc biệt...</p>
              </div>
            ) : (() => {
              const filtered = specialMeals.filter((sm) => {
                if (specialFilterSchedule !== "ALL" && sm.scheduleName !== specialFilterSchedule) return false;
                if (specialFilterDate !== "ALL" && sm.dateStr !== specialFilterDate) return false;
                if (!specialSearchTerm.trim()) return true;
                const term = specialSearchTerm.toLowerCase().trim();
                const termNoTone = removeVietnameseTones(term);
                return (
                  sm.fullName.toLowerCase().includes(term) ||
                  removeVietnameseTones(sm.fullName).toLowerCase().includes(termNoTone) ||
                  sm.className.toLowerCase().includes(term) ||
                  sm.boardingCode.toLowerCase().includes(term) ||
                  sm.studentCode.toLowerCase().includes(term) ||
                  sm.scheduleName.toLowerCase().includes(term) ||
                  sm.displayDate.includes(term) ||
                  sm.dateStr.includes(term) ||
                  sm.dayOfWeekName.toLowerCase().includes(term) ||
                  removeVietnameseTones(sm.dayOfWeekName).toLowerCase().includes(termNoTone)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                    <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3 shadow-inner">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Không tìm thấy lịch ăn đặc biệt nào
                    </p>

                    {!specialAllWeeks && specialTotalAllWeeksCount > 0 ? (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3 text-left w-full">
                        <div className="flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                          <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold mb-1 text-sm">
                              Tuần {currentWeek} hiện tại chưa có lịch!
                            </p>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                              File Excel của bạn được xếp vào các tuần khác (VD: Tuần 1, 2, 3, 4...). Hệ thống đang có <strong>{specialTotalAllWeeksCount} suất ăn đặc biệt</strong> đã lưu.
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => setSpecialAllWeeks(true)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 shadow-sm"
                        >
                          👉 Bấm để xem Tất cả các tuần ({specialTotalAllWeeksCount} suất)
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 space-y-2">
                        <p>
                          {specialMeals.length === 0
                            ? "Chưa có suất ăn đặc biệt nào trong hệ thống."
                            : "Không có kết quả khớp với từ khóa tìm kiếm hoặc bộ lọc."}
                        </p>
                        {specialMeals.length === 0 && (
                          <p className="text-slate-400 italic">
                            * Lưu ý: Tại trang Import Excel, sau khi bấm "Xem trước (Preview)", bạn cần nhấn tiếp nút <strong>"Thực hiện Import" (màu xanh lá)</strong> để dữ liệu được lưu vào cơ sở dữ liệu.
                          </p>
                        )}
                      </div>
                    )}

                    {!isAccountant && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-5 border-slate-300 text-slate-700 hover:bg-slate-50"
                        asChild
                      >
                        <a href="/admin/import">
                          <ExternalLink className="h-4 w-4 mr-1.5" />
                          Đi tới trang Import Excel
                        </a>
                      </Button>
                    )}
                  </div>
                );
              }

              const isAllFilteredSelected = filtered.length > 0 && filtered.every((sm) => selectedMealIds.has(sm.id));

              return (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  {/* Bulk action toolbar if items selected */}
                  {!isAccountant && selectedMealIds.size > 0 && (
                    <div className="bg-purple-50 dark:bg-purple-950/60 border-b border-purple-200 dark:border-purple-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 font-medium text-purple-900 dark:text-purple-200">
                        <Check className="h-4 w-4 text-purple-600" />
                        <span>Đã chọn <strong>{selectedMealIds.size}</strong> / {filtered.length} suất ăn</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-normal mr-1">Chuyển hàng loạt sang:</span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={isBulkUpdatingShift}
                          onClick={() => handleBulkUpdateShift("TIET_4")}
                          className="h-7 px-2.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-medium cursor-pointer"
                        >
                          {isBulkUpdatingShift ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Tiết 4
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          disabled={isBulkUpdatingShift}
                          onClick={() => handleBulkUpdateShift("TIET_5")}
                          className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
                        >
                          {isBulkUpdatingShift ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Tiết 5
                        </Button>
                        <div className="h-4 w-[1px] bg-purple-200 dark:bg-purple-700 mx-1" />
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={handleBulkDeleteSelected}
                          className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Xóa {selectedMealIds.size} suất
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedMealIds(new Set())}
                          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Bỏ chọn
                        </Button>
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                        {!isAccountant && (
                          <TableHead className="w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isAllFilteredSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMealIds(new Set(filtered.map((sm) => sm.id)));
                                } else {
                                  setSelectedMealIds(new Set());
                                }
                              }}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer h-4 w-4 align-middle"
                              title="Chọn tất cả học sinh đang hiển thị"
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead className="w-28 text-center font-semibold">Mã Bán Trú</TableHead>
                        <TableHead className="font-semibold">Họ và tên</TableHead>
                        <TableHead className="w-24 text-center font-semibold">Lớp gốc</TableHead>
                        <TableHead className="w-32 text-center font-semibold">Tên Lịch</TableHead>
                        <TableHead className="w-36 text-center font-semibold">Ngày ăn</TableHead>
                        <TableHead className="w-28 text-center font-semibold">
                          Ca ăn
                          {!isAccountant && <span className="block text-[10px] font-normal text-slate-400">(Bấm để đổi)</span>}
                        </TableHead>
                        {!isAccountant && <TableHead className="w-16 text-center">Xóa</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((sm, index) => {
                        const isSelected = selectedMealIds.has(sm.id);
                        return (
                          <TableRow
                            key={sm.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/50 ${
                              isSelected ? "bg-purple-50/50 dark:bg-purple-950/20" : ""
                            }`}
                          >
                            {!isAccountant && (
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedMealIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(sm.id)) {
                                        next.delete(sm.id);
                                      } else {
                                        next.add(sm.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer h-4 w-4 align-middle"
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-center font-mono text-xs text-slate-500">{index + 1}</TableCell>
                            <TableCell className="text-center font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                              {sm.boardingCode}
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                              {sm.fullName}
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300">
                              {sm.className}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 font-semibold text-xs">
                                {sm.scheduleName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{sm.dayOfWeekName}</div>
                              <div className="text-[11px] text-slate-500">{sm.displayDate}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              {isAccountant ? (
                                sm.shift === "TIET_4" ? (
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Tiết 4</Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Tiết 5</Badge>
                                )
                              ) : (
                                <button
                                  type="button"
                                  disabled={updatingShiftId === sm.id}
                                  onClick={() => handleToggleShift(sm)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-150 select-none shadow-xs hover:scale-105 active:scale-95 border ${
                                    sm.shift === "TIET_4"
                                      ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800"
                                      : "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                                  }`}
                                  title="Bấm vào đây để chuyển đổi giữa Tiết 4 và Tiết 5"
                                >
                                  {updatingShiftId === sm.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  )}
                                  <span>{sm.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}</span>
                                </button>
                              )}
                            </TableCell>
                            {!isAccountant && (
                              <TableCell className="text-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteSpecialMeal(sm.id, sm.fullName, sm.displayDate)}
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                  title="Xóa suất ăn này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </div>

          {/* Dialog Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              * Suất ăn đặc biệt sẽ được ghép thành "Lớp ảo" khi phân bổ sân ăn tại mục <strong>Chia sân ăn</strong>.
            </div>
            <div className="flex items-center gap-2">
              {!isAccountant && (
                <Button variant="outline" size="sm" asChild>
                  <a href="/admin/import" className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Import thêm lịch</span>
                  </a>
                </Button>
              )}
              <Button size="sm" variant="default" onClick={() => setIsSpecialModalOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Thêm Học Sinh Vào Lịch Ăn Đặc Biệt */}
      <Dialog open={isAddSpecialModalOpen} onOpenChange={setIsAddSpecialModalOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-purple-200 dark:border-purple-900">
          <DialogHeader className="p-5 pb-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                  Thêm Học Sinh Vào Lịch Ăn Đặc Biệt
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Cấu hình lịch ăn, chọn tuần trực quan trên lịch, phân ca riêng từng tuần, chọn học sinh bán trú hoặc import từ file Excel.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold px-2.5 py-1">
                  {studentSourceTab === "MANUAL"
                    ? `${calculatedDates.length} ngày • ${addSelectedStudentIds.size} học sinh`
                    : excelPreviewData
                    ? `File Excel: ${excelPreviewData.length} học sinh`
                    : "Chế độ Import Excel"}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Content Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 1. Tên lịch ăn đặc biệt & Chế độ */}
            <div className="bg-slate-50/60 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Tên lịch ăn đặc biệt <span className="text-red-500">*</span>
                </Label>
                {/* Chế độ: Tạo lịch mới vs Chọn lịch có sẵn */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setAddScheduleMode("NEW");
                      setAddScheduleName("");
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      addScheduleMode === "NEW"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    ✨ Tạo lịch mới
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddScheduleMode("EXISTING");
                      if (specialScheduleNames.length > 0 && !specialScheduleNames.includes(addScheduleName)) {
                        setAddScheduleName(specialScheduleNames[0]);
                      }
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      addScheduleMode === "EXISTING"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    📂 Nhập vào lịch có sẵn ({specialScheduleNames.length})
                  </button>
                </div>
              </div>

              {addScheduleMode === "NEW" ? (
                <div>
                  <Input
                    placeholder="Nhập tên lịch mới (VD: NN2 Tiếng Hàn K10, GDQP K11, Bồi dưỡng HSG...)"
                    value={addScheduleName}
                    onChange={(e) => setAddScheduleName(e.target.value)}
                    className="h-9 text-sm bg-white dark:bg-slate-900"
                  />
                  {specialScheduleNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="text-[11px] text-slate-400">Gợi ý từ lịch có sẵn:</span>
                      {specialScheduleNames.slice(0, 5).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setAddScheduleName(name)}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300 cursor-pointer"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {specialScheduleNames.length > 0 ? (
                    <select
                      value={addScheduleName}
                      onChange={(e) => setAddScheduleName(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm dark:bg-slate-900 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-100"
                    >
                      {specialScheduleNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      Chưa có lịch ăn đặc biệt nào trước đây. Vui lòng chọn "Tạo lịch mới" ở trên để nhập tên lịch.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Chọn Ngày Học / Ngày Ăn & Lịch Tuần & Ca ăn từng tuần */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  Chọn Ngày Học & Ca Ăn Áp Dụng
                </Label>
                <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setAddDateTab("WEEK_DAY")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      addDateTab === "WEEK_DAY"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    🌟 Theo Thứ & Bộ Chọn Tuần Trên Lịch
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddDateTab("SPECIFIC")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      addDateTab === "SPECIFIC"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    📅 Chọn ngày cụ thể
                  </button>
                </div>
              </div>

              {addDateTab === "WEEK_DAY" ? (
                <div className="space-y-3 pt-1">
                  {/* Chọn Thứ trong tuần */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                      Chọn Thứ trong tuần:
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[
                        { day: 1, label: "Thứ 2" },
                        { day: 2, label: "Thứ 3" },
                        { day: 3, label: "Thứ 4" },
                        { day: 4, label: "Thứ 5" },
                        { day: 5, label: "Thứ 6" },
                        { day: 6, label: "Thứ 7" },
                      ].map(({ day, label }) => {
                        const isSelected = addSelectedDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (addSelectedDays.length > 1) {
                                  setAddSelectedDays(addSelectedDays.filter((d) => d !== day));
                                }
                              } else {
                                setAddSelectedDays([...addSelectedDays, day]);
                              }
                            }}
                            className={`h-8 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50 hover:border-purple-300"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BỘ CHỌN TUẦN TRÊN LỊCH (Calendar Week Grid & Per-Week Shift) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                        Chọn các tuần trên lịch & phân ca ăn (Tiết 4 / Tiết 5) cho từng tuần:
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            if (availableCalendarWeeks.length > 0) {
                              const curr = availableCalendarWeeks[0].isoWeek;
                              setAddSelectedWeeks([curr]);
                              if (!addWeekShifts[curr]) setAddWeekShifts((prev) => ({ ...prev, [curr]: addShift }));
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer font-medium"
                        >
                          Tuần hiện tại
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next4 = availableCalendarWeeks.slice(0, 4).map((w) => w.isoWeek);
                            setAddSelectedWeeks(next4);
                            const newShifts = { ...addWeekShifts };
                            next4.forEach((w) => {
                              if (!newShifts[w]) newShifts[w] = addShift;
                            });
                            setAddWeekShifts(newShifts);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          4 tuần tới
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next8 = availableCalendarWeeks.slice(0, 8).map((w) => w.isoWeek);
                            setAddSelectedWeeks(next8);
                            const newShifts = { ...addWeekShifts };
                            next8.forEach((w) => {
                              if (!newShifts[w]) newShifts[w] = addShift;
                            });
                            setAddWeekShifts(newShifts);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          8 tuần tới
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const allW = availableCalendarWeeks.map((w) => w.isoWeek);
                            setAddSelectedWeeks(allW);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          Chọn hết
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddSelectedWeeks([])}
                          className="px-2 py-0.5 rounded text-red-500 hover:underline cursor-pointer"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    {/* Thanh đồng bộ nhanh ca ăn cho tất cả các tuần */}
                    {addSelectedWeeks.length > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 text-[11px]">
                        <span className="text-purple-800 dark:text-purple-300 font-medium">
                          ⚡ Đã chọn <strong>{addSelectedWeeks.length} tuần</strong> trên lịch. Đồng bộ nhanh ca ăn:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const newShifts = { ...addWeekShifts };
                              addSelectedWeeks.forEach((w) => {
                                newShifts[w] = "TIET_4";
                              });
                              setAddWeekShifts(newShifts);
                              setAddShift("TIET_4");
                            }}
                            className="px-2 py-0.5 rounded border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 font-semibold cursor-pointer"
                          >
                            Set tất cả Tiết 4
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newShifts = { ...addWeekShifts };
                              addSelectedWeeks.forEach((w) => {
                                newShifts[w] = "TIET_5";
                              });
                              setAddWeekShifts(newShifts);
                              setAddShift("TIET_5");
                            }}
                            className="px-2 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                          >
                            Set tất cả Tiết 5
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bảng danh sách tuần trên lịch */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-52 overflow-y-auto bg-white dark:bg-slate-900 shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 z-10 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2 w-10 text-center">Chọn</th>
                            <th className="p-2 w-44">Tuần & Khoảng thời gian</th>
                            <th className="p-2">Ngày học theo Thứ đã chọn</th>
                            <th className="p-2 w-52 text-center">Ca ăn của tuần</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {availableCalendarWeeks.map((w) => {
                            const isSelected = addSelectedWeeks.includes(w.isoWeek);
                            const shift = addWeekShifts[w.isoWeek] || addShift;
                            const datesSummary = addSelectedDays
                              .map((d) => w.dateByDay[d]?.display)
                              .filter(Boolean)
                              .join(", ");

                            return (
                              <tr
                                key={w.isoWeek}
                                className={`transition-colors ${
                                  isSelected
                                    ? "bg-purple-50/50 dark:bg-purple-950/20"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500"
                                }`}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      if (isSelected) {
                                        setAddSelectedWeeks(addSelectedWeeks.filter((x) => x !== w.isoWeek));
                                      } else {
                                        setAddSelectedWeeks([...addSelectedWeeks, w.isoWeek]);
                                        if (!addWeekShifts[w.isoWeek]) {
                                          setAddWeekShifts((prev) => ({ ...prev, [w.isoWeek]: addShift }));
                                        }
                                      }
                                    }}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    Tuần {w.schoolWeek}{" "}
                                    <span className="text-[11px] font-normal text-slate-400">
                                      (W{w.isoWeek})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">{w.rangeLabel}</div>
                                </td>
                                <td className="p-2">
                                  <div className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                    {datesSummary || "—"}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={!isSelected}
                                      onClick={() => {
                                        setAddWeekShifts((prev) => ({ ...prev, [w.isoWeek]: "TIET_4" }));
                                      }}
                                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                        !isSelected
                                          ? "opacity-30 cursor-not-allowed border-slate-200"
                                          : shift === "TIET_4"
                                          ? "bg-orange-500 text-white border-orange-500 shadow-2xs"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-orange-300"
                                      }`}
                                    >
                                      Tiết 4 (10:15)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!isSelected}
                                      onClick={() => {
                                        setAddWeekShifts((prev) => ({ ...prev, [w.isoWeek]: "TIET_5" }));
                                      }}
                                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                        !isSelected
                                          ? "opacity-30 cursor-not-allowed border-slate-200"
                                          : shift === "TIET_5"
                                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-blue-300"
                                      }`}
                                    >
                                      Tiết 5 (11:00)
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="date"
                        value={addCustomDateInput}
                        onChange={(e) => setAddCustomDateInput(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (addCustomDateInput && !addSpecificDates.includes(addCustomDateInput)) {
                          setAddSpecificDates([...addSpecificDates, addCustomDateInput].sort());
                          setAddCustomDateInput("");
                        }
                      }}
                      className="h-9 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Thêm ngày
                    </Button>
                  </div>
                </div>
              )}

              {/* Tóm tắt danh sách ngày áp dụng */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    📅 Ngày áp dụng ({calculatedDates.length} ngày):
                  </span>
                  {addDateTab === "SPECIFIC" && addSpecificDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddSpecificDates([])}
                      className="text-[11px] text-red-500 hover:underline cursor-pointer"
                    >
                      Xóa tất cả ngày
                    </button>
                  )}
                </div>
                {calculatedDates.length === 0 ? (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    ⚠️ Chưa có ngày nào được chọn. Vui lòng tích chọn ít nhất 1 Thứ và 1 Tuần trên lịch.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-white dark:bg-slate-800/80 rounded-lg border border-purple-200 dark:border-purple-900 shadow-2xs">
                    {calculatedDates.map((d, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`text-[11px] font-medium py-0.5 px-2 flex items-center gap-1.5 border ${
                          d.shift === "TIET_4"
                            ? "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300"
                            : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        <span>{d.dowName}</span>
                        <span className="font-semibold">{d.display}</span>
                        <span className="text-[10px] px-1 rounded bg-white/80 dark:bg-slate-800 font-bold">
                          {d.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Nạp danh sách học sinh (Tab Manual vs Tab Excel) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-600" />
                  Phương thức nạp danh sách học sinh:
                </Label>
                <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setStudentSourceTab("MANUAL")}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      studentSourceTab === "MANUAL"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Chọn từ danh sách bán trú
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentSourceTab("EXCEL")}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      studentSourceTab === "EXCEL"
                        ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Nhập từ file Excel hàng loạt
                  </button>
                </div>
              </div>

              {/* TAB 1: CHỌN TỪ DANH SÁCH BÁN TRÚ */}
              {studentSourceTab === "MANUAL" && (
                <div className="space-y-3">
                  {/* Nút chọn nhanh theo Khối 10, 11, 12 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                        Chọn nhanh theo khối:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectByGrade("10")}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                      >
                        🎓 Chọn hết Khối 10
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectByGrade("11")}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                      >
                        🎓 Chọn hết Khối 11
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectByGrade("12")}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                      >
                        🎓 Chọn hết Khối 12
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const newSet = new Set(addSelectedStudentIds);
                          filteredActiveStudents.forEach((s) => newSet.add(s.id));
                          setAddSelectedStudentIds(newSet);
                        }}
                        className="text-blue-600 hover:underline font-medium cursor-pointer"
                      >
                        Chọn hết danh sách ({filteredActiveStudents.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAddSelectedStudentIds(new Set())}
                        className="text-red-500 hover:underline cursor-pointer"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>

                  {/* Filter row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <select
                        value={addFilterClass}
                        onChange={(e) => setAddFilterClass(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-xs dark:bg-slate-900 dark:border-slate-800"
                      >
                        <option value="ALL">Tất cả lớp ({classList.length} lớp)</option>
                        {classList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Tìm theo tên học sinh, mã bán trú BT..., mã HS..."
                        value={addStudentSearch}
                        onChange={(e) => setAddStudentSearch(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Students Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-56 overflow-y-auto">
                    {loadingActiveStudents ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <Loader2 className="h-6 w-6 animate-spin mb-1 text-blue-600" />
                        Đang tải danh sách học sinh bán trú...
                      </div>
                    ) : filteredActiveStudents.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Không tìm thấy học sinh bán trú nào phù hợp bộ lọc.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 z-10">
                          <TableRow>
                            <th className="w-10 text-center p-2"></th>
                            <th className="w-24 text-center font-semibold text-xs p-2">Mã Bán Trú</th>
                            <th className="font-semibold text-xs p-2 text-left">Họ và tên</th>
                            <th className="w-20 text-center font-semibold text-xs p-2">Lớp</th>
                            <th className="w-24 text-center font-semibold text-xs p-2">Mã HS</th>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredActiveStudents.map((s) => {
                            const isSelected = addSelectedStudentIds.has(s.id);
                            return (
                              <TableRow
                                key={s.id}
                                onClick={() => {
                                  const newSet = new Set(addSelectedStudentIds);
                                  if (isSelected) newSet.delete(s.id);
                                  else newSet.add(s.id);
                                  setAddSelectedStudentIds(newSet);
                                }}
                                className={`cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-900/50 ${
                                  isSelected ? "bg-purple-50/60 dark:bg-purple-950/30" : ""
                                }`}
                              >
                                <TableCell className="text-center p-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold text-blue-700 dark:text-blue-400 p-2">
                                  {s.boardingCode || "—"}
                                </TableCell>
                                <TableCell className="font-medium text-xs text-slate-900 dark:text-slate-100 p-2">
                                  {s.user?.fullName}
                                </TableCell>
                                <TableCell className="text-center font-bold text-xs text-slate-700 dark:text-slate-300 p-2">
                                  {s.class?.name || s.classId}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs text-slate-500 p-2">
                                  {s.studentCode}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: NHẬP TỪ FILE EXCEL HÀNG LOẠT */}
              {studentSourceTab === "EXCEL" && (
                <div className="space-y-3.5">
                  {/* Khung hướng dẫn 3 bước */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Bước 1 */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-1">
                          <span className="h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                            1
                          </span>
                          Xuất file mẫu template
                        </div>
                        <p className="text-[11px] text-slate-500">
                          File Excel sẽ được tạo động với các cột tuần và ca ăn theo đúng cấu hình tuần bạn đã chọn ở trên.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportCustomTemplate}
                        disabled={isExportingTemplate || calculatedDates.length === 0}
                        className="w-full text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 cursor-pointer h-8"
                      >
                        {isExportingTemplate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Download className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                        )}
                        Tải file mẫu Excel (.xlsx)
                      </Button>
                    </div>

                    {/* Bước 2 */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-1">
                          <span className="h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                            2
                          </span>
                          Chọn file Excel đã điền
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Cột <strong>HỌ VÀ TÊN</strong> và <strong>LỚP</strong> là bắt buộc. Hệ thống khớp tự động theo 2 thông tin này.
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          id="special-meal-excel-input"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setExcelFile(f);
                              setExcelPreviewData(null);
                              setExcelPreviewSummary(null);
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="special-meal-excel-input"
                          className="w-full h-8 px-3 rounded border border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-400 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer truncate"
                        >
                          <Upload className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">{excelFile ? excelFile.name : "Chọn file từ máy tính"}</span>
                        </label>
                      </div>
                    </div>

                    {/* Bước 3 */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-1">
                          <span className="h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                            3
                          </span>
                          Kiểm tra trước khi import
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Đối soát danh sách bán trú và cảnh báo nếu trùng TKB thường niên của lớp.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handlePreviewExcel}
                        disabled={isExcelPreviewing || !excelFile}
                        className="w-full text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer h-8"
                      >
                        {isExcelPreviewing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Search className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Kiểm tra file (Preview)
                      </Button>
                    </div>
                  </div>

                  {/* BẢNG XEM TRƯỚC (PREVIEW TABLE & XỬ LÝ TRÙNG TKB THƯỜNG NIÊN) */}
                  {excelPreviewData && (
                    <div className="space-y-2.5 pt-1">
                      {/* Thẻ thống kê */}
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1">
                            Tổng số học sinh trong file: {excelPreviewSummary?.totalRows || excelPreviewData.length} em
                          </Badge>
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                            ✅ Hợp lệ: {excelPreviewSummary?.validCount || 0} suất
                          </Badge>
                          {(excelPreviewSummary?.conflictCount || 0) > 0 && (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold px-2.5 py-1 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ⚠️ Trùng TKB thường niên: {excelPreviewSummary?.conflictCount} suất (Ưu tiên ăn theo TKB thường niên)
                            </Badge>
                          )}
                          {(excelPreviewSummary?.skippedCount || 0) > 0 && (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1">
                              ❌ Bỏ qua / Lỗi: {excelPreviewSummary?.skippedCount} suất
                            </Badge>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 italic">
                          * Đã đối soát chéo với TKB lớp của từng học sinh
                        </span>
                      </div>

                      {/* Bảng chi tiết từng dòng preview */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-56 overflow-y-auto bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left">
                          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 z-10 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-2 w-10 text-center">STT</th>
                              <th className="p-2 w-36">Họ và tên</th>
                              <th className="p-2 w-16 text-center">Lớp</th>
                              <th className="p-2">Chi tiết các ngày đăng ký & Ca ăn</th>
                              <th className="p-2 w-72">Trạng thái & Đối soát TKB thường niên</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {excelPreviewData.map((row, rIdx) => {
                              const hasConflict = row.entries.some((e: any) => e.status === "warning_prioritize_regular");
                              const hasError = row.entries.some((e: any) => e.status === "error_no_student");

                              return (
                                <tr
                                  key={rIdx}
                                  className={`transition-colors ${
                                    hasError
                                      ? "bg-rose-50/40 dark:bg-rose-950/20"
                                      : hasConflict
                                      ? "bg-amber-50/40 dark:bg-amber-950/20"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                  }`}
                                >
                                  <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                                    {row.stt || rIdx + 1}
                                  </td>
                                  <td className="p-2 font-medium text-slate-900 dark:text-slate-100">
                                    {row.hoTen}
                                  </td>
                                  <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                    {row.maLop}
                                  </td>
                                  <td className="p-2">
                                    <div className="flex flex-wrap gap-1">
                                      {row.entries.map((entry: any, eIdx: number) => (
                                        <Badge
                                          key={eIdx}
                                          variant="outline"
                                          className={`text-[10px] py-0 px-1.5 ${
                                            entry.status === "warning_prioritize_regular"
                                              ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                                              : entry.shift === "TIET_4"
                                              ? "bg-orange-50 text-orange-800 border-orange-200"
                                              : "bg-blue-50 text-blue-800 border-blue-200"
                                          }`}
                                        >
                                          Tuần {entry.schoolWeekNumber || entry.weekNumber}: {entry.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"}
                                        </Badge>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    {row.entries.map((entry: any, eIdx: number) => {
                                      if (entry.status === "warning_prioritize_regular") {
                                        return (
                                          <div key={eIdx} className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-start gap-1">
                                            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                                            <span>{entry.note}</span>
                                          </div>
                                        );
                                      }
                                      if (entry.status === "error_no_student") {
                                        return (
                                          <div key={eIdx} className="text-[11px] text-rose-600 font-medium">
                                            ❌ {entry.note}
                                          </div>
                                        );
                                      }
                                      if (entry.status === "skip_duplicate") {
                                        return (
                                          <div key={eIdx} className="text-[11px] text-slate-500">
                                            ℹ️ {entry.note}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={eIdx} className="text-[11px] text-emerald-600 font-medium">
                                          ✅ Hợp lệ ({entry.shift === "TIET_4" ? "Tiết 4" : "Tiết 5"})
                                        </div>
                                      );
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {studentSourceTab === "MANUAL" ? (
                <>
                  Tổng cộng sẽ tạo:{" "}
                  <strong className="text-purple-700 dark:text-purple-300 font-bold">
                    {addSelectedStudentIds.size * calculatedDates.length} suất ăn
                  </strong>{" "}
                  ({addSelectedStudentIds.size} HS × {calculatedDates.length} ngày)
                </>
              ) : excelPreviewData ? (
                <>
                  Sẵn sàng import:{" "}
                  <strong className="text-purple-700 dark:text-purple-300 font-bold">
                    {(excelPreviewSummary?.validCount || 0) + (excelPreviewSummary?.conflictCount || 0)} suất ăn
                  </strong>{" "}
                  ({excelPreviewData.length} học sinh từ file Excel)
                </>
              ) : (
                "Vui lòng chọn file và bấm 'Kiểm tra file (Preview)' trước khi lưu."
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddSpecialModalOpen(false)}
                disabled={isSavingSpecialMeal || isExcelImporting}
                className="h-9 text-xs"
              >
                Hủy
              </Button>

              {studentSourceTab === "MANUAL" ? (
                <Button
                  type="button"
                  onClick={handleSaveAddSpecialMeals}
                  disabled={
                    isSavingSpecialMeal ||
                    !addScheduleName.trim() ||
                    calculatedDates.length === 0 ||
                    addSelectedStudentIds.size === 0
                  }
                  className="h-9 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isSavingSpecialMeal ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      Lưu vào lịch ăn ({addSelectedStudentIds.size * calculatedDates.length} suất)
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleImportExcel}
                  disabled={
                    isExcelImporting ||
                    !excelFile ||
                    !excelPreviewData ||
                    ((excelPreviewSummary?.validCount || 0) + (excelPreviewSummary?.conflictCount || 0) === 0)
                  }
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isExcelImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Đang import...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4 mr-1.5" />
                      Xác nhận Import Excel ({ (excelPreviewSummary?.validCount || 0) + (excelPreviewSummary?.conflictCount || 0) } suất)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
