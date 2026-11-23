import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { calculateRecipeCost, formatCents } from "../../shared/costEstimator";
import { canonicalizeIngredientName, guessAisle } from "../../shared/foodDatabase";
import { calculateRecipeNutrition } from "../../shared/nutritionScore";
import { parseIngredientLine, parseRecipeText } from "../../shared/recipeParser";
import type {
  InboxScreenshot,
  IngredientInput,
  PantryItem,
  PriceOverride,
  RecipeDetail,
} from "../../shared/types";
import { api } from "../api";
import { extractTextFromScreenshots } from "../lib/ocr";
import { NutritionBadge } from "./NutritionBadge";

interface Props {
  editingRecipe?: RecipeDetail | null;
  inboxItem?: InboxScreenshot | null;
  pantryItems: PantryItem[];
  priceOverrides: Record<string, PriceOverride>;
  onSaved: (recipeId: string) => void;
  onCancel?: () => void;
}

interface UploadedScreenshot {
  imageKey: string;
  imageUrl: string;
  ocrText: string;
}

export function ImportRecipeView({
  editingRecipe,
  inboxItem,
  pantryItems,
  priceOverrides,
  onSaved,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<"screenshot" | "paste" | "manual">(
    editingRecipe ? "manual" : "screenshot"
  );
  const [rawPasteText, setRawPasteText] = useState("");
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>(() =>
    editingRecipe
      ? editingRecipe.screenshots.map((s) => ({
          imageKey: s.imageKey,
          imageUrl: s.imageUrl,
          ocrText: s.ocrText,
        }))
      : []
  );
  const [showRefImage, setShowRefImage] = useState(true);
  const [ocrProgress, setOcrProgress] = useState<{ pct: number; label: string } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Structured recipe state
  const [title, setTitle] = useState(editingRecipe?.title ?? "");
  const [description, setDescription] = useState(editingRecipe?.description ?? "");
  const [sourceHandle, setSourceHandle] = useState(editingRecipe?.sourceHandle ?? "");
  const [sourceUrl, setSourceUrl] = useState(editingRecipe?.sourceUrl ?? "");
  const [servings, setServings] = useState(editingRecipe?.servings ?? 4);
  const [prepMinutes, setPrepMinutes] = useState(editingRecipe?.prepMinutes ?? 10);
  const [cookMinutes, setCookMinutes] = useState(editingRecipe?.cookMinutes ?? 20);
  const [tagsText, setTagsText] = useState(editingRecipe?.tags.join(", ") ?? "");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(
    editingRecipe?.coverImageKey ?? null
  );
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(
    editingRecipe?.coverImageUrl ?? null
  );
  const [ingredients, setIngredients] = useState<IngredientInput[]>(() =>
    editingRecipe
      ? editingRecipe.ingredients.map((i) => ({
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          canonicalName: i.canonicalName,
          aisle: i.aisle,
          notes: i.notes,
          rawText: i.rawText,
        }))
      : []
  );
  const [steps, setSteps] = useState<string[]>(() =>
    editingRecipe ? editingRecipe.steps.map((s) => s.instruction) : []
  );
  const [quickIngLine, setQuickIngLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-run OCR when arriving from an iPhone Shortcut Inbox screenshot
  useEffect(() => {
    if (!inboxItem) return;
    let cancelled = false;
    async function runInboxOcr() {
      if (!inboxItem) return;
      setMode("screenshot");
      setError(null);
      setOcrProgress({ pct: 10, label: "Loading shared iPhone screenshot…" });
      try {
        const texts = await extractTextFromScreenshots([inboxItem.imageUrl], (pct, label) => {
          if (!cancelled) setOcrProgress({ pct, label });
        });
        if (cancelled) return;
        const ocrText = texts[0] ?? "";
        setScreenshots([
          { imageKey: inboxItem.imageKey, imageUrl: inboxItem.imageUrl, ocrText },
        ]);
        applyParsedText(ocrText);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "OCR failed on shared screenshot");
        }
      } finally {
        if (!cancelled) setOcrProgress(null);
      }
    }
    void runInboxOcr();
    return () => {
      cancelled = true;
    };
  }, [inboxItem?.id]);

  function applyParsedText(text: string) {
    if (!text.trim()) return;
    const draft = parseRecipeText(text);
    setTitle((prev) => prev || draft.title);
    if (draft.description) setDescription((prev) => prev || draft.description);
    if (draft.sourceHandle) setSourceHandle((prev) => prev || draft.sourceHandle);
    setServings(draft.servings);
    setPrepMinutes(draft.prepMinutes);
    setCookMinutes(draft.cookMinutes);
    if (draft.tags.length > 0) {
      setTagsText((prev) => prev || draft.tags.join(", "));
    }
    if (draft.ingredients.length > 0) {
      setIngredients((prev) => (prev.length > 0 ? [...prev, ...draft.ingredients] : draft.ingredients));
    }
    if (draft.steps.length > 0) {
      setSteps((prev) => (prev.length > 0 ? [...prev, ...draft.steps] : draft.steps));
    }
  }

  async function handleScreenshotsSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const fileArr = Array.from(files).slice(0, 6);
    setOcrProgress({ pct: 5, label: `Uploading ${fileArr.length} screenshot(s)…` });

    try {
      // Upload to R2 & run local client-side OCR in parallel
      const [uploaded, ocrTexts] = await Promise.all([
        Promise.all(fileArr.map((f) => api.recipes.uploadImage(f, "screenshot"))),
        extractTextFromScreenshots(fileArr, (pct, label) => {
          setOcrProgress({ pct, label });
        }),
      ]);

      const newItems: UploadedScreenshot[] = uploaded.map((u, idx) => ({
        imageKey: u.imageKey,
        imageUrl: u.imageUrl,
        ocrText: ocrTexts[idx] ?? "",
      }));

      setScreenshots((prev) => [...prev, ...newItems]);
      const combinedText = ocrTexts.filter(Boolean).join("\n\n");
      setRawPasteText((prev) => (prev ? `${prev}\n\n${combinedText}` : combinedText));
      applyParsedText(combinedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process screenshots");
    } finally {
      setOcrProgress(null);
    }
  }

  async function handleCoverSelected(files: FileList | null) {
    if (!files || !files[0]) return;
    setUploadingCover(true);
    try {
      const res = await api.recipes.uploadImage(files[0], "cover");
      setCoverImageKey(res.imageKey);
      setCoverPreviewUrl(res.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload cover photo");
    } finally {
      setUploadingCover(false);
    }
  }

  // Live nutrition & cost preview while editing!
  const liveMetrics = useMemo(() => {
    const validIngs = ingredients.filter((i) => i.name.trim().length > 0);
    const nutrition = calculateRecipeNutrition(validIngs, servings);
    const cost = calculateRecipeCost(validIngs, servings, priceOverrides, pantryItems);
    return { nutrition, cost };
  }, [ingredients, servings, priceOverrides, pantryItems]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a recipe title before saving.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const cleanIngredients = ingredients
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          ...i,
          canonicalName: canonicalizeIngredientName(i.name),
          aisle: i.aisle || guessAisle(i.name),
        }));

      const payload = {
        title: title.trim(),
        description: description.trim(),
        sourceUrl: sourceUrl.trim(),
        sourceHandle: sourceHandle.trim(),
        servings: Math.max(1, Number(servings) || 4),
        prepMinutes: Math.max(0, Number(prepMinutes) || 0),
        cookMinutes: Math.max(0, Number(cookMinutes) || 0),
        coverImageKey,
        tags: tagsText
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        ingredients: cleanIngredients,
        steps: steps.map((s) => s.trim()).filter(Boolean),
        screenshots: screenshots.map((s) => ({ imageKey: s.imageKey, ocrText: s.ocrText })),
        inboxId: inboxItem?.id,
      };

      const saved = editingRecipe
        ? await api.recipes.update(editingRecipe.id, payload)
        : await api.recipes.create(payload);

      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-[#1E1C19]">
            {editingRecipe ? "Edit Recipe" : "Import Recipe"}
          </h2>
          <p className="text-xs text-[#635D54]">
            Extract from Instagram/web screenshots locally (no API key needed) or paste text.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white border border-[#E4DDD2] px-3.5 py-1.5 text-xs font-semibold text-[#524C44]"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      {!editingRecipe && (
        <div className="grid grid-cols-3 rounded-2xl bg-[#EFEAE2] p-1">
          {[
            { id: "screenshot", label: "Screenshots", icon: Camera },
            { id: "paste", label: "Paste Text", icon: ClipboardPaste },
            { id: "manual", label: "Manual", icon: FileText },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id as typeof mode)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                mode === m.id
                  ? "bg-white text-[#1E1C19] shadow-xs"
                  : "text-[#635D54] hover:text-[#1E1C19]"
              }`}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* SCREENSHOT OCR UPLOAD ZONE */}
      {mode === "screenshot" && (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] p-5 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D8CFC2] bg-[#FAF8F4] p-6 text-center cursor-pointer hover:border-[#C85A32] transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF2E8] text-[#C85A32]">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-[#1E1C19]">
                Tap to select Instagram or recipe screenshot(s)
              </p>
              <p className="text-xs text-[#635D54]">
                Select multiple slides at once (e.g. ingredients + instructions). Local OCR runs
                right on your device.
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleScreenshotsSelected(e.target.files)}
            />
          </label>

          {ocrProgress && (
            <div className="rounded-2xl bg-[#FFF8F2] border border-[#F2DAC4] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#9C401D]">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {ocrProgress.label}
                </span>
                <span>{ocrProgress.pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#F3E2D2] overflow-hidden">
                <div
                  className="h-full bg-[#C85A32] transition-all duration-300"
                  style={{ width: `${ocrProgress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASTE TEXT MODE */}
      {mode === "paste" && (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] p-5 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#8C8378]">
            Paste Instagram Caption or Recipe Text
          </label>
          <textarea
            rows={6}
            value={rawPasteText}
            onChange={(e) => setRawPasteText(e.target.value)}
            placeholder={`Creamy Garlic Tuscan Chicken\nServes 4 | Prep: 10 min | Cook: 20 min\n\nIngredients:\n1.5 lb chicken breast\n2 tbsp olive oil\n4 cloves garlic, minced\n1 cup heavy cream\n2 cups baby spinach\n\nInstructions:\n1. Sear chicken in olive oil until golden.\n2. Stir in garlic, cream, and spinach until wilted.`}
            className="w-full rounded-2xl border border-[#DDD5C9] bg-[#FAF8F4] p-3.5 text-sm leading-relaxed focus:border-[#C85A32] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setIngredients([]);
              setSteps([]);
              applyParsedText(rawPasteText);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E1C19] px-4 py-2 text-xs font-bold text-white hover:bg-[#33302B]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#F2B880]" />
            Parse Into Clean Recipe Card
          </button>
        </div>
      )}

      {/* COLLAPSIBLE ORIGINAL SCREENSHOT REFERENCE */}
      {screenshots.length > 0 && (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRefImage((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-[#524C44] bg-[#FAF8F4]"
          >
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-[#C85A32]" />
              Original Screenshot Reference ({screenshots.length}) — tap to compare while editing
            </span>
            {showRefImage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showRefImage && (
            <div className="p-3 flex gap-3 overflow-x-auto bg-[#1E1C19]/5">
              {screenshots.map((ss, idx) => (
                <div key={ss.imageKey} className="relative shrink-0 space-y-1.5">
                  <img
                    src={ss.imageUrl}
                    alt={`Uploaded screenshot ${idx + 1}`}
                    className="h-64 rounded-2xl border border-[#DDD5C9] object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageKey(ss.imageKey);
                      setCoverPreviewUrl(ss.imageUrl);
                    }}
                    className="block w-full rounded-xl bg-white border border-[#DDD5C9] py-1 text-[11px] font-semibold text-[#524C44] hover:border-[#C85A32]"
                  >
                    Use as Card Photo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIVE NUTRITION & COST PREVIEW BAR */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#1E1C19] px-4 py-3 text-white shadow-md">
        <div className="flex items-center gap-3">
          <NutritionBadge
            score={liveMetrics.nutrition.score}
            grade={liveMetrics.nutrition.grade}
          />
          <div className="text-xs">
            <span className="font-bold text-[#F2B880]">
              ~{formatCents(liveMetrics.cost.totalCents)}
            </span>
            <span className="text-white/70 ml-1">
              ({formatCents(liveMetrics.cost.perServingCents)}/srv)
            </span>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C85A32] px-4 py-2 text-xs font-bold text-white hover:bg-[#D86940] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {editingRecipe ? "Save Changes" : "Save to Library"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* STRUCTURED RECIPE FORM */}
      <div className="rounded-3xl bg-white border border-[#EAE3D9] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
          Recipe Details
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#524C44] mb-1">Recipe Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lemon Herb Salmon & Quinoa Bowl"
              className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3.5 py-2.5 text-sm font-semibold focus:border-[#C85A32] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524C44] mb-1">Short Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional one-line note"
              className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3.5 py-2 text-sm focus:border-[#C85A32] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#524C44] mb-1">Servings</label>
              <input
                type="number"
                min={1}
                max={32}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524C44] mb-1">Prep (min)</label>
              <input
                type="number"
                min={0}
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524C44] mb-1">Cook (min)</label>
              <input
                type="number"
                min={0}
                value={cookMinutes}
                onChange={(e) => setCookMinutes(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#524C44] mb-1">
                Creator / Source (@handle)
              </label>
              <input
                type="text"
                value={sourceHandle}
                onChange={(e) => setSourceHandle(e.target.value)}
                placeholder="@instagramchef"
                className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524C44] mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="weeknight, high-protein, pasta"
                className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Optional Dish Cover Photo */}
          <div className="flex items-center gap-3 pt-1">
            {coverPreviewUrl ? (
              <img
                src={coverPreviewUrl}
                alt="Cover preview"
                className="h-14 w-14 rounded-xl object-cover border border-[#DDD5C9]"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-[#FAF8F4] border border-dashed border-[#D8CFC2] flex items-center justify-center text-[#9A9186]">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD5C9] bg-white px-3.5 py-2 text-xs font-semibold text-[#524C44] cursor-pointer hover:border-[#C85A32]">
              {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {coverPreviewUrl ? "Change Dish Photo" : "Upload Dish Cover Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleCoverSelected(e.target.files)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* STRUCTURED INGREDIENTS EDITOR */}
      <div className="rounded-3xl bg-white border border-[#EAE3D9] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
            Ingredients ({ingredients.length})
          </h3>
          <span className="text-[11px] text-[#8C8378]">Auto-matched to pantry &amp; cost</span>
        </div>

        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
              <input
                type="number"
                step="0.125"
                value={ing.quantity ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                  );
                }}
                placeholder="Qty"
                className="col-span-2 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2 py-2 text-xs"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item))
                  )
                }
                placeholder="unit"
                className="col-span-3 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2 py-2 text-xs"
              />
              <input
                type="text"
                value={ing.name}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) =>
                      i === idx
                        ? {
                            ...item,
                            name: e.target.value,
                            canonicalName: canonicalizeIngredientName(e.target.value),
                            aisle: guessAisle(e.target.value),
                          }
                        : item
                    )
                  )
                }
                placeholder="Ingredient name"
                className="col-span-6 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2.5 py-2 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
                className="col-span-1 flex justify-center text-[#9A9186] hover:text-rose-600"
                aria-label="Remove ingredient"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Quick Natural-Language Ingredient Adder */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={quickIngLine}
            onChange={(e) => setQuickIngLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickIngLine.trim()) {
                e.preventDefault();
                setIngredients((prev) => [...prev, parseIngredientLine(quickIngLine)]);
                setQuickIngLine("");
              }
            }}
            placeholder='Add line e.g. "2 tbsp olive oil" or "1.5 lb chicken breast"'
            className="flex-1 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-xs focus:border-[#C85A32] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!quickIngLine.trim()) {
                setIngredients((prev) => [
                  ...prev,
                  { quantity: 1, unit: "each", name: "", canonicalName: "", aisle: "Pantry & Grains" },
                ]);
                return;
              }
              setIngredients((prev) => [...prev, parseIngredientLine(quickIngLine)]);
              setQuickIngLine("");
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-[#EFEAE2] px-3 py-2 text-xs font-bold text-[#1E1C19] hover:bg-[#E4DDD2]"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      {/* STEPS EDITOR */}
      <div className="rounded-3xl bg-white border border-[#EAE3D9] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
            Cooking Steps ({steps.length})
          </h3>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, ""])}
            className="inline-flex items-center gap-1 rounded-full bg-[#EFEAE2] px-3 py-1 text-xs font-bold text-[#1E1C19]"
          >
            <Plus className="h-3.5 w-3.5" /> Add Step
          </button>
        </div>

        <div className="space-y-2.5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAF2EA] text-xs font-extrabold text-[#C85A32]">
                {idx + 1}
              </span>
              <textarea
                rows={2}
                value={step}
                onChange={(e) =>
                  setSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                }
                placeholder={`Step ${idx + 1} instructions…`}
                className="flex-1 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm leading-relaxed focus:border-[#C85A32] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                className="mt-2 text-[#9A9186] hover:text-rose-600"
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
