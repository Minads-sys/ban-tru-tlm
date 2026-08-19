"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Pencil, Trash2, Loader2, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS, PERMISSION_LABELS, ALL_PERMISSIONS } from "@/lib/permissions";

interface UserData {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  BOARDING_MANAGER: "Quản lý bán trú",
  BOARDING_STAFF: "Nhân viên bán trú",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "BOARDING_STAFF",
    permissions: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUsers(data);
    } catch {
      Swal.fire("Lỗi", "Không thể tải danh sách nhân sự", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserData) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        username: user.username,
        password: "", // Trống khi edit
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions || [],
        isActive: user.isActive,
      });
    } else {
      setEditingId(null);
      setFormData({
        username: "",
        password: "",
        fullName: "",
        role: "BOARDING_STAFF",
        permissions: [],
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (perm: string) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu dữ liệu");

      Swal.fire("Thành công", "Đã lưu thông tin nhân sự", "success");
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      Swal.fire("Lỗi", error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Xác nhận xóa?",
      text: "Bạn không thể hoàn tác hành động này!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Lỗi khi xóa");
        Swal.fire("Đã xóa", "Xóa nhân sự thành công", "success");
        fetchUsers();
      } catch {
        Swal.fire("Lỗi", "Không thể xóa nhân sự", "error");
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-blue-600" />
          Quản lý Nhân sự & Phân quyền
        </h1>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Thêm Nhân sự
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ & Tên</TableHead>
                    <TableHead>Tên đăng nhập</TableHead>
                    <TableHead>Chức vụ</TableHead>
                    <TableHead>Quyền hạn (Phụ trợ)</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.role === "ADMIN" ? (
                          <span className="text-xs text-slate-500 italic">Toàn quyền hệ thống</span>
                        ) : u.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[250px]">
                            {u.permissions.map(p => (
                              <Badge key={p} variant="secondary" className="text-[10px] bg-slate-100 font-normal text-slate-600">
                                {PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] || p}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Theo phân quyền mặc định</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Hoạt động</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Đã khóa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(u)} className="text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        Chưa có dữ liệu nhân sự
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Nhân sự" : "Thêm Nhân sự"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Họ & Tên *</Label>
                <Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="VD: Nguyễn Văn A" />
              </div>
              <div className="space-y-2">
                <Label>Tên đăng nhập *</Label>
                <Input required disabled={!!editingId} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="VD: admin_a" />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu {editingId && "(Để trống nếu không đổi)"}</Label>
                <Input required={!editingId} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Chức vụ / Vai trò chính</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Quản trị viên (Toàn quyền)</SelectItem>
                    <SelectItem value="BOARDING_MANAGER">Quản lý bán trú</SelectItem>
                    <SelectItem value="BOARDING_STAFF">Nhân viên bán trú</SelectItem>
                    <SelectItem value="TEACHER">Giáo viên</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.role !== "ADMIN" && (
              <div className="pt-4 border-t mt-4">
                <Label className="text-base font-semibold block mb-3">Phân quyền tính năng (Tùy chọn bổ sung)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ALL_PERMISSIONS.map(perm => (
                    <label key={perm} className="flex items-center gap-2 border p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded border-slate-300"
                        checked={formData.permissions.includes(perm)}
                        onChange={() => handleTogglePermission(perm)}
                      />
                      <span className="text-sm font-medium text-slate-700">{PERMISSION_LABELS[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
