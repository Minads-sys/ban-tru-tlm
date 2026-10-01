"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, Layers, AlertCircle, RefreshCw, Check } from "lucide-react";
import Swal from "sweetalert2";

export interface DishCategory {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { dishes: number };
}

interface DishCategoryManagerProps {
  onCategoriesChanged?: () => void;
}

const COMMON_ICONS = ["🥩", "🥦", "🥣", "🍚", "🍉", "🍜", "🍳", "🍗", "🐟", "🥗", "🍞", "🍱", "🥛", "🍎"];

export function DishCategoryManager({ onCategoriesChanged }: DishCategoryManagerProps) {
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog / Edit states
  const [editingCategory, setEditingCategory] = useState<DishCategory | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
  }>({
    code: "",
    name: "",
    icon: "🍱",
    sortOrder: 0,
    isActive: true,
  });
  const [saving, setSaving] = useState<boolean>(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/central-kitchen/dish-categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải nhóm món");
      setCategories(data.categories || []);
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormData({
      code: "",
      name: "",
      icon: "🍱",
      sortOrder: (categories.length + 1) * 1,
      isActive: true,
    });
  };

  const openEdit = (cat: DishCategory) => {
    setEditingCategory(cat);
    setIsCreating(false);
    setFormData({
      code: cat.code,
      name: cat.name,
      icon: cat.icon || "🍱",
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire("Lỗi", "Vui lòng nhập tên nhóm món", "error");
      return;
    }

    try {
      setSaving(true);
      if (isCreating) {
        const res = await fetch("/api/central-kitchen/dish-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tạo nhóm món");
        Swal.fire({
          icon: "success",
          title: "Thành công",
          text: `Đã tạo nhóm món "${formData.name}"`,
          timer: 1500,
          showConfirmButton: false,
        });
      } else if (editingCategory) {
        const res = await fetch(`/api/central-kitchen/dish-categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể cập nhật nhóm món");
        Swal.fire({
          icon: "success",
          title: "Thành công",
          text: `Đã cập nhật nhóm món "${formData.name}"`,
          timer: 1500,
          showConfirmButton: false,
        });
      }

      setIsCreating(false);
      setEditingCategory(null);
      await fetchCategories();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: DishCategory) => {
    const dishCount = cat._count?.dishes || 0;
    const confirm = await Swal.fire({
      title: `Xóa nhóm "${cat.name}"?`,
      text: dishCount > 0
        ? `Nhóm này đang có ${dishCount} món ăn. Các món này sẽ được chuyển thành "Chưa phân nhóm". Bạn có chắc chắn muốn xóa?`
        : "Hành động này không thể hoàn tác!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Đồng ý xóa",
      cancelButtonText: "Hủy",
    });

    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/central-kitchen/dish-categories/${cat.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xóa nhóm món");
      Swal.fire({
        icon: "success",
        title: "Đã xóa",
        text: "Xóa nhóm món thành công",
        timer: 1200,
        showConfirmButton: false,
      });
      await fetchCategories();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              Cài đặt Danh mục Nhóm món ăn
            </h3>
            <p className="text-xs text-slate-500">
              Quản lý các nhóm món (Món mặn, Món xào, Món canh, Tráng miệng...) để phân loại khi lên thực đơn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCategories}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhóm món mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* MODAL FORM TẠO / SỬA NHÓM MÓN */}
      {(isCreating || editingCategory) && (
        <div className="bg-purple-50/50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-purple-200 dark:border-purple-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-100 dark:border-slate-700">
            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">
              {isCreating ? "Thêm nhóm món ăn mới" : `Chỉnh sửa nhóm món: ${editingCategory?.name}`}
            </h4>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingCategory(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên nhóm món <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Món xào, Món canh..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mã viết tắt (Tự động hoặc tự đặt)
              </label>
              <input
                type="text"
                placeholder="VD: MON_XAO, CANH"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={!isCreating}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Icon đại diện
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-14 px-2 py-2 text-center text-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-[180px]">
                  {COMMON_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: ic })}
                      className={`text-base p-1 rounded-lg hover:bg-purple-100 transition cursor-pointer ${
                        formData.icon === ic ? "bg-purple-200 scale-110" : ""
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Thứ tự sắp xếp
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-20 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Đang lưu..." : isCreating ? "Tạo nhóm" : "Lưu"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DANH SÁCH NHÓM MÓN HIỆN CÓ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>Danh sách các nhóm món ăn ({categories.length} nhóm)</span>
          <span className="text-[11px] text-slate-400 font-normal">Thứ tự hiển thị từ trên xuống dưới khi lên thực đơn</span>
        </div>

        {loading && categories.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Đang tải danh sách nhóm món...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Chưa có nhóm món nào. Bấm "Thêm nhóm món mới" để bắt đầu.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold text-slate-400">#{idx + 1}</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-xl shadow-xs">
                    {cat.icon || "🍱"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{cat.name}</h4>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                        {cat.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Đang có <strong className="text-purple-600">{cat._count?.dishes || 0}</strong> món thuộc nhóm này • Thứ tự: {cat.sortOrder}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition cursor-pointer"
                    title="Chỉnh sửa"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition cursor-pointer"
                    title="Xóa nhóm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
