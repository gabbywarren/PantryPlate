import { useMemo, useState } from "react";
import {
  Check,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import type { GroceryAisle, ShoppingListItem } from "../../shared/types";
import { formatQuantity } from "../../shared/unitConverter";
import { api } from "../api";

interface Props {
  items: ShoppingListItem[];
  totalEstimatedCents: number;
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

const AISLE_ORDER: GroceryAisle[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry & Grains",
  "Canned & Jarred",
  "Spices & Oils",
  "Frozen",
  "Other",
];

export function ShoppingListView({ items, totalEstimatedCents, onRefresh, onToast }: Props) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("each");
  const [moving, setMoving] = useState(false);

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);

  const groupedByAisle = useMemo(() => {
    const map = new Map<GroceryAisle, ShoppingListItem[]>();
    for (const item of uncheckedItems) {
      const list = map.get(item.aisle) ?? [];
      list.push(item);
      map.set(item.aisle, list);
    }
    return AISLE_ORDER.filter((a) => map.has(a)).map((aisle) => ({
      aisle,
      items: map.get(aisle)!,
    }));
  }, [uncheckedItems]);

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const qty = parseFloat(newItemQty);
    await api.shopping.addManual({
      name: newItemName.trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit: newItemUnit.trim() || "each",
    });
    setNewItemName("");
    await onRefresh();
  }

  async function toggleChecked(item: ShoppingListItem) {
    await api.shopping.patch(item.id, { checked: !item.checked });
    await onRefresh();
  }

  async function handleMoveCheckedToPantry() {
    setMoving(true);
    try {
      const res = await api.shopping.moveCheckedToPantry();
      await onRefresh();
      onToast(
        res.movedCount > 0
          ? `Moved ${res.movedCount} purchased item${res.movedCount > 1 ? "s" : ""} to Pantry & Fridge!`
          : "All checked items are already in your pantry."
      );
    } finally {
      setMoving(false);
    }
  }

  async function handleClearChecked() {
    await api.shopping.clearChecked();
    await onRefresh();
    onToast("Cleared checked items");
  }

  return (
    <div className="space-y-5">
      {/* Header + Estimated Store Total */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-[#1E1C19]">Store Shopping List</h2>
          <p className="text-xs text-[#635D54]">
            Grouped by grocery aisle. Pantry items are automatically skipped when adding recipes.
          </p>
        </div>
        <div className="rounded-2xl bg-[#1E1C19] px-4 py-2.5 text-white text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/65 font-semibold">
            Remaining Est.
          </div>
          <div className="text-base font-extrabold text-[#F2B880]">
            {formatCents(totalEstimatedCents)}
          </div>
        </div>
      </div>

      {/* Quick Manual Add */}
      <form onSubmit={handleAddManual} className="flex gap-2">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Add extra item (e.g. oat milk, bananas)…"
          className="flex-1 rounded-2xl border border-[#E4DDD2] bg-white px-4 py-2.5 text-sm focus:border-[#C85A32] focus:outline-none shadow-xs"
        />
        <input
          type="number"
          step="0.5"
          value={newItemQty}
          onChange={(e) => setNewItemQty(e.target.value)}
          aria-label="Quantity"
          className="w-16 rounded-2xl border border-[#E4DDD2] bg-white px-2.5 py-2.5 text-sm text-center shadow-xs"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-2xl bg-[#C85A32] px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#A84824]"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {/* Active Aisle Groups */}
      {items.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#EAE3D9] p-8 text-center space-y-3">
          <ShoppingCart className="h-9 w-9 mx-auto text-[#B7AEA2]" />
          <h3 className="font-editorial text-lg font-bold text-[#1E1C19]">
            Your store list is empty
          </h3>
          <p className="text-xs text-[#635D54] max-w-sm mx-auto leading-relaxed">
            Open any recipe in your Library and tap <strong>Add Missing to Store List</strong>—only
            the ingredients you don&apos;t have in your Pantry/Fridge will appear here!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByAisle.map((group) => (
            <section
              key={group.aisle}
              className="rounded-3xl bg-white border border-[#EAE3D9] overflow-hidden shadow-xs"
            >
              <div className="flex items-center justify-between bg-[#FAF8F4] px-4 py-2.5 border-b border-[#EFEAE2]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#635D54]">
                  {group.aisle}
                </h3>
                <span className="text-[11px] font-semibold text-[#8C8378]">
                  {group.items.length} item{group.items.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-[#F2EDE5]">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => void toggleChecked(item)}
                      className="flex flex-1 items-center gap-3.5 text-left"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#CFC6B9] bg-white" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[#1E1C19]">
                          {item.quantity !== null && `${formatQuantity(item.quantity)} `}
                          {item.unit && item.unit !== "each" ? `${item.unit} ` : ""}
                          {item.name}
                        </div>
                        {item.recipeTitle && (
                          <div className="text-[11px] text-[#8C8378] truncate">
                            For: {item.recipeTitle}
                          </div>
                        )}
                      </div>
                    </button>
                    <span className="text-xs font-semibold text-[#635D54]">
                      {formatCents(item.estimatedCostCents)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.shopping.delete(item.id);
                        await onRefresh();
                      }}
                      className="p-1 text-[#B2A99E] hover:text-rose-600"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* In Cart / Checked Section */}
          {checkedItems.length > 0 && (
            <section className="rounded-3xl bg-[#F4F8F5] border border-emerald-200/80 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-emerald-200/60">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  In Cart ({checkedItems.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={moving}
                    onClick={handleMoveCheckedToPantry}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />
                    {moving ? "Restocking…" : "Move to Pantry"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearChecked}
                    className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#635D54] border border-[#DDD5C9]"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="divide-y divide-emerald-200/50">
                {checkedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void toggleChecked(item)}
                    className="w-full flex items-center gap-3.5 px-4 py-3 text-left opacity-75"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <Check className="h-4 w-4 stroke-[3]" />
                    </span>
                    <span className="flex-1 text-sm font-medium line-through text-[#524C44]">
                      {item.quantity !== null && `${formatQuantity(item.quantity)} `}
                      {item.unit && item.unit !== "each" ? `${item.unit} ` : ""}
                      {item.name}
                    </span>
                    {item.addedToPantry && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        In Pantry
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
