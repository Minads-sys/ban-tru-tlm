'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export type ClassOptionItem = string | { id: string; name: string };

interface SearchableClassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ClassOptionItem[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableClassSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn lớp',
  className = '',
  disabled = false,
}: SearchableClassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Chuẩn hóa danh sách options thành { id, name }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string') {
      return { id: opt, name: opt };
    }
    return { id: opt.id, name: opt.name || opt.id };
  });

  // Tìm label hiển thị cho giá trị đang chọn
  const selectedOption = normalizedOptions.find((opt) => opt.id === value || opt.name === value);
  const displayLabel = selectedOption ? `Lớp ${selectedOption.name}` : value ? `Lớp ${value}` : placeholder;

  const filteredOptions = normalizedOptions.filter((opt) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.name.toLowerCase().includes(q) ||
      opt.id.toLowerCase().includes(q) ||
      `lớp ${opt.name}`.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? 'ring-2 ring-ring ring-offset-2' : ''
        }`}
      >
        <span className={`truncate ${selectedOption || value ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
          {displayLabel}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-md border border-slate-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* Ô tìm kiếm */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-md">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gõ tìm lớp (vd: 10A1, TEST...)"
              className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 text-slate-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Danh sách lớp cuộn mượt */}
          <div className="max-h-60 overflow-y-auto p-1 text-sm">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.id || value === opt.name;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Lớp {opt.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                Không tìm thấy lớp phù hợp
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
