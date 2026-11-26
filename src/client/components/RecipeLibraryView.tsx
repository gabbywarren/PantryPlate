import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChefHat,
  Clock,
  DollarSign,
  Inbox,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import type { InboxScreenshot, RecipeSummary } from "../../shared/types";
import { NutritionBadge } from "./NutritionBadge";

interface Props {
  recipes: RecipeSummary[];
  inboxItems: InboxScreenshot[];
  loading: boolean;
  onSelectRecipe: (id: string) => void;
  onOpenImport: (inboxItem?: InboxScreenshot) => void;
  onOpenPantryChef: () => void;
  onDismissInbox: (id: string) => void;
  onSeedSamples: () => Promise<void>;
}

const CARD_PALETTES = [
  "from-[#F3E5D8] via-[#EBD6C3] to-[#DFC0A6]",
  "from-[#E3EFE6] via-[#D2E6D7] to-[#BED9C5]",
  "from-[#F5EBD7] via-[#EFE0BE] to-[#E5CE9E]",
  "from-[#E8E6F2] via-[#DCD8EC] to-[#CBC5E3]",
];

export function RecipeLibraryView({
  recipes,
  inboxItems,
  loading,
  onSelectRecipe,
  onOpenImport,
  onOpenPantryChef,
  onDismissInbox,
  onSeedSamples,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "can_cook" | "healthy" | "budget">("all");
  const [sort, setSort] = useState<"recent" | "nutrition" | "cost" | "pantry_match">("recent");
  const [seeding, setSeeding] = useState(false);

  const filtered = recipes
    .filter((r) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesText =
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.sourceHandle.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesText) return false;
      }
      if (filter === "can_cook" && r.pantrySummary.readyPct < 75) return false;
      if (filter === "healthy" && r.nutritionScore < 75) return false;
      if (filter === "budget" && r.estimatedCostCents > 1200) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "nutrition") return b.nutritionScore - a.nutritionScore;
      if (sort === "cost") return a.estimatedCostCents - b.estimatedCostCents;
      if (sort === "pantry_match") return b.pantrySummary.readyPct - a.pantrySummary.readyPct;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <div className="space-y-5">
      {/* Pending Screenshots from iPhone Shortcut Inbox */}
      {inboxItems.length > 0 && (
        <div className="rounded-2xl bg-[#FFF6EE] border border-[#F0D3BC] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#9C401D]">
              <Inbox className="h-4 w-4" />
              {inboxItems.length} Shared Screenshot{inboxItems.length > 1 ? "s" : ""} Ready to Import
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {inboxItems.map((item) => (
              <div
                key={item.id}
                className="flex shrink-0 items-center gap-2.5 rounded-xl bg-white p-2 pr-3 border border-[#EFE2D5] shadow-xs"
              >
                <img
                  src={item.imageUrl}
                  alt="Shared screenshot"
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#1E1C19] max-w-[130px] truncate">
                    {item.sourceNote || "iPhone Share"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenImport(item)}
                      className="rounded-full bg-[#C85A32] px-2.5 py-0.5 text-[11px] font-semibold text-white"
                    >
                      Extract Recipe
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissInbox(item.id)}
                      className="p-1 text-[#8C8378] hover:text-rose-600"
                      aria-label="Dismiss screenshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C8378]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes, tags, @creators…"
              className="w-full rounded-2xl border border-[#E4DDD2] bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-[#9A9186] focus:border-[#C85A32] focus:outline-none shadow-xs"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort recipes"
            className="rounded-2xl border border-[#E4DDD2] bg-white px-3 py-2.5 text-xs font-semibold text-[#524C44] focus:border-[#C85A32] focus:outline-none shadow-xs"
          >
            <option value="recent">Recent</option>
            <option value="pantry_match">Most in Pantry</option>
            <option value="nutrition">Top Nutrition</option>
            <option value="cost">Lowest Cost</option>
          </select>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={onOpenPantryChef}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#C85A32] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#A84824]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Cook From Pantry
          </button>
          {[
            { id: "all", label: "All Recipes" },
            { id: "can_cook", label: "Ready to Cook" },
            { id: "healthy", label: "Nutrition 75+" },
            { id: "budget", label: "Under $12" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id as typeof filter)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                filter === chip.id
                  ? "bg-[#1E1C19] text-white border-[#1E1C19]"
                  : "bg-white text-[#635D54] border-[#E4DDD2] hover:border-[#C85A32]/50"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Library Grid or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 rounded-3xl bg-white border border-[#EAE3D9] animate-pulse"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#E8E2D9] p-8 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FAF2EA] text-[#C85A32]">
            <ChefHat className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="font-editorial text-2xl font-bold text-[#1E1C19]">
              Your Recipe Library Awaits
            </h2>
            <p className="text-sm text-[#635D54] leading-relaxed">
              Upload screenshots from Instagram or recipe blogs to turn them into clean, cook-ready
              cards with Yuka-style nutrition scores, estimated cooking costs, and pantry-smart
              shopping lists.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenImport()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#C85A32] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#A84824]"
            >
              <Camera className="h-4 w-4" />
              Import Screenshot
            </button>
            <button
              type="button"
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                try {
                  await onSeedSamples();
                } finally {
                  setSeeding(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#DED6CA] bg-[#FAF8F4] px-5 py-3 text-sm font-semibold text-[#1E1C19] hover:bg-[#F3EFE8] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-[#C85A32]" />
              {seeding ? "Loading Samples…" : "Load 3 Sample Recipes"}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E8E2D9] p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#1E1C19]">No recipes match your filters</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-xs font-semibold text-[#C85A32] hover:underline"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe, idx) => {
            const totalMin = recipe.prepMinutes + recipe.cookMinutes;
            const palette = CARD_PALETTES[idx % CARD_PALETTES.length];
            const allInPantry =
              recipe.pantrySummary.totalCount > 0 &&
              recipe.pantrySummary.haveCount === recipe.pantrySummary.totalCount;

            return (
              <article
                key={recipe.id}
                onClick={() => onSelectRecipe(recipe.id)}
                className="group cursor-pointer overflow-hidden rounded-3xl bg-white border border-[#EAE3D9] shadow-xs transition hover:shadow-md hover:border-[#D9CFC1] flex flex-col"
              >
                {/* Card Visual Header */}
                <div className="relative h-40 overflow-hidden">
                  {recipe.coverImageUrl ? (
                    <img
                      src={recipe.coverImageUrl}
                      alt={recipe.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className={`h-full w-full bg-gradient-to-br ${palette} flex items-center justify-center relative`}
                    >
                      <ChefHat className="h-12 w-12 text-[#1E1C19]/15" />
                      {recipe.sourceHandle && (
                        <span className="absolute bottom-2.5 left-3 rounded-full bg-white/80 backdrop-blur px-2.5 py-0.5 text-[11px] font-semibold text-[#524C44]">
                          {recipe.sourceHandle}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Top-left Nutrition Score Pill */}
                  <div className="absolute top-3 left-3 shadow-xs rounded-full">
                    <NutritionBadge
                      score={recipe.nutritionScore}
                      grade={recipe.nutritionGrade}
                    />
                  </div>

                  {/* Top-right Estimated Cost Pill */}
                  <div className="absolute top-3 right-3 inline-flex items-center gap-0.5 rounded-full bg-[#1E1C19]/85 backdrop-blur px-2.5 py-1 text-xs font-bold text-white">
                    <DollarSign className="h-3 w-3 text-[#F2B880]" />
                    <span>{formatCents(recipe.estimatedCostCents).replace("$", "")}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="font-editorial text-lg font-bold text-[#1E1C19] leading-snug line-clamp-2 group-hover:text-[#C85A32] transition-colors">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-xs text-[#635D54] line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-[#635D54]">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#8C8378]" />
                          {totalMin} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#8C8378]" />
                          {recipe.servings} srv
                        </span>
                      </div>
                      <span className="font-semibold text-[#524C44]">
                        {formatCents(recipe.costPerServingCents)}/srv
                      </span>
                    </div>

                    {/* Pantry Readiness Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-semibold inline-flex items-center gap-1 ${
                            allInPantry ? "text-emerald-700" : "text-[#635D54]"
                          }`}
                        >
                          {allInPantry && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          {recipe.pantrySummary.haveCount}/{recipe.pantrySummary.totalCount} in
                          pantry
                        </span>
                        {recipe.pantrySummary.missingCostCents > 0 ? (
                          <span className="text-[#9C401D] font-semibold">
                            ~{formatCents(recipe.pantrySummary.missingCostCents)} to buy
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Ready now</span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#EFEAE2] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            allInPantry ? "bg-emerald-500" : "bg-[#C85A32]"
                          }`}
                          style={{ width: `${recipe.pantrySummary.readyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Quick Add Card */}
          <button
            type="button"
            onClick={() => onOpenImport()}
            className="min-h-[220px] rounded-3xl border-2 border-dashed border-[#DDD5C9] bg-[#FAF8F4]/60 hover:bg-white hover:border-[#C85A32]/60 flex flex-col items-center justify-center gap-2 p-6 text-[#635D54] hover:text-[#C85A32] transition"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-[#E4DDD2] shadow-xs">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold">Import Another Recipe</span>
            <span className="text-xs text-[#8C8378]">Screenshot, Instagram caption, or manual</span>
          </button>
        </div>
      )}
    </div>
  );
}
