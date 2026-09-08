"use client";

import { useState, useEffect } from "react";
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
import { CalendarDays, Save, Loader2, Copy, CheckCircle, X, ChevronLeft, ChevronRight, Trash2, Info, Sparkles, Search, Filter, ExternalLink } from "lucide-react";
import { format, parse, startOfWeek, endOfWeek, addDays, addWeeks } from "date-fns";
import { compareClassNames } from "@/lib/utils";

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
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [specialFilterSchedule, setSpecialFilterSchedule] = useState("ALL");
  const [specialSearchTerm, setSpecialSearchTerm] = useState("");
  const [specialAllWeeks, setSpecialAllWeeks] = useState(false);
  const [specialLoading, setSpecialLoading] = useState(false);

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
      }
    } catch (e) {
      console.error("Lỗi khi tải lịch ăn đặc biệt:", e);
    } finally {
      setSpecialLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialMeals();
  }, [weekString, specialAllWeeks, specialFilterSchedule]);

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

  const handleDeleteBulkSpecialMeals = async (schedName: string) => {
    if (isAccountant) return;
    const [y, w] = weekString.split("-W").map(Number);
    const year = y || new Date().getFullYear();
    const weekNumber = w || 1;

    const result = await Swal.fire({
      title: `Xóa toàn bộ lịch "${schedName}"?`,
      text: `Bạn có chắc muốn xóa tất cả suất ăn của lịch "${schedName}" trong Tuần ${weekNumber}/${year}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận xóa hết",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(
          `/api/schedule/special-meals?scheduleName=${encodeURIComponent(schedName)}&year=${year}&weekNumber=${weekNumber}`,
          { method: "DELETE" }
        );
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
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 font-semibold px-3 py-1">
                Tổng: {specialMeals.filter((sm) => {
                  if (!specialSearchTerm.trim()) return true;
                  const term = specialSearchTerm.toLowerCase();
                  return (
                    sm.fullName.toLowerCase().includes(term) ||
                    sm.className.toLowerCase().includes(term) ||
                    sm.boardingCode.toLowerCase().includes(term) ||
                    sm.studentCode.toLowerCase().includes(term) ||
                    sm.scheduleName.toLowerCase().includes(term)
                  );
                }).length} suất
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
                  className="h-9 text-xs font-semibold"
                >
                  Tuần hiện tại
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={specialAllWeeks ? "default" : "outline"}
                  onClick={() => setSpecialAllWeeks(true)}
                  className="h-9 text-xs font-semibold"
                >
                  Tất cả các tuần
                </Button>
              </div>

              {/* Bulk delete button if specific schedule selected */}
              {!isAccountant && specialFilterSchedule !== "ALL" && !specialAllWeeks && (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteBulkSpecialMeals(specialFilterSchedule)}
                  className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Xóa lịch "{specialFilterSchedule}" tuần này
                </Button>
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
                if (!specialSearchTerm.trim()) return true;
                const term = specialSearchTerm.toLowerCase();
                return (
                  sm.fullName.toLowerCase().includes(term) ||
                  sm.className.toLowerCase().includes(term) ||
                  sm.boardingCode.toLowerCase().includes(term) ||
                  sm.studentCode.toLowerCase().includes(term) ||
                  sm.scheduleName.toLowerCase().includes(term)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                      Không tìm thấy lịch ăn đặc biệt nào
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {specialMeals.length === 0
                        ? "Tuần này chưa có học sinh nào được import lịch ăn đặc biệt (ngoại ngữ, GDQP...)."
                        : "Không có kết quả khớp với từ khóa tìm kiếm hoặc bộ lọc."}
                    </p>
                    {!isAccountant && (
                      <Button
                        size="sm"
                        className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
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

              return (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead className="w-28 text-center font-semibold">Mã Bán Trú</TableHead>
                        <TableHead className="font-semibold">Họ và tên</TableHead>
                        <TableHead className="w-24 text-center font-semibold">Lớp gốc</TableHead>
                        <TableHead className="w-32 text-center font-semibold">Tên Lịch</TableHead>
                        <TableHead className="w-36 text-center font-semibold">Ngày ăn</TableHead>
                        <TableHead className="w-24 text-center font-semibold">Ca ăn</TableHead>
                        {!isAccountant && <TableHead className="w-16 text-center">Xóa</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((sm, index) => (
                        <TableRow key={sm.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
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
                            {sm.shift === "TIET_4" ? (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Tiết 4</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Tiết 5</Badge>
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
                      ))}
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
    </div>
  );
}
