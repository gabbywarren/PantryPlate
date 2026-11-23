import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Camera,
  ChefHat,
  Lock,
  Refrigerator,
  Settings,
  ShoppingCart,
} from "lucide-react";
import type {
  InboxScreenshot,
  PantryItem,
  PriceOverride,
  RecipeDetail,
  RecipeSummary,
  ShoppingListItem,
} from "../shared/types";
import { api } from "./api";
import { ImportRecipeView } from "./components/ImportRecipeView";
import { PantryView } from "./components/PantryView";
import { RecipeDetailView } from "./components/RecipeDetailView";
import { RecipeLibraryView } from "./components/RecipeLibraryView";
import { SettingsModal } from "./components/SettingsModal";
import { ShoppingListView } from "./components/ShoppingListView";

type TabId = "library" | "import" | "pantry" | "shop";

export function App() {
  const [authState, setAuthState] = useState<"checking" | "locked" | "ready">("checking");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>("library");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeDetail | null>(null);
  const [activeInboxItem, setActiveInboxItem] = useState<InboxScreenshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [shoppingTotalCents, setShoppingTotalCents] = useState(0);
  const [inboxItems, setInboxItems] = useState<InboxScreenshot[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, PriceOverride>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [recRes, panRes, shopRes, inbRes, priceRes] = await Promise.all([
        api.recipes.list(),
        api.pantry.list(),
        api.shopping.list(),
        api.inbox.list(),
        api.food.listPrices(),
      ]);
      setRecipes(recRes.recipes);
      setPantryItems(panRes.items);
      setShoppingItems(shopRes.items);
      setShoppingTotalCents(shopRes.totalEstimatedCents);
      setInboxItems(inbRes.items);
      const map: Record<string, PriceOverride> = {};
      for (const o of priceRes.overrides) map[o.canonicalName] = o;
      setPriceOverrides(map);
    } catch (err) {
      console.error("Failed to load app data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const status = await api.auth.status();
        if (status.pinRequired && !status.authenticated) {
          setAuthState("locked");
          return;
        }
        setAuthState("ready");
        await refreshAll();

        // Check if opened via Apple Shortcut URL (?tab=import&inbox=<id>)
        const params = new URLSearchParams(window.location.search);
        const inboxId = params.get("inbox");
        if (params.get("tab") === "import" || inboxId) {
          const inb = await api.inbox.list();
          const matched = inboxId ? inb.items.find((i) => i.id === inboxId) : undefined;
          if (matched) setActiveInboxItem(matched);
          setTab("import");
        }
      } catch {
        setAuthState("ready");
        await refreshAll();
      }
    }
    void init();
  }, [refreshAll]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    try {
      await api.auth.unlock(pinInput);
      setAuthState("ready");
      await refreshAll();
    } catch {
      setPinError("Incorrect PIN. Please try again.");
    }
  }

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4]">
        <ChefHat className="h-10 w-10 text-[#C85A32] animate-pulse" />
      </div>
    );
  }

  if (authState === "locked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] p-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-xs rounded-3xl bg-white border border-[#E8E2D9] p-6 shadow-md space-y-4 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF2EA] text-[#C85A32]">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-editorial text-2xl font-bold text-[#1E1C19]">PantryPlate</h1>
            <p className="text-xs text-[#635D54] mt-1">Enter your household PIN to unlock</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full rounded-2xl border border-[#DDD5C9] bg-[#FAF8F4] px-4 py-3 text-center text-lg tracking-[0.4em] focus:border-[#C85A32] focus:outline-none"
          />
          {pinError && <p className="text-xs text-rose-600 font-medium">{pinError}</p>}
          <button
            type="submit"
            className="w-full rounded-2xl bg-[#C85A32] py-3 text-sm font-bold text-white hover:bg-[#A84824]"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  const uncheckedShopCount = shoppingItems.filter((i) => !i.checked).length;

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1E1C19]">
      {/* Sticky Warm Editorial Header */}
      <header className="sticky top-0 z-30 border-b border-[#EAE3D9] bg-[#FAF8F4]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setSelectedRecipeId(null);
              setEditingRecipe(null);
              setTab("library");
            }}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C85A32] text-white shadow-xs">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <span className="font-editorial text-xl font-bold tracking-tight text-[#1E1C19] block leading-none">
                PantryPlate
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C8378]">
                Recipes • Pantry • Smart Shop
              </span>
            </div>
          </button>

          {/* Desktop Inline Navigation */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-[#EFEAE2] p-1">
            {[
              { id: "library", label: "Library", icon: BookOpen },
              { id: "import", label: "Import", icon: Camera },
              { id: "pantry", label: "Pantry", icon: Refrigerator },
              { id: "shop", label: "Shop", icon: ShoppingCart, badge: uncheckedShopCount },
            ].map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setSelectedRecipeId(null);
                  setEditingRecipe(null);
                  setActiveInboxItem(null);
                  setTab(nav.id as TabId);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  tab === nav.id && !selectedRecipeId
                    ? "bg-white text-[#1E1C19] shadow-xs"
                    : "text-[#635D54] hover:text-[#1E1C19]"
                }`}
              >
                <nav.icon className="h-3.5 w-3.5" />
                {nav.label}
                {nav.badge ? (
                  <span className="rounded-full bg-[#C85A32] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {nav.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-full p-2 text-[#635D54] hover:bg-[#EAE4DA]"
            aria-label="Open settings and iPhone Shortcut setup"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-5 pb-28 md:pb-12">
        {selectedRecipeId ? (
          <RecipeDetailView
            recipeId={selectedRecipeId}
            onBack={() => {
              setSelectedRecipeId(null);
              void refreshAll();
            }}
            onEdit={(recipe) => {
              setEditingRecipe(recipe);
              setSelectedRecipeId(null);
              setTab("import");
            }}
            onDeleted={async () => {
              setSelectedRecipeId(null);
              await refreshAll();
              showToast("Recipe deleted");
            }}
            onShoppingUpdated={async (msg) => {
              await refreshAll();
              showToast(msg);
            }}
          />
        ) : tab === "library" ? (
          <RecipeLibraryView
            recipes={recipes}
            inboxItems={inboxItems}
            loading={loading}
            onSelectRecipe={(id) => setSelectedRecipeId(id)}
            onOpenImport={(inbox) => {
              setEditingRecipe(null);
              setActiveInboxItem(inbox ?? null);
              setTab("import");
            }}
            onDismissInbox={async (id) => {
              await api.inbox.delete(id);
              await refreshAll();
            }}
            onSeedSamples={async () => {
              await api.recipes.seedSamples();
              await refreshAll();
              showToast("Loaded 3 sample recipes & starter pantry staples!");
            }}
          />
        ) : tab === "import" ? (
          <ImportRecipeView
            editingRecipe={editingRecipe}
            inboxItem={activeInboxItem}
            pantryItems={pantryItems}
            priceOverrides={priceOverrides}
            onSaved={async (recipeId) => {
              setEditingRecipe(null);
              setActiveInboxItem(null);
              await refreshAll();
              setSelectedRecipeId(recipeId);
              setTab("library");
              showToast("Recipe saved to your library!");
            }}
            onCancel={() => {
              setEditingRecipe(null);
              setActiveInboxItem(null);
              setTab("library");
            }}
          />
        ) : tab === "pantry" ? (
          <PantryView items={pantryItems} onRefresh={refreshAll} onToast={showToast} />
        ) : (
          <ShoppingListView
            items={shoppingItems}
            totalEstimatedCents={shoppingTotalCents}
            onRefresh={refreshAll}
            onToast={showToast}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-Friendly iPhone Layout) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#E6DFD5] bg-[#FAF8F4]/95 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-4 px-2 pt-2">
          {[
            { id: "library", label: "Library", icon: BookOpen },
            { id: "import", label: "Import", icon: Camera },
            { id: "pantry", label: "Pantry", icon: Refrigerator },
            { id: "shop", label: "Shop", icon: ShoppingCart, badge: uncheckedShopCount },
          ].map((nav) => {
            const active = tab === nav.id && !selectedRecipeId;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setSelectedRecipeId(null);
                  setEditingRecipe(null);
                  setActiveInboxItem(null);
                  setTab(nav.id as TabId);
                }}
                className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold transition ${
                  active ? "text-[#C85A32]" : "text-[#7A7268]"
                }`}
              >
                <div className="relative">
                  <nav.icon className="h-5 w-5" />
                  {nav.badge ? (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C85A32] px-1 text-[10px] font-bold text-white">
                      {nav.badge}
                    </span>
                  ) : null}
                </div>
                <span>{nav.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings & iPhone Shortcut Setup Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onDataChanged={refreshAll}
          onToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1E1C19] px-5 py-2.5 text-xs font-semibold text-white shadow-xl border border-white/10">
          {toast}
        </div>
      )}
    </div>
  );
}
