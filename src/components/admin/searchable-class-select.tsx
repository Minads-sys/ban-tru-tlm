'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

interface SearchableClassSelectProps {
  classes: ClassItem[];
  value: string;
  onChange: (classId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Xóa dấu tiếng Việt để tìm kiếm linh hoạt (VD: "lop 10" tìm được "Lớp 10")
function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function formatClassLabel(c: ClassItem): string {
  const name = c.name.trim();
  const prefix = name.toLowerCase().startsWith('lớp') ? '' : 'Lớp ';
  return `${prefix}${name} (${c.id})`;
}

export function SearchableClassSelect({
  classes,
  value,
  onChange,
  placeholder = 'Chọn lớp...',
  disabled = false,
  className = '',
}: SearchableClassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === value),
    [classes, value]
  );

  // Lọc lớp theo từ khóa tìm kiếm
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const queryNorm = removeVietnameseDiacritics(searchQuery);
    const queryRaw = searchQuery.toLowerCase().trim();

    return classes.filter((c) => {
      const nameNorm = removeVietnameseDiacritics(c.name);
      const idNorm = removeVietnameseDiacritics(c.id);
      const fullLabelNorm = removeVietnameseDiacritics(formatClassLabel(c));

      return (
        nameNorm.includes(queryNorm) ||
        idNorm.includes(queryNorm) ||
        fullLabelNorm.includes(queryNorm) ||
        c.name.toLowerCase().includes(queryRaw) ||
        c.id.toLowerCase().includes(queryRaw)
      );
    });
  }, [classes, searchQuery]);

  const handleOpen = () => {
    if (disabled) return;
    setSearchQuery('');
    const curIdx = classes.findIndex((c) => c.id === value);
    setHighlightedIndex(curIdx >= 0 ? curIdx : 0);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  // Khi mở dropdown: focus ô tìm kiếm
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Click ra ngoài để đóng dropdown
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('touchstart', handlePointerDown);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Tự động cuộn đến mục đang được highlight
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-class-item]');
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (classId: string) => {
    onChange(classId);
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredClasses.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredClasses.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredClasses[highlightedIndex]) {
        handleSelect(filteredClasses[highlightedIndex].id);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Nút bấm hiển thị lớp hiện tại */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`w-full bg-white h-9 px-3 rounded-md border text-xs flex items-center justify-between text-left transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${selectedClass ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
          {selectedClass ? formatClassLabel(selectedClass) : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Bảng tìm kiếm và danh sách lớp học thả xuống */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-100"
          onKeyDown={handleKeyDown}
        >
          {/* Ô gõ tìm kiếm */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="🔍 Gõ tìm lớp (VD: 10A1, 11...)"
                className="w-full pl-8 pr-7 h-8 text-xs bg-white border border-slate-200 rounded-md outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách lớp phù hợp */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50"
            role="listbox"
          >
            {filteredClasses.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Không tìm thấy lớp nào phù hợp với &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredClasses.map((c, index) => {
                const isSelected = c.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={c.id}
                    data-class-item
                    onClick={() => handleSelect(c.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-2.5 py-2 text-xs rounded-md cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 text-blue-700 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{formatClassLabel(c)}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Dòng tóm tắt số lượng */}
          {filteredClasses.length > 0 && (
            <div className="px-2.5 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center shrink-0">
              <span>{filteredClasses.length} lớp học</span>
              {selectedClass && <span>Đang chọn: {selectedClass.name}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
