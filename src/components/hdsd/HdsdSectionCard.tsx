import React from "react";

interface HdsdSectionCardProps {
  id: string;
  sectionNumber: string | number;
  title: string;
  badge?: string;
  badgeColor?: string;
  themeColor?: "orange" | "red" | "green" | "amber" | "blue" | "purple";
  icon: React.ReactNode;
  children: React.ReactNode;
}

const THEME_STYLES = {
  orange: {
    badgeBg: "bg-orange-100 text-orange-800",
    iconBg: "bg-orange-500 text-white shadow-orange-500/20",
    headerGradient: "from-orange-500/10 via-amber-500/5 to-transparent",
    accentBorder: "border-orange-500",
  },
  red: {
    badgeBg: "bg-rose-100 text-rose-800",
    iconBg: "bg-rose-500 text-white shadow-rose-500/20",
    headerGradient: "from-rose-500/10 via-orange-500/5 to-transparent",
    accentBorder: "border-rose-500",
  },
  green: {
    badgeBg: "bg-emerald-100 text-emerald-800",
    iconBg: "bg-emerald-600 text-white shadow-emerald-600/20",
    headerGradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    accentBorder: "border-emerald-500",
  },
  amber: {
    badgeBg: "bg-amber-100 text-amber-800",
    iconBg: "bg-amber-500 text-white shadow-amber-500/20",
    headerGradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
    accentBorder: "border-amber-500",
  },
  blue: {
    badgeBg: "bg-sky-100 text-sky-800",
    iconBg: "bg-sky-500 text-white shadow-sky-500/20",
    headerGradient: "from-sky-500/10 via-blue-500/5 to-transparent",
    accentBorder: "border-sky-500",
  },
  purple: {
    badgeBg: "bg-violet-100 text-violet-800",
    iconBg: "bg-violet-500 text-white shadow-violet-500/20",
    headerGradient: "from-violet-500/10 via-purple-500/5 to-transparent",
    accentBorder: "border-violet-500",
  },
};

export function HdsdSectionCard({
  id,
  sectionNumber,
  title,
  badge,
  badgeColor,
  themeColor = "orange",
  icon,
  children,
}: HdsdSectionCardProps) {
  const styles = THEME_STYLES[themeColor];

  return (
    <section
      id={id}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow overflow-hidden scroll-mt-24"
    >
      {/* Card Header with vibrant accent */}
      <div
        className={`border-b border-slate-100 bg-gradient-to-r ${styles.headerGradient} px-6 py-5 flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${styles.iconBg}`}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Mục {sectionNumber}
              </span>
              {badge && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    badgeColor || styles.badgeBg
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h2>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 sm:p-8 space-y-6 text-slate-700 leading-relaxed text-sm sm:text-base">
        {children}
      </div>
    </section>
  );
}
