"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { School, Users, Loader2, Plus, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassData {
  id: string;
  name: string;
  teacherId: string | null;
  teacher: { fullName: string } | null;
  _count: { students: number };
}

interface TeacherData {
  id: string;
  fullName: string;
}

interface StudentData {
  id: string;
  studentCode: string;
  user: { fullName: string; username: string };
  birthDate: string | null;
  gender: string;
  boardingStatus: string;
}

const getGenderLabel = (gender: string) => {
  if (gender === "MALE") return "Nam";
  if (gender === "FEMALE") return "Nữ";
  return "Khác";
};

const getStatusBadge = (status: string) => {
  if (status === "ACTIVE") return <Badge className="bg-green-100 text-green-700 font-normal">Đang ăn</Badge>;
  if (status === "CANCELLED") return <Badge className="bg-red-100 text-red-700 font-normal">Đã hủy</Badge>;
  return <Badge variant="outline" className="font-normal">{status}</Badge>;
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);

  // Class Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    teacherId: "none",
  });
  const [saving, setSaving] = useState(false);

  // Student List Modal states
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [viewingClass, setViewingClass] = useState<ClassData | null>(null);
  const [classStudents, setClassStudents] = useState<StudentData[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      setClasses(data);
    } catch {
      Swal.fire("Lỗi", "Lỗi khi tải danh sách lớp", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await fetch("/api/teachers");
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = (cls?: ClassData) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({
        id: cls.id,
        name: cls.name,
        teacherId: cls.teacherId || "none",
      });
    } else {
      setEditingClass(null);
      setFormData({
        id: "",
        name: "",
        teacherId: "none",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name) {
      Swal.fire("Lỗi", "Vui lòng nhập Mã lớp và Tên lớp", "error");
      return;
    }

    setSaving(true);
    const payload = {
      id: formData.id,
      name: formData.name,
      teacherId: formData.teacherId === "none" ? null : formData.teacherId,
    };

    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : "/api/classes";
      const method = editingClass ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        Swal.fire("Thành công", editingClass ? "Cập nhật lớp thành công" : "Thêm lớp thành công", "success");
        closeModal();
        fetchClasses();
      } else {
        Swal.fire("Lỗi", result.error || "Có lỗi xảy ra", "error");
      }
    } catch (error) {
      Swal.fire("Lỗi", "Không thể lưu dữ liệu", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cls: ClassData) => {
    if (cls._count?.students > 0) {
      Swal.fire("Cảnh báo", "Không thể xóa lớp đang có học sinh. Vui lòng chuyển hoặc xóa học sinh trước.", "warning");
      return;
    }

    const result = await Swal.fire({
      title: "Xác nhận xóa?",
      text: `Bạn có chắc muốn xóa lớp ${cls.name} (${cls.id})? Hành động này không thể hoàn tác và sẽ xóa cả thời khóa biểu của lớp này.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Có, xóa!",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/classes/${cls.id}`, { method: "DELETE" });
        const resData = await res.json();
        if (res.ok) {
          Swal.fire("Đã xóa", "Lớp đã được xóa khỏi hệ thống.", "success");
          fetchClasses();
        } else {
          Swal.fire("Lỗi", resData.error || "Không thể xóa lớp", "error");
        }
      } catch {
        Swal.fire("Lỗi", "Lỗi khi kết nối đến máy chủ", "error");
      }
    }
  };

  const openStudentsModal = async (cls: ClassData) => {
    setViewingClass(cls);
    setIsStudentsModalOpen(true);
    setLoadingStudents(true);
    setClassStudents([]);
    
    try {
      const res = await fetch(`/api/students?classId=${cls.id}`);
      if (res.ok) {
        const data = await res.json();
        setClassStudents(data);
      } else {
        Swal.fire("Lỗi", "Không thể tải danh sách học sinh", "error");
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Lỗi", "Không thể tải danh sách học sinh", "error");
    } finally {
      setLoadingStudents(false);
    }
  };

  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <School className="h-6 w-6 text-blue-600" />
          Danh sách Lớp học
        </h1>
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Thêm Lớp
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-gray-500">Tổng lớp</p>
            <p className="text-2xl font-bold">{classes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-gray-500">Tổng học sinh</p>
            <p className="text-2xl font-bold text-blue-600">{totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-gray-500">TB HS/lớp</p>
            <p className="text-2xl font-bold text-green-600">
              {classes.length ? Math.round(totalStudents / classes.length) : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">STT</TableHead>
                  <TableHead>Mã Lớp</TableHead>
                  <TableHead>Tên Lớp</TableHead>
                  <TableHead>GVCN</TableHead>
                  <TableHead className="text-center">Sĩ số</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls, idx) => (
                  <TableRow key={cls.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-slate-600">
                        {cls.id}
                      </Badge>
                    </TableCell>
                    <TableCell 
                      className="font-medium text-blue-700 cursor-pointer hover:underline"
                      onClick={() => openStudentsModal(cls)}
                    >
                      {cls.name}
                    </TableCell>
                    <TableCell>{cls.teacher?.fullName || <span className="text-gray-400 italic">Chưa phân công</span>}</TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1 font-medium">
                        <Users className="h-4 w-4 text-gray-400" />
                        {cls._count?.students || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal(cls)}>
                          <Pencil className="h-4 w-4 mr-1" /> Sửa
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(cls)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {classes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Chưa có lớp học nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Class Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? "Sửa Lớp học" : "Thêm Lớp học"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mã Lớp <span className="text-red-500">*</span></Label>
              <Input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                disabled={!!editingClass}
                placeholder="VD: 1A, 2B, 3C..."
              />
              {!editingClass && <p className="text-xs text-gray-500">Mã lớp phải viết liền không dấu và không thể thay đổi sau khi tạo.</p>}
            </div>
            <div className="space-y-2">
              <Label>Tên Lớp <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Lớp 1A"
              />
            </div>
            <div className="space-y-2">
              <Label>Giáo viên Chủ nhiệm</Label>
              <Select
                value={formData.teacherId}
                onValueChange={(val) => setFormData({ ...formData, teacherId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giáo viên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Chưa phân công --</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingClass ? "Lưu thay đổi" : "Tạo Lớp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student List Modal */}
      <Dialog open={isStudentsModalOpen} onOpenChange={setIsStudentsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Danh sách Học sinh - {viewingClass?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto mt-4 border rounded-md">
            {loadingStudents ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                <p className="mt-2 text-sm text-gray-500">Đang tải danh sách học sinh...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[50px] font-semibold text-slate-700">STT</TableHead>
                    <TableHead className="font-semibold text-slate-700">Họ và Tên</TableHead>
                    <TableHead className="font-semibold text-slate-700">Ngày sinh</TableHead>
                    <TableHead className="font-semibold text-slate-700">Mã HS / CCCD</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Giới tính</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Trạng thái Bán trú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{s.user.fullName}</TableCell>
                      <TableCell>
                        {s.birthDate ? new Date(s.birthDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-slate-600">{s.studentCode}</TableCell>
                      <TableCell className="text-center">{getGenderLabel(s.gender)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(s.boardingStatus)}</TableCell>
                    </TableRow>
                  ))}
                  {classStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                        Lớp này chưa có dữ liệu học sinh nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsStudentsModalOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
