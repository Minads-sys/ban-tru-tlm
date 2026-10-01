"use client";

import React, { useState, useEffect } from "react";
import {
  Utensils,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Save,
  X,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Swal from "sweetalert2";
import { DishCategory } from "./dish-category-manager";

export interface Dish {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  isActive: boolean;
  category?: DishCategory | null;
}

export function DishBankManager() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Create / Edit modal
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [autoCode, setAutoCode] = useState<boolean>(true);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    categoryId: string;
    description: string;
    isActive: boolean;
  }>({
    code: "",
    name: "",
    categoryId: "",
    description: "",
    isActive: true,
  });
  const [saving, setSaving] = useState<boolean>(false);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/central-kitchen/dish-categories");
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDishes = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/api/central-kitchen/dish-bank?";
      if (search.trim()) url += `search=${encodeURIComponent(search.trim())}&`;
      if (selectedCategory) url += `categoryId=${encodeURIComponent(selectedCategory)}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách món ăn");
      setDishes(data.dishes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDishes();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategory]);

  const openCreate = () => {
    setEditingDish(null);
    setAutoCode(true);
    setFormData({
      code: "",
      name: "",
      categoryId: categories[0]?.id || "",
      description: "",
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const openEdit = (dish: Dish) => {
    setEditingDish(dish);
    setAutoCode(false);
    setFormData({
      code: dish.code,
      name: dish.name,
      categoryId: dish.categoryId || "",
      description: dish.description || "",
      isActive: dish.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire("Lỗi", "Vui lòng nhập tên món ăn", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        code: autoCode ? "" : formData.code.trim(),
      };

      if (!editingDish) {
        // Create
        const res = await fetch("/api/central-kitchen/dish-bank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể thêm món ăn");
        Swal.fire({
          icon: "success",
          title: "Đã thêm món",
          text: `Món "${formData.name}" (Mã: ${data.dish.code}) đã vào ngân hàng món!`,
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        // Edit
        const res = await fetch(`/api/central-kitchen/dish-bank/${editingDish.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể cập nhật món ăn");
        Swal.fire({
          icon: "success",
          title: "Đã cập nhật",
          text: `Cập nhật món "${formData.name}" thành công!`,
          timer: 1400,
          showConfirmButton: false,
        });
      }

      setIsFormOpen(false);
      setEditingDish(null);
      await fetchDishes();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dish: Dish) => {
    const confirm = await Swal.fire({
      title: `Xóa món "${dish.name}"?`,
      text: "Nếu món đã từng xuất hiện trong lịch sử thực đơn, hệ thống sẽ tự động chuyển sang trạng thái Tạm ẩn để bảo toàn dữ liệu.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Hủy",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/central-kitchen/dish-bank/${dish.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xóa món");
      Swal.fire({
        icon: "success",
        title: "Hoàn tất",
        text: data.message || "Đã xóa món ăn khỏi danh mục",
        timer: 1400,
        showConfirmButton: false,
      });
      await fetchDishes();
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Ngân hàng món ăn Bếp Trung Tâm
              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                {dishes.length} món
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Quản lý danh sách các món ăn kèm mã món để thêm vào thực đơn cả tuần hoặc công khai theo ngày
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchCategories();
              fetchDishes();
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm món ăn mới</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên món hoặc mã món (vd: cơm, đậu hũ, MON_001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="">Tất cả nhóm món</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon || "🍱"} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MODAL / DRAWER FORM THÊM & SỬA MÓN */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingDish ? "Chỉnh sửa món ăn" : "Thêm món vào Ngân hàng món"}
                  </h3>
                  <p className="text-[10px] text-blue-100">Bếp Trung Tâm • Định danh món chuẩn hóa</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên món ăn <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Cơm trắng, Đậu hũ dồn thịt sốt cà, Canh bắp cải..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nhóm món ăn
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chưa phân nhóm --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon || "🍱"} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* MÃ MÓN (Tự sinh hoặc tự đặt) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cơ chế cấp Mã Món
                  </span>
                  {!editingDish && (
                    <label className="flex items-center gap-1.5 text-xs text-blue-600 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCode}
                        onChange={(e) => setAutoCode(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Hệ thống tự sinh mã (MON_xxx)</span>
                    </label>
                  )}
                </div>

                {autoCode ? (
                  <div className="text-xs text-slate-500 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">● Tự động:</span>
                    <span>Hệ thống sẽ tự gán mã tiếp theo (vd: MON_001, MON_002...) khi lưu.</span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="VD: CT, DH-THIT, CANH-CAI, MON_015..."
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required={!autoCode}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Mã món phải là duy nhất, không trùng lặp trong hệ thống.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả dinh dưỡng / Lưu ý dị ứng (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Định lượng 100g, chứa hải sản / đậu phộng..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Đang phục vụ (Bật để món xuất hiện trong thực đơn)</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Đang lưu..." : editingDish ? "Lưu thay đổi" : "Thêm vào ngân hàng"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DANH SÁCH MÓN ĂN */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 w-28">Mã món</th>
                <th className="py-3 px-4">Tên món ăn</th>
                <th className="py-3 px-4 w-44">Nhóm món</th>
                <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && dishes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Đang tải danh sách món ăn...
                  </td>
                </tr>
              ) : dishes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Chưa tìm thấy món ăn nào phù hợp. Bấm "Thêm món ăn mới" để bắt đầu.
                  </td>
                </tr>
              ) : (
                dishes.map((dish, idx) => (
                  <tr key={dish.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-center font-bold text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                      {dish.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-white">{dish.name}</div>
                      {dish.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1">{dish.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {dish.category ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold">
                          <span>{dish.category.icon || "🍱"}</span>
                          <span>{dish.category.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa phân nhóm</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {dish.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Đang phục vụ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          Tạm ẩn
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(dish)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(dish)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition cursor-pointer"
                          title="Xóa món"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
