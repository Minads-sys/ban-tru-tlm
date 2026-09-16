"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn, X } from "lucide-react";

interface HdsdMockupImageProps {
  src: string;
  alt: string;
  caption: string;
  badge?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
}

export function HdsdMockupImage({
  src,
  alt,
  caption,
  badge = "Minh họa giao diện thực tế",
}: HdsdMockupImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <figure className="my-6 rounded-3xl border border-slate-200/90 bg-slate-900/5 p-3 sm:p-4 shadow-sm group">
        {/* Mockup Frame Header */}
        <div className="flex items-center justify-between pb-2.5 px-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline ml-1">
              bantrutlm.com
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {badge}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-xs text-slate-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer transition font-medium"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Phóng to</span>
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div
          onClick={() => setIsOpen(true)}
          className="relative overflow-hidden rounded-2xl bg-white shadow-sm cursor-pointer border border-slate-200/80"
        >
          <div className="relative w-full aspect-video">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.015]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 60vw"
            />
          </div>

          {/* Hover Overlay Hint */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
            <ZoomIn className="w-4 h-4" />
            <span>Bấm để xem ảnh phóng to</span>
          </div>
        </div>

        {/* Caption */}
        <figcaption className="mt-2.5 text-center text-xs text-slate-500 italic font-medium px-2">
          {caption}
        </figcaption>
      </figure>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 rounded-3xl p-2 sm:p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 px-3 text-white">
              <span className="text-xs sm:text-sm font-bold truncate">{caption}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-video bg-black/50 rounded-2xl overflow-hidden flex items-center justify-center">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
