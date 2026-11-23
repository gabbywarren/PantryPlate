import { CheckCircle2, AlertTriangle, Leaf, ShieldCheck, X } from "lucide-react";
import type { NutritionBreakdown, NutritionGrade } from "../../shared/types";

export function gradeMeta(grade: NutritionGrade) {
  switch (grade) {
    case "excellent":
      return {
        label: "Excellent",
        dot: "bg-emerald-600",
        pill: "bg-emerald-50 text-emerald-800 border-emerald-200",
        ring: "text-emerald-600 border-emerald-500 bg-emerald-50",
        bar: "bg-emerald-600",
      };
    case "good":
      return {
        label: "Good",
        dot: "bg-lime-600",
        pill: "bg-lime-50 text-lime-800 border-lime-200",
        ring: "text-lime-700 border-lime-500 bg-lime-50",
        bar: "bg-lime-600",
      };
    case "mediocre":
      return {
        label: "Mediocre",
        dot: "bg-amber-500",
        pill: "bg-amber-50 text-amber-800 border-amber-200",
        ring: "text-amber-700 border-amber-500 bg-amber-50",
        bar: "bg-amber-500",
      };
    case "poor":
      return {
        label: "Poor",
        dot: "bg-rose-600",
        pill: "bg-rose-50 text-rose-800 border-rose-200",
        ring: "text-rose-700 border-rose-500 bg-rose-50",
        bar: "bg-rose-600",
      };
  }
}

export function NutritionBadge({
  score,
  grade,
  compact = false,
  onClick,
}: {
  score: number;
  grade: NutritionGrade;
  compact?: boolean;
  onClick?: () => void;
}) {
  const meta = gradeMeta(grade);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition ${meta.pill} ${
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      } ${onClick ? "cursor-pointer hover:brightness-95 active:scale-[0.98]" : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <span>{score}/100</span>
      {!compact && <span className="opacity-80">• {meta.label}</span>}
    </Tag>
  );
}

export function NutritionBreakdownModal({
  title,
  breakdown,
  onClose,
}: {
  title: string;
  breakdown: NutritionBreakdown;
  onClose: () => void;
}) {
  const meta = gradeMeta(breakdown.grade);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nutrition score breakdown"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF8F4] shadow-2xl border border-[#E8E2D9]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#FAF8F4]/95 backdrop-blur px-5 py-4 border-b border-[#E8E2D9]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8C8378]">
              Yuka-Style Nutrition Score
            </p>
            <h3 className="font-editorial text-lg font-bold text-[#1E1C19] line-clamp-1">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#635D54] hover:bg-[#EAE4DA]"
            aria-label="Close nutrition breakdown"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score Hero */}
          <div className="flex items-center gap-4 rounded-2xl bg-white p-4 border border-[#E8E2D9]">
            <div
              className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${meta.ring}`}
            >
              <span className="text-2xl font-extrabold leading-none">{breakdown.score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                / 100
              </span>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <span className="text-base font-bold">{meta.label}</span>
              </div>
              <p className="text-xs text-[#635D54] leading-relaxed">
                Scored with Yuka&apos;s 60/30/10 weighting: nutritional balance (FSA Nutri-Score),
                additives &amp; processing (NOVA), and whole/organic ingredient share.
              </p>
            </div>
          </div>

          {/* 3-Pillar Score Bars */}
          <div className="rounded-2xl bg-white p-4 border border-[#E8E2D9] space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
              Score Breakdown
            </h4>
            {[
              {
                label: "Nutritional Quality",
                val: breakdown.nutritionPoints,
                max: 60,
                icon: Leaf,
              },
              {
                label: "Additives & Processing",
                val: breakdown.additivesPoints,
                max: 30,
                icon: ShieldCheck,
              },
              {
                label: "Whole & Organic Bonus",
                val: breakdown.wholeFoodPoints,
                max: 10,
                icon: CheckCircle2,
              },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-[#1E1C19]">
                    <row.icon className="h-3.5 w-3.5 text-[#8C8378]" />
                    {row.label}
                  </span>
                  <span className="font-semibold text-[#635D54]">
                    {row.val} / {row.max}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#EFEAE2] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${Math.round((row.val / row.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Per-Serving Macros */}
          <div className="rounded-2xl bg-white p-4 border border-[#E8E2D9]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C8378] mb-3">
              Estimated Nutrition per Serving
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Calories", val: `${breakdown.perServing.calories}`, unit: "kcal" },
                { label: "Protein", val: `${breakdown.perServing.proteinG}g`, unit: "" },
                { label: "Carbs", val: `${breakdown.perServing.carbsG}g`, unit: "" },
                { label: "Fat", val: `${breakdown.perServing.fatG}g`, unit: "" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-[#FAF8F4] p-2.5 border border-[#EFEAE2]">
                  <div className="text-base font-bold text-[#1E1C19]">
                    {m.val}
                    {m.unit && <span className="text-[10px] font-medium ml-0.5">{m.unit}</span>}
                  </div>
                  <div className="text-[11px] text-[#635D54]">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#635D54] px-1">
              <span>Fiber: <strong>{breakdown.perServing.fiberG}g</strong></span>
              <span>Sugar: <strong>{breakdown.perServing.sugarG}g</strong></span>
              <span>Sat Fat: <strong>{breakdown.perServing.saturatedFatG}g</strong></span>
              <span>Sodium: <strong>{breakdown.perServing.sodiumMg}mg</strong></span>
            </div>
          </div>

          {/* Positives & Negatives */}
          {(breakdown.positives.length > 0 || breakdown.negatives.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {breakdown.positives.length > 0 && (
                <div className="rounded-2xl bg-emerald-50/70 p-3.5 border border-emerald-200/80 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Positives
                  </div>
                  <ul className="space-y-1 text-xs text-emerald-900/90">
                    {breakdown.positives.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {breakdown.negatives.length > 0 && (
                <div className="rounded-2xl bg-amber-50/80 p-3.5 border border-amber-200/80 space-y-1.5">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Watch Out
                  </div>
                  <ul className="space-y-1 text-xs text-amber-900/90">
                    {breakdown.negatives.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {breakdown.contributors.length > 0 && (
            <div className="rounded-2xl bg-white p-4 border border-[#E8E2D9] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                Key Ingredient Drivers
              </h4>
              <div className="divide-y divide-[#F0EBE3]">
                {breakdown.contributors.map((c, idx) => (
                  <div key={`${c.name}-${idx}`} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium text-[#1E1C19] capitalize">{c.name}</span>
                    <span
                      className={
                        c.impact === "positive"
                          ? "text-emerald-700 font-medium"
                          : c.impact === "negative"
                            ? "text-amber-700 font-medium"
                            : "text-[#635D54]"
                      }
                    >
                      {c.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#8C8378] text-center">
            Ingredient nutrition coverage: {breakdown.coveragePct}% matched against USDA staples &amp;
            Open Food Facts.
          </p>
        </div>
      </div>
    </div>
  );
}
