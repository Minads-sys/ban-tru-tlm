"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Save, Loader2, Copy, CheckCircle, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format, parse, startOfWeek, endOfWeek, addDays, addWeeks } from "date-fns";

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
  const [weekString, setWeekString] = useState<string>(() => getCurrentWeekString());
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [draftSchedules, setDraftSchedules] = useState<ScheduleData[] | null>(null);
  const [defaultVisibleDays, setDefaultVisibleDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [visibleDays, setVisibleDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);

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
      
      if (data.isNew) {
        setSchedules([]);
        setDraftSchedules(data.data);
        setHasChanges(false);
      } else {
        setSchedules(data.data);
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-blue-600" />
        Thời khóa biểu Bán trú
      </h1>

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
              {weekString && (
                <p className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100 w-fit mt-2">
                  {getWeekDateRange(weekString)}
                </p>
              )}
            </div>
            
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
          </div>
        </CardContent>
      </Card>

      {/* Bảng TKB */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-4">
            <span>Lịch ăn bán trú - Tuần {currentWeek} / {currentYear}</span>
            {schedules.length > 0 && !loading && (
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
                        // Tự động clear dữ liệu nếu tắt cột
                        setSchedules(prev => prev.map(s => ({ ...s, [day.id]: "NONE" })));
                        setHasChanges(true);
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
                        {isDayClearable("monday") && (
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
                        {isDayClearable("tuesday") && (
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
                        {isDayClearable("wednesday") && (
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
                        {isDayClearable("thursday") && (
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
                        {isDayClearable("friday") && (
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
                        {isDayClearable("saturday") && (
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
                {schedules.map((s) => (
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
                            className="text-center"
                            onClick={() => toggleDay(s.classId, day)}
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
                        <Button onClick={createNewSchedule} className="bg-blue-600 hover:bg-blue-700">
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Tạo thời khóa biểu mới
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-gray-500 mt-3">
            💡 Bấm vào ô Trống/Tiết 4/Tiết 5 để chuyển đổi lịch ra về. Sau khi chỉnh sửa xong, bấm Lưu TKB.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
