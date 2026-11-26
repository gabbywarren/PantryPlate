import { useEffect, useState } from "react";
import {
  Flame,
  Package,
  Plus,
  Refrigerator,
  ScanBarcode,
  Search,
  Snowflake,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import type { PantryItem, StockStatus, StorageLocation } from "../../shared/types";
import { formatQuantity } from "../../shared/unitConverter";
import { api } from "../api";
import { BarcodeScannerModal } from "./BarcodeScannerModal";

interface Props {
  items: PantryItem[];
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
  onOpenPantryChef: () => void;
}

const LOCATION_META: { id: "all" | StorageLocation; label: string; icon: typeof Package }[] = [
  { id: "all", label: "All", icon: Package },
  { id: "fridge", label: "Fridge", icon: Refrigerator },
  { id: "pantry", label: "Pantry", icon: Package },
  { id: "freezer", label: "Freezer", icon: Snowflake },
  { id: "spices", label: "Spices & Oils", icon: Flame },
];

export function PantryView({ items, onRefresh, onToast, onOpenPantryChef }: Props) {
  const [locationFilter, setLocationFilter] = useState<"all" | StorageLocation>("all");
  const [searchText, setSearchText] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Quick-add state with staple suggestions
  const [quickName, setQuickName] = useState("");
  const [quickQty, setQuickQty] = useState("1");
  const [quickUnit, setQuickUnit] = useState("each");
  const [quickLoc, setQuickLoc] = useState<StorageLocation>("fridge");
  const [suggestions, setSuggestions] = useState<
    { name: string; canonicalName: string; defaultLocation: StorageLocation; priceUnit: string }[]
  >([]);

  useEffect(() => {
    if (quickName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.food.search(quickName);
        setSuggestions(res.staples.slice(0, 5));
      } catch { /* ignore */ }
    }, 180);
    return () => clearTimeout(timer);
  }, [quickName]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickName.trim()) return;
    const qtyNum = parseFloat(quickQty);
    await api.pantry.create({
      name: quickName.trim(),
      location: quickLoc,
      quantity: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : null,
      unit: quickUnit.trim() || "each",
      stockStatus: "in_stock",
    });
    setQuickName("");
    setSuggestions([]);
    await onRefresh();
    onToast(`Added ${quickName.trim()} to ${quickLoc}`);
  }

  async function cycleStatus(item: PantryItem) {
    const order: StockStatus[] = ["in_stock", "low", "out"];
    const next = order[(order.indexOf(item.stockStatus) + 1) % order.length];
    await api.pantry.update(item.id, { stockStatus: next });
    await onRefresh();
  }

  async function handleDelete(item: PantryItem) {
    await api.pantry.delete(item.id);
    await onRefresh();
    onToast(`Removed ${item.name}`);
  }

  const filtered = items.filter((item) => {
    if (locationFilter !== "all" && item.location !== locationFilter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.canonicalName.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header + Prominent Scan Barcode CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-[#1E1C19]">Pantry &amp; Fridge</h2>
          <p className="text-xs text-[#635D54]">
            Track what you have at home so recipe shopping lists skip what you already own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPantryChef}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#1E1C19] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#33302B]"
          >
            <Sparkles className="h-4 w-4 text-[#F2B880]" />
            Create Recipes
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#C85A32] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#A84824]"
          >
            <ScanBarcode className="h-4 w-4" />
            Scan Barcode
          </button>
        </div>
      </div>

      {/* Quick Add Staple Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="rounded-3xl bg-white border border-[#EAE3D9] p-4 space-y-3 shadow-xs relative"
      >
        <div className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
          Quick Add Produce or Pantry Staple
        </div>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-span-5 relative">
            <input
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g. Chicken breast, spinach, eggs…"
              className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3.5 py-2.5 text-sm focus:border-[#C85A32] focus:outline-none"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl bg-white border border-[#E4DDD2] shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.canonicalName}
                    type="button"
                    onClick={() => {
                      setQuickName(s.name);
                      setQuickLoc(s.defaultLocation);
                      setQuickUnit(s.priceUnit);
                      setSuggestions([]);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-[#FAF8F4]"
                  >
                    <span className="font-semibold capitalize text-[#1E1C19]">{s.name}</span>
                    <span className="text-[11px] text-[#8C8378] capitalize">
                      {s.defaultLocation} • {s.priceUnit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            step="0.25"
            value={quickQty}
            onChange={(e) => setQuickQty(e.target.value)}
            placeholder="Qty"
            className="col-span-3 sm:col-span-2 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2.5 py-2.5 text-sm"
          />
          <input
            type="text"
            value={quickUnit}
            onChange={(e) => setQuickUnit(e.target.value)}
            placeholder="unit"
            className="col-span-4 sm:col-span-2 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2.5 py-2.5 text-sm"
          />
          <select
            value={quickLoc}
            onChange={(e) => setQuickLoc(e.target.value as StorageLocation)}
            aria-label="Storage location"
            className="col-span-5 sm:col-span-2 rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-2 py-2.5 text-xs font-semibold capitalize"
          >
            <option value="fridge">Fridge</option>
            <option value="pantry">Pantry</option>
            <option value="freezer">Freezer</option>
            <option value="spices">Spices</option>
          </select>
          <button
            type="submit"
            className="col-span-12 sm:col-span-1 inline-flex items-center justify-center rounded-xl bg-[#1E1C19] py-2.5 text-white hover:bg-[#33302B]"
            aria-label="Add pantry item"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Location Filter Pills + Search */}
      <div className="space-y-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {LOCATION_META.map((loc) => {
            const count =
              loc.id === "all"
                ? items.length
                : items.filter((i) => i.location === loc.id).length;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setLocationFilter(loc.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                  locationFilter === loc.id
                    ? "bg-[#1E1C19] text-white border-[#1E1C19]"
                    : "bg-white text-[#635D54] border-[#E4DDD2]"
                }`}
              >
                <loc.icon className="h-3.5 w-3.5" />
                {loc.label}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C8378]" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Filter your pantry & fridge…"
              className="w-full rounded-2xl border border-[#E4DDD2] bg-white pl-10 pr-4 py-2 text-sm focus:border-[#C85A32] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Pantry List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] p-8 text-center space-y-3">
          <Package className="h-8 w-8 mx-auto text-[#B7AEA2]" />
          <p className="text-sm font-semibold text-[#1E1C19]">
            {items.length === 0 ? "Your pantry & fridge list is empty" : "No matching items"}
          </p>
          <p className="text-xs text-[#635D54] max-w-sm mx-auto">
            Scan a packaged food barcode with your iPhone camera or type fresh produce above to
            start syncing with your recipe shopping lists.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] divide-y divide-[#F2EDE5] overflow-hidden">
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-11 w-11 rounded-xl object-contain bg-[#FAF8F4] border border-[#EFEAE2] p-0.5 shrink-0"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FAF8F4] border border-[#EFEAE2] text-[#8C8378]">
                  {item.location === "fridge" ? (
                    <Refrigerator className="h-5 w-5" />
                  ) : item.location === "freezer" ? (
                    <Snowflake className="h-5 w-5" />
                  ) : (
                    <Package className="h-5 w-5" />
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1E1C19] truncate capitalize">
                    {item.name}
                  </span>
                  {item.barcode && (
                    <span className="rounded bg-[#F3EFE8] px-1.5 py-0.5 text-[10px] font-mono text-[#635D54]">
                      UPC
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#635D54] flex flex-wrap items-center gap-x-2">
                  <span className="capitalize">{item.location}</span>
                  {item.quantity !== null && (
                    <span>
                      • {formatQuantity(item.quantity)} {item.unit}
                    </span>
                  )}
                  {item.unitPriceCents && (
                    <span>
                      • {formatCents(item.unitPriceCents)}/{item.priceUnit || "ea"}
                    </span>
                  )}
                  <span className="text-[#9A9186]">• matches &ldquo;{item.canonicalName}&rdquo;</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void cycleStatus(item)}
                title="Tap to cycle stock status"
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                  item.stockStatus === "in_stock"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : item.stockStatus === "low"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {item.stockStatus === "in_stock"
                  ? "In Stock"
                  : item.stockStatus === "low"
                    ? "Running Low"
                    : "Out"}
              </button>

              <button
                type="button"
                onClick={() => void handleDelete(item)}
                className="p-1.5 text-[#9A9186] hover:text-rose-600"
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showScanner && (
        <BarcodeScannerModal
          onClose={() => setShowScanner(false)}
          onAddedToPantry={async (productName) => {
            await onRefresh();
            onToast(`Scanned & added ${productName} to pantry`);
          }}
        />
      )}
    </div>
  );
}
