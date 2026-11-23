import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  DollarSign,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { formatCents } from "../../shared/costEstimator";
import type { PriceOverride } from "../../shared/types";
import { api } from "../api";

interface Props {
  onClose: () => void;
  onDataChanged: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function SettingsModal({ onClose, onDataChanged, onToast }: Props) {
  const [tokenInfo, setTokenInfo] = useState<{ token: string; endpointUrl: string } | null>(null);
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    void api.inbox.getToken().then(setTokenInfo).catch(() => {});
    void api.food
      .listPrices()
      .then((res) => setOverrides(res.overrides))
      .catch(() => {});
  }, []);

  function copyValue(label: string, val: string) {
    void navigator.clipboard?.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF8F4] shadow-2xl border border-[#E8E2D9]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#FAF8F4]/95 backdrop-blur px-5 py-4 border-b border-[#E8E2D9]">
          <h3 className="font-editorial text-xl font-bold text-[#1E1C19]">
            Settings &amp; iPhone Setup
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#635D54] hover:bg-[#EAE4DA]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* iPhone Share Sheet Shortcut Guide */}
          <section className="rounded-2xl bg-white border border-[#E8E2D9] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E1C19]">
              <Smartphone className="h-4 w-4 text-[#C85A32]" />
              1-Tap iPhone Share Sheet (Instagram → PantryPlate)
            </div>
            <p className="text-xs text-[#635D54] leading-relaxed">
              Create a quick Apple Shortcut so tapping <strong>Share → Save Recipe</strong> on any
              Instagram or Photos screenshot sends it straight into PantryPlate&apos;s OCR importer:
            </p>
            <ol className="text-xs text-[#524C44] space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Open the iPhone <strong>Shortcuts</strong> app → tap <strong>+</strong> → enable{" "}
                <em>Show in Share Sheet</em> for <strong>Images</strong>.
              </li>
              <li>
                Add action <strong>Get Contents of URL</strong> → Method: <strong>POST</strong> →
                Request Body: <strong>Form</strong> with key <code>file</code> set to{" "}
                <em>Shortcut Input</em>, and Header <code>X-Share-Token</code> set to your token
                below.
              </li>
              <li>
                Add action <strong>Get Dictionary Value</strong> for key <code>importUrl</code>,
                then <strong>Open URLs</strong> to jump straight into OCR review!
              </li>
            </ol>

            {tokenInfo && (
              <div className="space-y-2 pt-1">
                <div className="rounded-xl bg-[#FAF8F4] border border-[#EAE3D9] p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#8C8378]">Endpoint URL</div>
                    <div className="text-xs font-mono truncate text-[#1E1C19]">
                      {tokenInfo.endpointUrl}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyValue("url", tokenInfo.endpointUrl)}
                    className="shrink-0 rounded-lg bg-white border border-[#DDD5C9] p-2 text-[#524C44]"
                  >
                    {copiedField === "url" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className="rounded-xl bg-[#FAF8F4] border border-[#EAE3D9] p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#8C8378]">
                      X-Share-Token
                    </div>
                    <div className="text-xs font-mono truncate text-[#1E1C19]">
                      {tokenInfo.token}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyValue("token", tokenInfo.token)}
                      className="rounded-lg bg-white border border-[#DDD5C9] p-2 text-[#524C44]"
                      title="Copy token"
                    >
                      {copiedField === "token" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const rotated = await api.inbox.rotateToken();
                        setTokenInfo(rotated);
                        onToast("Generated a new Share Token");
                      }}
                      className="rounded-lg bg-white border border-[#DDD5C9] p-2 text-[#524C44]"
                      title="Rotate token"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Custom Ingredient Price Overrides */}
          <section className="rounded-2xl bg-white border border-[#E8E2D9] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E1C19]">
              <DollarSign className="h-4 w-4 text-[#C85A32]" />
              Your Custom Grocery Prices ({overrides.length})
            </div>
            {overrides.length === 0 ? (
              <p className="text-xs text-[#635D54]">
                No custom prices set yet. Tap any ingredient price inside a recipe to customize your
                local store pricing.
              </p>
            ) : (
              <div className="divide-y divide-[#F2EDE5]">
                {overrides.map((ov) => (
                  <div key={ov.canonicalName} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-semibold capitalize text-[#1E1C19]">
                      {ov.canonicalName}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-[#635D54]">
                        {formatCents(ov.priceCents)} / {ov.unit}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.food.deletePrice(ov.canonicalName);
                          setOverrides((prev) =>
                            prev.filter((p) => p.canonicalName !== ov.canonicalName)
                          );
                          await onDataChanged();
                        }}
                        className="text-[#9A9186] hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sample Recipes */}
          <section className="rounded-2xl bg-white border border-[#E8E2D9] p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[#1E1C19]">Sample Recipes &amp; Staples</div>
              <div className="text-xs text-[#635D54]">
                Load 3 curated recipes + starter pantry items to explore the app.
              </div>
            </div>
            <button
              type="button"
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                try {
                  await api.recipes.seedSamples();
                  await onDataChanged();
                  onToast("Loaded sample recipes & starter pantry staples!");
                  onClose();
                } finally {
                  setSeeding(false);
                }
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#FAF2EA] border border-[#F0D3BC] px-3.5 py-2 text-xs font-bold text-[#9C401D]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seeding ? "Loading…" : "Load Samples"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
