import React from "react";
import { Info, Lightbulb, AlertTriangle, CheckCircle2 } from "lucide-react";

interface HdsdInfoBoxProps {
  type?: "note" | "tip" | "warning" | "success";
  title?: string;
  children: React.ReactNode;
}

const BOX_STYLES = {
  note: {
    container: "bg-sky-50/80 border-sky-200 text-sky-950",
    iconBg: "bg-sky-500 text-white",
    titleColor: "text-sky-900",
    defaultTitle: "Lưu ý",
    icon: Info,
  },
  tip: {
    container: "bg-amber-50/80 border-amber-200 text-amber-950",
    iconBg: "bg-amber-500 text-white",
    titleColor: "text-amber-900",
    defaultTitle: "Mẹo hay",
    icon: Lightbulb,
  },
  warning: {
    container: "bg-rose-50/80 border-rose-200 text-rose-950",
    iconBg: "bg-rose-500 text-white",
    titleColor: "text-rose-900",
    defaultTitle: "Cảnh báo quan trọng",
    icon: AlertTriangle,
  },
  success: {
    container: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
    iconBg: "bg-emerald-600 text-white",
    titleColor: "text-emerald-900",
    defaultTitle: "Khuyên dùng",
    icon: CheckCircle2,
  },
};

export function HdsdInfoBox({
  type = "note",
  title,
  children,
}: HdsdInfoBoxProps) {
  const style = BOX_STYLES[type];
  const Icon = style.icon;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 transition ${style.container}`}
    >
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${style.iconBg}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xs sm:text-sm leading-relaxed grow space-y-1">
        <h5 className={`font-extrabold ${style.titleColor}`}>
          {title || style.defaultTitle}
        </h5>
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
