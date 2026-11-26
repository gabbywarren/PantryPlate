import { useState } from "react";
import {
  BookmarkPlus,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import type { GeneratedRecipeIdea, PantryItem } from "../../shared/types";
import { formatQuantity } from "../../shared/unitConverter";
import { api } from "../api";
import { NutritionBadge } from "./NutritionBadge";

interface Props {
  pantryItems: PantryItem[];
  onClose: () => void;
  onSavedRecipe: (recipeId: string) => void;
}

const MEAL_TYPES = [
  { id: "any", label: "Any Meal" },
  { id: "dinner", label: "Dinner" },
  { id: "lunch", label: "Lunch" },
  { id: "breakfast", label: "Breakfast" },
  { id: "snack", label: "Snack" },
  { id: "dessert", label: "Dessert" },
] as const;

export function PantryChefModal({ pantryItems, onClose, onSavedRecipe }: Props) {
  const available = pantryItems.filter((p) => p.stockStatus !== "out");
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]["id"]>("dinner");
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [strictMode, setStrictMode] = useState(true);
  const [craving, setCraving] = useState("");
  const [priorityIds, setPriorityIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<GeneratedRecipeIdea[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  function togglePriority(id: string) {
    setPriorityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.recipes.generateFromPantry({
        mealType,
        maxMinutes,
        strictMode,
        craving,
        priorityItemIds: Array.from(priorityIds),
      });
      setIdeas(res.ideas);
      setExpandedIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate recipes");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveIdea(idea: GeneratedRecipeIdea, idx: number) {
    setSavingIdx(idx);
    try {
      const saved = await api.recipes.create({
        title: idea.title,
        description: idea.description,
        sourceUrl: "",
        sourceHandle: "PantryPlate Chef",
        servings: idea.servings,
        prepMinutes: idea.prepMinutes,
        cookMinutes: idea.cookMinutes,
        coverImageKey: null,
        tags: Array.from(new Set(["pantry-chef", ...idea.tags])).slice(0, 6),
        ingredients: idea.ingredients.map((i) => ({
          rawText: i.rawText,
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          canonicalName: i.canonicalName,
          aisle: i.aisle,
          notes: i.notes,
        })),
        steps: idea.steps,
        screenshots: [],
      });
      onSavedRecipe(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    } finally {
      setSavingIdx(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create recipes from pantry"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF8F4] shadow-2xl border border-[#E8E2D9]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#FAF8F4]/95 backdrop-blur px-5 py-4 border-b border-[#E8E2D9]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C85A32] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold text-[#1E1C19] leading-tight">
                Cook From My Pantry
              </h3>
              <p className="text-[11px] text-[#635D54]">
                Powered by GPT-6 Luna • {available.length} item{available.length === 1 ? "" : "s"}{" "}
                in stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#635D54] hover:bg-[#EAE4DA]"
            aria-label="Close Pantry Chef"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {available.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E8E2D9] p-6 text-center space-y-2">
              <ChefHat className="h-8 w-8 mx-auto text-[#B7AEA2]" />
              <p className="text-sm font-bold text-[#1E1C19]">
                Your Pantry &amp; Fridge is empty
              </p>
              <p className="text-xs text-[#635D54] leading-relaxed">
                Add a few ingredients or scan a couple of barcodes in the <strong>Pantry</strong>{" "}
                tab first, then come back here to generate custom recipes!
              </p>
            </div>
          ) : (
            <>
              {/* Options Form */}
              <div className="rounded-2xl bg-white border border-[#E8E2D9] p-4 space-y-4">
                {/* Optional: Prioritize specific items to use up */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                      Tap items to prioritize using up (optional)
                    </label>
                    {priorityIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setPriorityIds(new Set())}
                        className="text-[11px] font-semibold text-[#C85A32]"
                      >
                        Clear ({priorityIds.size})
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
                    {available.map((item) => {
                      const active = priorityIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => togglePriority(item.id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium border transition capitalize ${
                            active
                              ? "bg-[#C85A32] text-white border-[#C85A32]"
                              : "bg-[#FAF8F4] text-[#524C44] border-[#E4DDD2] hover:border-[#C85A32]/50"
                          }`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Meal Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                    Meal
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MEAL_TYPES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMealType(m.id)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                          mealType === m.id
                            ? "bg-[#1E1C19] text-white border-[#1E1C19]"
                            : "bg-[#FAF8F4] text-[#635D54] border-[#E4DDD2]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time & Strictness */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                      Max Time
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[20, 30, 45, 60].map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => setMaxMinutes(min)}
                          className={`rounded-xl py-1.5 text-xs font-bold border transition ${
                            maxMinutes === min
                              ? "bg-[#1E1C19] text-white border-[#1E1C19]"
                              : "bg-[#FAF8F4] text-[#635D54] border-[#E4DDD2]"
                          }`}
                        >
                          {min}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                      Ingredients Mode
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStrictMode(true)}
                        className={`rounded-xl py-1.5 px-2 text-xs font-bold border transition ${
                          strictMode
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-[#FAF8F4] text-[#635D54] border-[#E4DDD2]"
                        }`}
                      >
                        Pantry Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setStrictMode(false)}
                        className={`rounded-xl py-1.5 px-2 text-xs font-bold border transition ${
                          !strictMode
                            ? "bg-[#1E1C19] text-white border-[#1E1C19]"
                            : "bg-[#FAF8F4] text-[#635D54] border-[#E4DDD2]"
                        }`}
                      >
                        +1–2 Extras
                      </button>
                    </div>
                  </div>
                </div>

                {/* Craving / Dietary Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8C8378] mb-1">
                    Craving or Dietary Style (optional)
                  </label>
                  <input
                    type="text"
                    value={craving}
                    onChange={(e) => setCraving(e.target.value)}
                    placeholder="e.g. high protein, spicy, cozy one-pan, vegetarian…"
                    className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3.5 py-2 text-sm focus:border-[#C85A32] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGenerate}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C85A32] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#A84824] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Chef Luna is creating 3 recipes…
                    </>
                  ) : ideas.length > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Generate 3 New Ideas
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate 3 Recipes From My Pantry
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
                  {error}
                </div>
              )}

              {/* Generated Recipe Idea Cards */}
              {ideas.length > 0 && (
                <div className="space-y-3.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C8378] px-1">
                    Chef Luna&apos;s Suggestions ({ideas.length})
                  </h4>

                  {ideas.map((idea, idx) => {
                    const isExpanded = expandedIdx === idx;
                    const allOwned = idea.pantrySummary.missingCount === 0 && idea.pantrySummary.partialCount === 0;

                    return (
                      <article
                        key={`${idea.title}-${idx}`}
                        className="rounded-3xl bg-white border border-[#EAE3D9] shadow-xs overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <NutritionBadge
                              score={idea.nutritionScore}
                              grade={idea.nutritionGrade}
                            />
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <span className="inline-flex items-center gap-0.5 text-[#524C44]">
                                <DollarSign className="h-3.5 w-3.5 text-[#8C8378]" />
                                {formatCents(idea.estimatedCostCents).replace("$", "")}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  allOwned
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-[#FFF3EC] text-[#A84824]"
                                }`}
                              >
                                {allOwned
                                  ? "100% in pantry"
                                  : `${idea.pantrySummary.haveCount}/${idea.pantrySummary.totalCount} in pantry`}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h5 className="font-editorial text-lg font-bold text-[#1E1C19] leading-snug">
                              {idea.title}
                            </h5>
                            <p className="mt-1 text-xs text-[#635D54] leading-relaxed">
                              {idea.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#635D54]">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-[#8C8378]" />
                              {idea.prepMinutes + idea.cookMinutes} min
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-[#8C8378]" />
                              {idea.servings} srv
                            </span>
                            <span>
                              {idea.nutritionBreakdown.perServing.calories} kcal •{" "}
                              {idea.nutritionBreakdown.perServing.proteinG}g protein/srv
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] py-2 text-xs font-bold text-[#524C44]"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" /> Hide Recipe
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" /> Preview Recipe
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={savingIdx !== null}
                              onClick={() => void handleSaveIdea(idea, idx)}
                              className="flex-[1.3] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C85A32] py-2 text-xs font-bold text-white hover:bg-[#A84824] disabled:opacity-50"
                            >
                              {savingIdx === idx ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <BookmarkPlus className="h-3.5 w-3.5" />
                              )}
                              Save to Library
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[#F0EBE3] bg-[#FAF8F4] p-4 space-y-4">
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C8378]">
                                Ingredients
                              </div>
                              <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
                                {idea.ingredients.map((ing) => {
                                  const isMissing = idea.missingIngredients.includes(ing.name);
                                  return (
                                    <li
                                      key={ing.id}
                                      className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 border border-[#EFEAE2]"
                                    >
                                      <CheckCircle2
                                        className={`h-3.5 w-3.5 shrink-0 ${
                                          isMissing ? "text-amber-500" : "text-emerald-600"
                                        }`}
                                      />
                                      <span className="text-[#1E1C19]">
                                        {ing.quantity !== null && `${formatQuantity(ing.quantity)} `}
                                        {ing.unit && ing.unit !== "each" ? `${ing.unit} ` : ""}
                                        <strong>{ing.name}</strong>
                                        {ing.notes && (
                                          <span className="text-[#8C8378]"> ({ing.notes})</span>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            <div className="space-y-1.5">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C8378]">
                                Steps
                              </div>
                              <ol className="space-y-1.5 text-xs text-[#3D3832] list-decimal list-inside leading-relaxed">
                                {idea.steps.map((step, sIdx) => (
                                  <li key={sIdx}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
