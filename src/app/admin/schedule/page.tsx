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
import { CalendarDays, Save, Loader2, Copy, CheckCircle } from "lucide-react";
import { format, parse, startOfWeek, endOfWeek } from "date-fns";

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
        const result = await Swal.fire({
          title: "Tạo thời khóa biểu mới?",
          text: `Tuần ${weekNumber}/${year} chưa có TKB. Bạn có muốn tạo khung TKB mới (tự động tải số HS bán trú) không?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Có, tạo mới",
          cancelButtonText: "Không",
        });

        if (result.isConfirmed) {
          setSchedules(data.data);
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules(data.data);
      }
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải thời khóa biểu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [weekString]);

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

  const currentYear = weekString ? weekString.split("-W")[0] : new Date().getFullYear();
  const currentWeek = weekString ? weekString.split("-W")[1] : 1;

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
              <Button onClick={saveSchedules} disabled={saving} className="h-10">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : saved ? (
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {saved ? "Đã lưu!" : "Lưu TKB"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bảng TKB */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lịch ăn bán trú - Tuần {currentWeek} / {currentYear}
          </CardTitle>
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
                  <TableHead className="text-center">Thứ 2</TableHead>
                  <TableHead className="text-center">Thứ 3</TableHead>
                  <TableHead className="text-center">Thứ 4</TableHead>
                  <TableHead className="text-center">Thứ 5</TableHead>
                  <TableHead className="text-center">Thứ 6</TableHead>
                  <TableHead className="text-center">Thứ 7</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.classId}>
                    <TableCell className="font-medium">{s.className}</TableCell>
                    <TableCell className="text-center font-bold text-blue-700">{s.totalBoarding}</TableCell>
                    <TableCell className="text-center text-slate-600">{s.maleBoarding}</TableCell>
                    <TableCell className="text-center text-slate-600">{s.femaleBoarding}</TableCell>
                    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const).map(
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
                    <TableCell colSpan={10} className="text-center py-8 text-gray-400">
                      Chưa có dữ liệu TKB. Bấm vào ô để thiết lập lịch ăn bán trú.
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
