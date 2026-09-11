"use client";

import React, { useState } from "react";
import { Plus, Edit2, Trash2, Check, X, Shield } from "lucide-react";
import { toast } from "@/lib/toast";

interface BranchItem {
  id: string;
  code: string;
  name: string;
  color: string;
  address?: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface BranchManagerProps {
  branches: BranchItem[];
  onRefresh: () => Promise<void>;
  userRole?: string;
}

export function BranchManager({ branches, onRefresh, userRole }: BranchManagerProps) {
  const [editingBranch, setEditingBranch] = useState<Partial<BranchItem> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch?.name || !editingBranch?.code) {
      toast.error("Vui lòng điền đủ mã và tên chi nhánh");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingBranch.id;
      const res = await fetch("/api/central-kitchen/branches", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingBranch),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu chi nhánh");

      toast.success(isEdit ? "Cập nhật chi nhánh thành công" : "Thêm chi nhánh mới thành công");
      setEditingBranch(null);
      setIsCreating(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (branch: BranchItem) => {
    try {
      const res = await fetch("/api/central-kitchen/branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: branch.id, isActive: !branch.isActive }),
      });
      if (!res.ok) throw new Error("Lỗi thay đổi trạng thái");

      toast.success(`Đã ${branch.isActive ? "ẩn" : "kích hoạt"} chi nhánh ${branch.name}`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Quản Lý Danh Sách Chi Nhánh
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cấu hình mã, tên, mã màu hiển thị và thứ tự sắp xếp của các chi nhánh trường học
          </p>
        </div>

        {userRole === "ADMIN" && (
          <button
            onClick={() => {
              setEditingBranch({
                code: "",
                name: "",
                color: "#2563eb",
                sortOrder: branches.length + 1,
                isActive: true,
              });
              setIsCreating(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            Thêm chi nhánh
          </button>
        )}
      </div>

      {/* BRANCHES LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((b) => (
          <div
            key={b.id}
            className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 transition ${
              b.isActive
                ? "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                : "bg-slate-100/50 dark:bg-slate-800/20 border-dashed border-slate-300 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow"
                style={{ backgroundColor: b.color }}
              >
                {b.code}
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  {b.name}
                  {!b.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                      Ngừng hoạt động
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  Thứ tự: {b.sortOrder} • Mã màu: {b.color}
                </div>
              </div>
            </div>

            {userRole === "ADMIN" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingBranch(b);
                    setIsCreating(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(b)}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                    b.isActive
                      ? "hover:bg-red-100 text-red-600"
                      : "hover:bg-emerald-100 text-emerald-600"
                  }`}
                  title={b.isActive ? "Tạm ngưng" : "Kích hoạt lại"}
                >
                  {b.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* EDIT / CREATE MODAL */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              {isCreating ? "Thêm Chi Nhánh Mới" : "Chỉnh Sửa Chi Nhánh"}
            </h4>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mã chi nhánh (Viết tắt):
                </label>
                <input
                  type="text"
                  required
                  value={editingBranch.code || ""}
                  onChange={(e) =>
                    setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })
                  }
                  placeholder="VD: GD, HHT, TD, TLM"
                  className="w-full text-sm font-bold uppercase p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên chi nhánh:
                </label>
                <input
                  type="text"
                  required
                  value={editingBranch.name || ""}
                  onChange={(e) =>
                    setEditingBranch({ ...editingBranch, name: e.target.value.toUpperCase() })
                  }
                  placeholder="VD: GIA ĐỊNH"
                  className="w-full text-sm font-bold uppercase p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Màu nhận diện:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingBranch.color || "#2563eb"}
                      onChange={(e) =>
                        setEditingBranch({ ...editingBranch, color: e.target.value })
                      }
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={editingBranch.color || "#2563eb"}
                      onChange={(e) =>
                        setEditingBranch({ ...editingBranch, color: e.target.value })
                      }
                      className="flex-1 text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thứ tự sắp xếp:
                  </label>
                  <input
                    type="number"
                    value={editingBranch.sortOrder || 1}
                    onChange={(e) =>
                      setEditingBranch({
                        ...editingBranch,
                        sortOrder: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setIsCreating(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu chi nhánh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
