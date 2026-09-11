"use client";

import React, { useState } from "react";
import { Plus, Edit2, Check, X, Info } from "lucide-react";
import { toast } from "@/lib/toast";

interface IngredientItem {
  id: string;
  code: string;
  name: string;
  category: string; // GAO | MON_NUOC | TRAI_CAY
  unit: string;
  quantityPerServing: number;
  isActive: boolean;
  sortOrder: number;
}

interface IngredientManagerProps {
  ingredients: IngredientItem[];
  onRefresh: () => Promise<void>;
  userRole?: string;
}

export function IngredientManager({
  ingredients,
  onRefresh,
  userRole,
}: IngredientManagerProps) {
  const [editingItem, setEditingItem] = useState<Partial<IngredientItem> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"GAO" | "MON_NUOC" | "TRAI_CAY">("GAO");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const riceItems = ingredients.filter((i) => i.category === "GAO");
  const noodleItems = ingredients.filter((i) => i.category === "MON_NUOC");
  const fruitItems = ingredients.filter((i) => i.category === "TRAI_CAY");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.name || !editingItem?.category) {
      toast.error("Vui lòng điền tên nguyên liệu");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingItem.id;
      const res = await fetch("/api/central-kitchen/ingredients", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi lưu");

      toast.success(isEdit ? "Cập nhật định lượng thành công" : "Thêm nguyên liệu mới thành công");
      setEditingItem(null);
      setIsCreating(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: IngredientItem) => {
    try {
      const res = await fetch("/api/central-kitchen/ingredients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error("Lỗi cập nhật trạng thái");

      toast.success(`Đã cập nhật ${item.name}`);
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
            Cài Đặt Định Lượng Nguyên Liệu
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Khai báo số gram trên mỗi suất ăn để hệ thống tự động quy đổi ra Kilogram (kg) xuất kho
          </p>
        </div>

        {userRole === "ADMIN" && (
          <button
            onClick={() => {
              setEditingItem({
                category: activeCategory,
                name: "",
                unit: "g",
                quantityPerServing: activeCategory === "GAO" ? 150 : 200,
                sortOrder: 1,
                isActive: true,
              });
              setIsCreating(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            Thêm nguyên liệu
          </button>
        )}
      </div>

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveCategory("GAO")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeCategory === "GAO"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          🌾 Gạo ({riceItems.length})
        </button>
        <button
          onClick={() => setActiveCategory("MON_NUOC")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeCategory === "MON_NUOC"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          🍜 Món Nước ({noodleItems.length})
        </button>
        <button
          onClick={() => setActiveCategory("TRAI_CAY")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeCategory === "TRAI_CAY"
              ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/20"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          🍌 Trái Cây ({fruitItems.length})
        </button>
      </div>

      {/* NOTICE BOX */}
      {activeCategory === "GAO" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-0.5">Quy ước tính Gạo:</p>
            <p>
              • Chỉ cần 1 định lượng gạo chuẩn (mặc định 150g/suất), không phân biệt loại gạo.
            </p>
            <p>
              • Với chi nhánh ăn <strong>Mặn Cơm</strong>: Gạo = (Mặn + Chay) × Định lượng Gạo.
            </p>
            <p>
              • Với chi nhánh ăn <strong>Mặn Nước</strong>: Mặn ăn Bún/Phở, Gạo chỉ cấp cho suất Chay (Gạo = Chay × Định lượng Gạo).
            </p>
          </div>
        </div>
      )}

      {/* ITEMS LIST */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(activeCategory === "GAO"
          ? riceItems
          : activeCategory === "MON_NUOC"
          ? noodleItems
          : fruitItems
        ).map((item) => (
          <div
            key={item.id}
            className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-2 transition ${
              item.isActive
                ? "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                : "bg-slate-100/50 dark:bg-slate-800/20 border-dashed border-slate-300 opacity-60"
            }`}
          >
            <div>
              <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                {activeCategory === "GAO" ? "🌾" : activeCategory === "MON_NUOC" ? "🍜" : "🍌"}{" "}
                {item.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Định lượng:{" "}
                <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                  {item.quantityPerServing} {item.unit}/suất
                </span>
              </div>
            </div>

            {userRole === "ADMIN" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setIsCreating(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                  title="Chỉnh sửa định lượng"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {/* Rice can't be deactivated if only 1 exists */}
                {activeCategory !== "GAO" && (
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      item.isActive
                        ? "hover:bg-red-100 text-red-600"
                        : "hover:bg-emerald-100 text-emerald-600"
                    }`}
                    title={item.isActive ? "Ẩn nguyên liệu" : "Hiện nguyên liệu"}
                  >
                    {item.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* EDIT / CREATE MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              {isCreating ? "Thêm Nguyên Liệu Mới" : `Chỉnh Sửa: ${editingItem.name}`}
            </h4>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên nguyên liệu:
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                  placeholder="VD: Bánh phở tươi, Dưa hấu..."
                  className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Định lượng mỗi suất:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingItem.quantityPerServing || 150}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        quantityPerServing: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full text-sm font-black p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn vị tính:
                  </label>
                  <input
                    type="text"
                    value={editingItem.unit || "g"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, unit: e.target.value })
                    }
                    className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
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
                  {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
