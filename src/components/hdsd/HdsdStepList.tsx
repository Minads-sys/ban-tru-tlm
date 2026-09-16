import React from "react";

export interface StepItem {
  step: number;
  title: string;
  desc: React.ReactNode;
  note?: string;
}

interface HdsdStepListProps {
  steps: StepItem[];
  color?: "orange" | "red" | "green" | "blue" | "amber";
}

const STEP_COLORS = {
  orange: {
    badge: "from-orange-500 to-rose-500 shadow-orange-500/25",
    connector: "bg-orange-200",
  },
  red: {
    badge: "from-rose-500 to-red-600 shadow-rose-500/25",
    connector: "bg-rose-200",
  },
  green: {
    badge: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
    connector: "bg-emerald-200",
  },
  blue: {
    badge: "from-sky-500 to-blue-600 shadow-sky-500/25",
    connector: "bg-sky-200",
  },
  amber: {
    badge: "from-amber-500 to-yellow-600 shadow-amber-500/25",
    connector: "bg-amber-200",
  },
};

export function HdsdStepList({ steps, color = "orange" }: HdsdStepListProps) {
  const theme = STEP_COLORS[color];

  return (
    <div className="space-y-4 my-4">
      {steps.map((item, idx) => (
        <div key={item.step} className="flex items-start gap-3.5 sm:gap-4 relative group">
          {/* Badge Number */}
          <div className="relative flex flex-col items-center shrink-0">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br ${theme.badge} text-white font-extrabold flex items-center justify-center text-xs sm:text-sm shadow-md group-hover:scale-105 transition`}
            >
              {item.step}
            </div>
            {/* Connector Line if not last */}
            {idx < steps.length - 1 && (
              <div
                className={`w-0.5 grow min-h-[32px] sm:min-h-[40px] my-1 ${theme.connector} rounded-full`}
              />
            )}
          </div>

          {/* Content */}
          <div className="grow pt-0.5 pb-3">
            <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">
              {item.title}
            </h4>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {item.desc}
            </div>
            {item.note && (
              <p className="mt-1.5 text-xs text-orange-700 bg-orange-50/80 px-2.5 py-1 rounded-lg inline-block font-medium">
                💡 {item.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
