import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  ShoppingCart,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import {
  formatIngredientMeasurement,
  matchIngredientsForStep,
} from "../../shared/stepIngredients";
import type { RecipeDetail } from "../../shared/types";
import { formatQuantity } from "../../shared/unitConverter";
import { api } from "../api";
import { NutritionBadge, NutritionBreakdownModal } from "./NutritionBadge";

interface Props {
  recipeId: string;
  onBack: () => void;
  onEdit: (recipe: RecipeDetail) => void;
  onDeleted: () => void;
  onShoppingUpdated: (msg: string) => void;
}

export function RecipeDetailView({
  recipeId,
  onBack,
  onEdit,
  onDeleted,
  onShoppingUpdated,
}: Props) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"ingredients" | "shopping" | "steps">("ingredients");
  const [scale, setScale] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [localShopChecked, setLocalShopChecked] = useState<Set<string>>(new Set());
  const [showNutrition, setShowNutrition] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Inline price override modal state
  const [priceEdit, setPriceEdit] = useState<{
    canonicalName: string;
    label: string;
    unit: string;
    dollars: string;
  } | null>(null);

  async function loadRecipe() {
    setLoading(true);
    try {
      const { recipe: data } = await api.recipes.get(recipeId);
      setRecipe(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecipe();
    return () => {
      void wakeLockRef.current?.release();
    };
  }, [recipeId]);

  async function toggleWakeLock() {
    if (wakeLockActive) {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
      return;
    }
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
        setWakeLockActive(true);
      }
    } catch {
      setWakeLockActive(false);
    }
  }

  async function handleAddMissingToStoreList() {
    if (!recipe) return;
    setAddingToCart(true);
    try {
      const res = await api.shopping.addFromRecipe(recipe.id, { scale, includeOwned: false });
      const total = res.addedCount + res.mergedCount;
      onShoppingUpdated(
        total > 0
          ? `Added ${total} missing ingredient${total > 1 ? "s" : ""} to Store List`
          : "You already have every ingredient in your pantry!"
      );
    } finally {
      setAddingToCart(false);
    }
  }

  async function handleSavePriceOverride() {
    if (!priceEdit) return;
    const dollars = parseFloat(priceEdit.dollars);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    await api.food.setPrice(priceEdit.canonicalName, Math.round(dollars * 100), priceEdit.unit || "each");
    setPriceEdit(null);
    await loadRecipe();
  }

  async function handleDelete() {
    if (!recipe) return;
    if (!window.confirm(`Delete "${recipe.title}" from your library?`)) return;
    await api.recipes.delete(recipe.id);
    onDeleted();
  }

  if (loading) {
    return <div className="h-96 rounded-3xl bg-white border border-[#E8E2D9] animate-pulse" />;
  }

  if (!recipe) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center border border-[#E8E2D9]">
        <p className="text-sm font-semibold">Recipe not found.</p>
        <button type="button" onClick={onBack} className="mt-3 text-xs font-semibold text-[#C85A32]">
          Back to Library
        </button>
      </div>
    );
  }

  const scaledServings = Math.max(1, Math.round(recipe.servings * scale * 10) / 10);
  const scaledTotalCents = Math.round(recipe.estimatedCostCents * scale);
  const scaledMissingCents = Math.round(recipe.pantrySummary.missingCostCents * scale);

  const missingIngredients = recipe.ingredients.filter(
    (i) => i.pantryMatch.status !== "have_enough"
  );
  const ownedIngredients = recipe.ingredients.filter(
    (i) => i.pantryMatch.status === "have_enough"
  );

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-[#1E1C19] border border-[#E4DDD2] shadow-xs hover:bg-[#FAF8F4]"
        >
          <ArrowLeft className="h-4 w-4" /> Library
        </button>

        <div className="flex items-center gap-2">
          {recipe.screenshots.length > 0 && (
            <button
              type="button"
              onClick={() => setShowScreenshots(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#524C44] border border-[#E4DDD2]"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Source ({recipe.screenshots.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(recipe)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#524C44] border border-[#E4DDD2]"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full bg-white p-2 text-[#8C8378] hover:text-rose-600 border border-[#E4DDD2]"
            aria-label="Delete recipe"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="overflow-hidden rounded-3xl bg-white border border-[#EAE3D9] shadow-xs">
        {recipe.coverImageUrl && (
          <div className="h-56 sm:h-72 w-full overflow-hidden">
            <img
              src={recipe.coverImageUrl}
              alt={recipe.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <NutritionBadge
                score={recipe.nutritionScore}
                grade={recipe.nutritionGrade}
                onClick={() => setShowNutrition(true)}
              />
              {recipe.sourceHandle && (
                <span className="rounded-full bg-[#F3EFE8] px-2.5 py-0.5 text-xs font-medium text-[#635D54]">
                  {recipe.sourceHandle}
                </span>
              )}
              {recipe.sourceUrl && (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[#FAF2EA] border border-[#F0D3BC] px-2.5 py-0.5 text-xs font-semibold text-[#9C401D] hover:bg-[#F7E5D4]"
                >
                  Original Recipe <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#FAF8F4] border border-[#EAE3D9] px-2.5 py-0.5 text-[11px] font-medium text-[#635D54]"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#1E1C19] leading-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="text-sm text-[#635D54] leading-relaxed">{recipe.description}</p>
            )}
          </div>

          {/* Key Metric Tiles */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setShowNutrition(true)}
              className="rounded-2xl bg-[#FAF8F4] border border-[#EFEAE2] p-3 text-left hover:border-[#C85A32]/40 transition"
            >
              <div className="text-[11px] font-semibold text-[#8C8378]">Nutrition</div>
              <div className="mt-0.5 text-base font-extrabold text-[#1E1C19]">
                {recipe.nutritionScore}
                <span className="text-xs font-medium text-[#8C8378]">/100</span>
              </div>
              <div className="text-[11px] text-[#C85A32] font-medium">Tap for breakdown</div>
            </button>

            <div className="rounded-2xl bg-[#FAF8F4] border border-[#EFEAE2] p-3">
              <div className="text-[11px] font-semibold text-[#8C8378]">Est. Cost</div>
              <div className="mt-0.5 text-base font-extrabold text-[#1E1C19]">
                {formatCents(scaledTotalCents)}
              </div>
              <div className="text-[11px] text-[#635D54]">
                {formatCents(Math.round(scaledTotalCents / scaledServings))}/srv
              </div>
            </div>

            <div className="rounded-2xl bg-[#FAF8F4] border border-[#EFEAE2] p-3">
              <div className="text-[11px] font-semibold text-[#8C8378]">Time</div>
              <div className="mt-0.5 text-base font-extrabold text-[#1E1C19]">
                {recipe.prepMinutes + recipe.cookMinutes}m
              </div>
              <div className="text-[11px] text-[#635D54]">
                {recipe.prepMinutes}p • {recipe.cookMinutes}c
              </div>
            </div>
          </div>

          {/* Serving Scaler + Primary Store Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#F0EBE3]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8C8378]" />
              <span className="text-xs font-semibold text-[#635D54]">
                {scaledServings} servings
              </span>
              <div className="inline-flex rounded-full bg-[#F3EFE8] p-0.5">
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                      scale === s
                        ? "bg-white text-[#1E1C19] shadow-xs"
                        : "text-[#635D54] hover:text-[#1E1C19]"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={addingToCart}
              onClick={handleAddMissingToStoreList}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#C85A32] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#A84824] disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              {addingToCart
                ? "Adding…"
                : missingIngredients.length > 0
                  ? `Add ${missingIngredients.length} Missing (${formatCents(scaledMissingCents)})`
                  : "All Ingredients in Pantry!"}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="grid grid-cols-3 rounded-2xl bg-[#EFEAE2] p-1">
        {[
          { id: "ingredients", label: "Ingredients", icon: ListChecks },
          {
            id: "shopping",
            label: `Store List (${missingIngredients.length})`,
            icon: ShoppingCart,
          },
          { id: "steps", label: "Cook Steps", icon: ChefHat },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
              subTab === t.id
                ? "bg-white text-[#1E1C19] shadow-xs"
                : "text-[#635D54] hover:text-[#1E1C19]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: INGREDIENTS & PANTRY MATCH */}
      {subTab === "ingredients" && (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] divide-y divide-[#F2EDE5] overflow-hidden">
          {recipe.ingredients.map((ing) => {
            const scaledQty =
              ing.quantity !== null ? Math.round(ing.quantity * scale * 100) / 100 : null;
            const scaledCost = Math.round(ing.estimatedCostCents * scale);
            const status = ing.pantryMatch.status;

            return (
              <div key={ing.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    {scaledQty !== null && (
                      <span className="text-sm font-bold text-[#1E1C19]">
                        {formatQuantity(scaledQty)} {ing.unit !== "each" ? ing.unit : ""}
                      </span>
                    )}
                    <span className="text-sm font-medium text-[#1E1C19]">{ing.name}</span>
                    {ing.notes && (
                      <span className="text-xs text-[#8C8378]">({ing.notes})</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        status === "have_enough"
                          ? "bg-emerald-50 text-emerald-700"
                          : status === "partial" || status === "low_stock"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-[#FFF3EC] text-[#A84824]"
                      }`}
                    >
                      {status === "have_enough" && <CheckCircle2 className="h-3 w-3" />}
                      {ing.pantryMatch.note}
                    </span>
                    <span className="text-[11px] text-[#9A9186]">{ing.aisle}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPriceEdit({
                      canonicalName: ing.canonicalName,
                      label: ing.name,
                      unit: ing.unit || "each",
                      dollars: (ing.estimatedCostCents / 100 / Math.max(0.25, ing.quantity ?? 1)).toFixed(2),
                    })
                  }
                  title="Edit ingredient unit price"
                  className="shrink-0 inline-flex items-center gap-0.5 rounded-xl bg-[#FAF8F4] px-2.5 py-1.5 text-xs font-semibold text-[#635D54] border border-[#ECE5DA] hover:border-[#C85A32]"
                >
                  <DollarSign className="h-3 w-3 text-[#8C8378]" />
                  {formatCents(scaledCost).replace("$", "")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: DEDICATED RECIPE SHOPPING LIST */}
      {subTab === "shopping" && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-[#EAE3D9] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 bg-[#FFF8F2] border-b border-[#F2E2D5]">
              <div>
                <h3 className="text-sm font-bold text-[#1E1C19]">
                  Need to Buy ({missingIngredients.length})
                </h3>
                <p className="text-xs text-[#635D54]">
                  Est. store cost: <strong>{formatCents(scaledMissingCents)}</strong> (pantry items
                  excluded)
                </p>
              </div>
              {missingIngredients.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddMissingToStoreList}
                  className="rounded-xl bg-[#C85A32] px-3 py-1.5 text-xs font-bold text-white"
                >
                  Send to Master List
                </button>
              )}
            </div>

            {missingIngredients.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-[#1E1C19]">You have everything on hand!</p>
                <p className="text-xs text-[#635D54]">
                  Every ingredient matches your Pantry &amp; Fridge inventory.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F2EDE5]">
                {missingIngredients.map((ing) => {
                  const isChecked = localShopChecked.has(ing.id);
                  const qty =
                    ing.pantryMatch.status === "partial" && ing.pantryMatch.missingQuantity
                      ? Math.round(ing.pantryMatch.missingQuantity * scale * 100) / 100
                      : ing.quantity !== null
                        ? Math.round(ing.quantity * scale * 100) / 100
                        : null;

                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => {
                        setLocalShopChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(ing.id)) next.delete(ing.id);
                          else next.add(ing.id);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-[#FAF8F4]"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-[#CFC6B9] bg-white"
                        }`}
                      >
                        {isChecked && <Check className="h-4 w-4 stroke-[3]" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            isChecked ? "line-through text-[#9A9186]" : "text-[#1E1C19]"
                          }`}
                        >
                          {qty !== null && `${formatQuantity(qty)} `}
                          {ing.unit && ing.unit !== "each" ? `${ing.unit} ` : ""}
                          {ing.name}
                        </div>
                        <div className="text-xs text-[#8C8378]">
                          {ing.aisle}
                          {ing.pantryMatch.status !== "missing" && ` • ${ing.pantryMatch.note}`}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#635D54]">
                        {formatCents(Math.round(ing.estimatedCostCents * scale))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Already in Pantry / Fridge */}
          {ownedIngredients.length > 0 && (
            <div className="rounded-3xl bg-[#F4F8F5] border border-emerald-200/80 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Already in Your Pantry / Fridge ({ownedIngredients.length})
              </h4>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {ownedIngredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs text-[#524C44]"
                  >
                    <span className="font-medium line-through decoration-emerald-500/60">
                      {ing.name}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 capitalize">
                      {ing.pantryMatch.pantryLocation || "pantry"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: LEGIBLE COOK MODE STEPS */}
      {subTab === "steps" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#635D54]">
              Tap any step as you cook to check it off
            </span>
            <button
              type="button"
              onClick={toggleWakeLock}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                wakeLockActive
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-white text-[#635D54] border-[#E4DDD2]"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              {wakeLockActive ? "Screen Staying Awake" : "Keep Screen Awake"}
            </button>
          </div>

          {recipe.steps.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#EAE3D9] p-6 text-center text-sm text-[#635D54]">
              No cooking steps added yet. Tap <strong>Edit</strong> to add steps.
            </div>
          ) : (
            recipe.steps.map((step) => {
              const done = completedSteps.has(step.id);
              const stepIngs = matchIngredientsForStep(step.instruction, recipe.ingredients);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setCompletedSteps((prev) => {
                      const next = new Set(prev);
                      if (next.has(step.id)) next.delete(step.id);
                      else next.add(step.id);
                      return next;
                    });
                  }}
                  className={`w-full text-left rounded-3xl border p-5 transition flex gap-4 items-start ${
                    done
                      ? "bg-[#F5F2EC] border-[#E8E2D9] opacity-65"
                      : "bg-white border-[#EAE3D9] shadow-xs hover:border-[#C85A32]/40"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                      done ? "bg-emerald-600 text-white" : "bg-[#FAF2EA] text-[#C85A32]"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4 stroke-[3]" /> : step.stepNumber}
                  </span>
                  <div className="flex-1 space-y-2.5">
                    <p
                      className={`text-base leading-relaxed ${
                        done ? "line-through text-[#8C8378]" : "text-[#1E1C19]"
                      }`}
                    >
                      {step.instruction}
                    </p>
                    {stepIngs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {stepIngs.map((ing) => (
                          <span
                            key={ing.id}
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                              done
                                ? "bg-[#EFEAE2] text-[#8C8378] border-[#E2DCD2]"
                                : "bg-[#FFF6EE] text-[#9C401D] border-[#F2D9C2]"
                            }`}
                          >
                            {formatIngredientMeasurement(ing, scale)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Nutrition Breakdown Modal */}
      {showNutrition && (
        <NutritionBreakdownModal
          title={recipe.title}
          breakdown={recipe.nutritionBreakdown}
          onClose={() => setShowNutrition(false)}
        />
      )}

      {/* Original Screenshots Lightbox */}
      {showScreenshots && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#1E1C19] p-4 space-y-4">
            <div className="flex items-center justify-between text-white px-1">
              <span className="text-sm font-bold">Original Source Screenshot(s)</span>
              <button
                type="button"
                onClick={() => setShowScreenshots(false)}
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {recipe.screenshots.map((ss) => (
              <img
                key={ss.id}
                src={ss.imageUrl}
                alt="Original recipe screenshot"
                className="w-full rounded-2xl object-contain"
              />
            ))}
          </div>
        </div>
      )}

      {/* Inline Price Override Modal */}
      {priceEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 shadow-xl border border-[#E8E2D9]">
            <div className="flex items-center justify-between">
              <h4 className="font-editorial text-lg font-bold">Update Ingredient Price</h4>
              <button type="button" onClick={() => setPriceEdit(null)}>
                <X className="h-4 w-4 text-[#8C8378]" />
              </button>
            </div>
            <p className="text-xs text-[#635D54]">
              Set your local grocery price for <strong className="capitalize">{priceEdit.canonicalName}</strong>.
              All recipes using it will automatically recalculate their estimated cost!
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#635D54] mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={priceEdit.dollars}
                  onChange={(e) => setPriceEdit({ ...priceEdit, dollars: e.target.value })}
                  className="w-full rounded-xl border border-[#DDD5C9] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#635D54] mb-1">Per Unit</label>
                <input
                  type="text"
                  value={priceEdit.unit}
                  onChange={(e) => setPriceEdit({ ...priceEdit, unit: e.target.value })}
                  className="w-full rounded-xl border border-[#DDD5C9] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriceEdit(null)}
                className="flex-1 rounded-xl border border-[#DDD5C9] py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePriceOverride}
                className="flex-1 rounded-xl bg-[#C85A32] py-2 text-xs font-bold text-white"
              >
                Save Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
