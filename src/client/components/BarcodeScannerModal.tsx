import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import type { FoodProduct, StorageLocation } from "../../shared/types";
import { api } from "../api";
import { gradeMeta } from "./NutritionBadge";

interface Props {
  onClose: () => void;
  onAddedToPantry: (productName: string) => void;
}

export function BarcodeScannerModal({ onClose, onAddedToPantry }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [product, setProduct] = useState<FoodProduct | null>(null);

  // Add-to-pantry form state after scan
  const [location, setLocation] = useState<StorageLocation>("pantry");
  const [canonicalTag, setCanonicalTag] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("package");
  const [priceDollars, setPriceDollars] = useState("");
  const [saving, setSaving] = useState(false);

  const lastScannedRef = useRef<string>("");

  async function lookupBarcode(code: string) {
    const clean = code.replace(/[^0-9]/g, "");
    if (!clean) return;
    setLoading(true);
    setLookupError(null);
    try {
      const { product: found } = await api.food.barcode(clean);
      setProduct(found);
      setLocation(found.suggestedLocation);
      setCanonicalTag(found.canonicalGuess);
      setCameraActive(false);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Could not find this barcode in Open Food Facts"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cameraActive || product) return;

    let stopped = false;
    let controls: { stop: () => void } | null = null;
    const reader = new BrowserMultiFormatReader();

    async function startCamera() {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access requires HTTPS (works automatically when deployed to Cloudflare). Use manual barcode entry below!");
        return;
      }
      if (!videoRef.current) return;
      try {
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (stopped || !result) return;
            const code = result.getText().replace(/[^0-9]/g, "");
            if (code.length >= 8 && code !== lastScannedRef.current) {
              lastScannedRef.current = code;
              if (navigator.vibrate) navigator.vibrate(40);
              void lookupBarcode(code);
            }
          }
        );
      } catch (err) {
        if (!stopped) {
          setCameraError(
            err instanceof Error
              ? `Camera unavailable: ${err.message}. Enter a barcode manually below.`
              : "Camera unavailable. Enter a barcode manually below."
          );
        }
      }
    }

    void startCamera();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [cameraActive, product]);

  async function handleAddToPantry() {
    if (!product) return;
    setSaving(true);
    try {
      const priceNum = parseFloat(priceDollars);
      const unitPriceCents =
        Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) : null;
      const qtyNum = parseFloat(quantity);

      await api.pantry.create({
        name: product.brand ? `${product.brand} ${product.productName}` : product.productName,
        canonicalName: canonicalTag.trim() || product.canonicalGuess,
        location,
        quantity: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1,
        unit: unit.trim() || "package",
        stockStatus: "in_stock",
        barcode: product.barcode,
        brand: product.brand,
        imageUrl: product.imageUrl,
        unitPriceCents,
        priceUnit: unit.trim() || "package",
      });
      onAddedToPantry(product.productName);
      onClose();
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Failed to save to pantry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF8F4] shadow-2xl border border-[#E8E2D9]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#FAF8F4]/95 backdrop-blur px-5 py-4 border-b border-[#E8E2D9]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C85A32]/12 text-[#C85A32]">
              <ScanBarcode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold text-[#1E1C19]">
                Barcode Scanner
              </h3>
              <p className="text-[11px] text-[#635D54]">
                Powered by Open Food Facts (Yuka&apos;s open library)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#635D54] hover:bg-[#EAE4DA]"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!product ? (
            <>
              {/* Live Camera Viewport */}
              {cameraActive && !cameraError ? (
                <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3] border border-[#E8E2D9]">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Scan reticle */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="h-32 w-64 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] relative">
                      <div className="absolute inset-x-4 top-1/2 h-0.5 bg-[#C85A32] animate-pulse" />
                    </div>
                    <span className="mt-4 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                      Point iPhone camera at UPC / EAN barcode
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#F3EFE8] border border-[#E4DDD2] p-5 text-center space-y-2">
                  <Camera className="h-8 w-8 mx-auto text-[#8C8378]" />
                  <p className="text-xs text-[#635D54] leading-relaxed">
                    {cameraError || "Camera paused. Enter a barcode below or restart camera."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      lastScannedRef.current = "";
                      setCameraError(null);
                      setCameraActive(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1E1C19] border border-[#DED6CA] hover:bg-[#FAF8F4]"
                  >
                    <Camera className="h-3.5 w-3.5" /> Retry Camera
                  </button>
                </div>
              )}

              {/* Manual Barcode Entry */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void lookupBarcode(manualCode);
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-semibold text-[#635D54]">
                  Or type / paste barcode number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 0041196910759 or 3017620422003"
                    className="flex-1 rounded-xl border border-[#DDD5C9] bg-white px-3.5 py-2.5 text-sm focus:border-[#C85A32] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !manualCode.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#C85A32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#A84824] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Lookup
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-[#8C8378]">Try sample barcodes:</span>
                  {[
                    { label: "Barilla Pasta", code: "8076800195057" },
                    { label: "Nutella", code: "3017620422003" },
                    { label: "Kikkoman Soy", code: "0041390000010" },
                  ].map((sample) => (
                    <button
                      key={sample.code}
                      type="button"
                      onClick={() => {
                        setManualCode(sample.code);
                        void lookupBarcode(sample.code);
                      }}
                      className="rounded-full bg-[#EFEAE2] px-2.5 py-0.5 text-[11px] font-medium text-[#524C44] hover:bg-[#E4DDD2]"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </form>

              {lookupError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
                  {lookupError}
                </div>
              )}
            </>
          ) : (
            /* Yuka-Style Scanned Product Card */
            <div className="space-y-4">
              {(() => {
                const meta = gradeMeta(product.yukaGrade);
                return (
                  <div className="rounded-2xl bg-white p-4 border border-[#E8E2D9] space-y-4">
                    <div className="flex gap-3.5">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.productName}
                          className="h-20 w-20 rounded-xl object-contain bg-[#FAF8F4] border border-[#EFEAE2] p-1 shrink-0"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-xl bg-[#F3EFE8] flex items-center justify-center text-[#8C8378] shrink-0">
                          <ScanBarcode className="h-7 w-7" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C8378] truncate">
                          {product.brand || "Open Food Facts"}
                        </p>
                        <h4 className="font-editorial text-lg font-bold text-[#1E1C19] leading-snug">
                          {product.productName}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.pill}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            {product.yukaScore}/100 • {meta.label}
                          </span>
                          {product.novaGroup && (
                            <span className="rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[11px] font-semibold text-[#524C44]">
                              NOVA {product.novaGroup}
                            </span>
                          )}
                          {product.nutriscoreGrade && (
                            <span className="rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#524C44]">
                              Nutri-Score {product.nutriscoreGrade}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Positives & Negatives */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {product.positives.length > 0 && (
                        <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-200/70 space-y-1">
                          <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Good Points
                          </div>
                          {product.positives.map((p) => (
                            <p key={p} className="text-xs text-emerald-900/90">
                              • {p}
                            </p>
                          ))}
                        </div>
                      )}
                      {product.negatives.length > 0 && (
                        <div className="rounded-xl bg-amber-50/80 p-3 border border-amber-200/70 space-y-1">
                          <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Watch Out
                          </div>
                          {product.negatives.map((n) => (
                            <p key={n} className="text-xs text-amber-900/90">
                              • {n}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Additives pills */}
                    {product.additives.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C8378]">
                          Additives ({product.additives.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {product.additives.slice(0, 8).map((a) => (
                            <span
                              key={a.code}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                a.risk === "high"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : a.risk === "moderate"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-[#F3EFE8] text-[#524C44] border-[#E4DDD2]"
                              }`}
                            >
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Save to Pantry Details */}
              <div className="rounded-2xl bg-white p-4 border border-[#E8E2D9] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C8378]">
                  Add to Your Pantry / Fridge
                </h4>

                <div className="grid grid-cols-4 gap-1.5">
                  {(["fridge", "pantry", "freezer", "spices"] as StorageLocation[]).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`rounded-xl py-2 text-xs font-semibold capitalize border transition ${
                        location === loc
                          ? "bg-[#C85A32] text-white border-[#C85A32]"
                          : "bg-[#FAF8F4] text-[#524C44] border-[#E4DDD2]"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#635D54] mb-1">
                    Matches recipe ingredient as:
                  </label>
                  <input
                    type="text"
                    value={canonicalTag}
                    onChange={(e) => setCanonicalTag(e.target.value)}
                    placeholder="e.g. olive oil, pasta, soy sauce"
                    className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm focus:border-[#C85A32] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#8C8378]">
                    Used to automatically check off ingredients on your recipe shopping lists.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#635D54] mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#635D54] mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="bottle / box / lb"
                      className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#635D54] mb-1">
                      Price Paid ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceDollars}
                      onChange={(e) => setPriceDollars(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-[#DDD5C9] bg-[#FAF8F4] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProduct(null);
                      lastScannedRef.current = "";
                      setCameraActive(true);
                    }}
                    className="flex-1 rounded-xl border border-[#DDD5C9] bg-white py-2.5 text-sm font-semibold text-[#524C44]"
                  >
                    Scan Another
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAddToPantry}
                    className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C85A32] py-2.5 text-sm font-semibold text-white hover:bg-[#A84824] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add to {location}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
