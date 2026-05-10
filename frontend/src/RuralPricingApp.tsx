import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PriceTrendChart from "@/components/PriceTrendChart";
import {
  fetchDataHealth,
  fetchFarmerInsight,
  fetchForecast,
  fetchIngestRecent,
  fetchLabels,
  fetchMarkets,
  fetchSeriesDaily,
  fetchSources,
  fetchVarieties,
  type FarmerInsight,
  type ForecastResponse,
  type IngestRun,
  type UiLabels,
} from "@/lib/api";
import { buildPriceForecastCsv, downloadPriceForecastXlsx, downloadTextFile } from "@/lib/export";
import { addSale, clearSales, loadSales, type SaleRow } from "@/lib/salesLog";

type Lang = "es" | "qu" | "ay";
type Tab = "home" | "markets" | "price" | "sales";
type Quality = "regular" | "good" | "high";

type Crop = {
  name: string;
  region: string;
  market: string;
  unit: string;
  today: number;
  yesterday: number;
  fair: [number, number];
  supplyKey: "high" | "medium" | "low";
  riskKey: "low" | "medium" | "high";
  emoji: string;
  apiVariety?: string;
};

const STATIC_DEMO: Crop[] = [
  {
    name: "Maíz choclo",
    region: "Cusco",
    market: "Acopio local (demo)",
    unit: "kg",
    today: 1.86,
    yesterday: 1.92,
    fair: [1.72, 2.03],
    supplyKey: "medium",
    riskKey: "low",
    emoji: "🌽",
  },
  {
    name: "Quinua",
    region: "Puno",
    market: "Cooperativa (demo)",
    unit: "kg",
    today: 5.38,
    yesterday: 5.04,
    fair: [5.05, 5.82],
    supplyKey: "high",
    riskKey: "low",
    emoji: "🌾",
  },
];

const COST_KEYS = ["cost_seed", "cost_fertilizer", "cost_transport", "cost_labor"] as const;
const DEFAULT_COSTS: Record<(typeof COST_KEYS)[number], number> = {
  cost_seed: 0.36,
  cost_fertilizer: 0.41,
  cost_transport: 0.22,
  cost_labor: 0.33,
};

function normVarietyKey(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Distinct emoji per commercial potato name (Unicode limits “exact” depiction). */
function emojiForVariety(v: string): string {
  const n = normVarietyKey(v);
  if (n.includes("amarilla")) return "🟡";
  if (n.includes("canchan")) return "🟤";
  if (n.includes("yungay")) return "⚪";
  if (n.includes("huayro")) return "🔴";
  if (n.includes("peruanita")) return "🟣";
  if (n.includes("tumbay")) return "🟠";
  if (n.includes("nevadita")) return "💠";
  if (n.includes("sumac")) return "🌄";
  return "🥔";
}

function formatMarketLabel(market: string): string {
  return market.replace(/_/g, " ");
}

function fairBandFromInsight(insight: FarmerInsight): [number, number] {
  const h7 = insight.forecast.horizons?.find((h) => h.days === 7);
  if (h7) return [h7.price_low, h7.price_high];
  const p = insight.metrics.last_price_soles_per_kg ?? 1;
  return [Math.max(0.1, p * 0.92), p * 1.08];
}

function supplyKeyFromRegime(regime: string | undefined): "high" | "medium" | "low" {
  if (regime === "high") return "high";
  if (regime === "low") return "low";
  return "medium";
}

function riskKeyFromInsight(insight: FarmerInsight): "low" | "medium" | "high" {
  const v = insight.metrics.volatility_30d_coefficient;
  if (v == null) return "medium";
  if (v > 0.15) return "high";
  if (v > 0.08) return "medium";
  return "low";
}

async function mapVarietyToCrop(variety: string, lang: string, market: string): Promise<Crop> {
  const [insight, series] = await Promise.all([
    fetchFarmerInsight(variety, market, lang),
    fetchSeriesDaily(variety, market),
  ]);
  const last = series.at(-1);
  const prev = series.at(-2);
  const today = last?.price_soles_per_kg ?? insight.metrics.last_price_soles_per_kg ?? 0;
  const yesterday = prev?.price_soles_per_kg ?? today;
  const fair = fairBandFromInsight(insight);
  return {
    name: variety,
    region: formatMarketLabel(market),
    market: market === "GMML_Lima" ? "Mayorista Lima" : formatMarketLabel(market),
    unit: "kg",
    today,
    yesterday,
    fair,
    supplyKey: supplyKeyFromRegime(insight.metrics.supply_regime),
    riskKey: riskKeyFromInsight(insight),
    emoji: emojiForVariety(variety),
    apiVariety: variety,
  };
}

function soles(value: number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function formatRunTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function L(labels: UiLabels, key: string, fallback: string) {
  return labels[key] ?? fallback;
}

function buildNegotiationDraft(params: {
  insight: FarmerInsight | null;
  crop: Crop;
  suggestedPrice: number;
  quantity: number;
  labels: UiLabels;
}): string {
  const { insight, crop, suggestedPrice, quantity, labels } = params;
  const lines: string[] = [];
  lines.push(`${crop.name} · ${crop.market}`);
  lines.push(
    `${L(labels, "negotiate_band", "Rango orientativo (negociación)")}: ${soles(crop.fair[0])} – ${soles(crop.fair[1])} / kg`
  );
  lines.push(
    `${L(labels, "negotiate_reference", "Referencia sugerida")}: ${soles(suggestedPrice)} / kg (${L(labels, "negotiate_flexible", "el comprador puede ofrecer dentro del rango")})`
  );
  lines.push(`${L(labels, "quantity_label", "Cantidad")}: ${quantity} kg`);
  if (insight?.localized?.sms) lines.push(insight.localized.sms);
  if (insight?.localized?.headline) lines.push(insight.localized.headline);
  (insight?.localized?.bullets ?? []).forEach((b) => lines.push(`• ${b}`));
  if (insight?.localized?.disclaimer) lines.push(insight.localized.disclaimer);
  return lines.join("\n");
}

function AppIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center text-base leading-none ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function PriceBadge({
  crop,
  labels,
}: {
  crop: Crop;
  labels: UiLabels;
}) {
  const isUp = crop.today >= crop.yesterday;
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
      <AppIcon>{isUp ? "↗" : "↘"}</AppIcon>
      <span>{isUp ? L(labels, "trend_up", "Subiendo") : L(labels, "trend_down", "Bajando")}</span>
    </div>
  );
}

function BottomNav({
  tab,
  onChange,
  labels,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  labels: UiLabels;
}) {
  const items: { id: Tab; labelKey: string; icon: string; def: string }[] = [
    { id: "home", labelKey: "nav_home", icon: "🏠", def: "Inicio" },
    { id: "markets", labelKey: "nav_markets", icon: "📈", def: "Mercados" },
    { id: "price", labelKey: "nav_price", icon: "🧮", def: "Precio" },
    { id: "sales", labelKey: "nav_sales", icon: "📦", def: "Ventas" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl border-t border-slate-200/80 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md sm:px-4">
      <div className="grid grid-cols-4 text-center text-[11px] font-medium text-slate-500">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex flex-col items-center gap-1 ${tab === item.id ? "text-emerald-700" : "text-slate-500"}`}
            aria-current={tab === item.id ? "page" : undefined}
            aria-label={L(labels, item.labelKey, item.def)}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {item.icon}
            </span>
            <span>{L(labels, item.labelKey, item.def)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function RuralPricingApp() {
  const [lang, setLang] = useState<Lang>("es");
  const [labels, setLabels] = useState<UiLabels>({});
  const [tab, setTab] = useState<Tab>("home");
  const [crops, setCrops] = useState<Crop[]>(() => [...STATIC_DEMO]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<FarmerInsight | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [quantity, setQuantity] = useState(120);
  const [quality, setQuality] = useState<Quality>("good");
  const [searchTerm, setSearchTerm] = useState("");
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [costs, setCosts] = useState<Record<(typeof COST_KEYS)[number], number>>({ ...DEFAULT_COSTS });
  const [costEditorOpen, setCostEditorOpen] = useState(false);

  const [marketsList, setMarketsList] = useState<string[]>(["GMML_Lima"]);
  const [selectedMarket, setSelectedMarket] = useState("GMML_Lima");
  const [marketsData, setMarketsData] = useState<{
    sources: Awaited<ReturnType<typeof fetchSources>> | null;
    health: Awaited<ReturnType<typeof fetchDataHealth>> | null;
    ingest: IngestRun[] | null;
  }>({ sources: null, health: null, ingest: null });
  const [priceTabVariety, setPriceTabVariety] = useState<string>("");
  const [priceSeriesAll, setPriceSeriesAll] = useState<{ ds: string; price_soles_per_kg: number }[]>([]);
  const [priceForecast, setPriceForecast] = useState<ForecastResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [sales, setSales] = useState<SaleRow[]>(() => loadSales());
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleProduct, setSaleProduct] = useState("");
  const [saleKg, setSaleKg] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleBuyer, setSaleBuyer] = useState("");
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifSupported(true);
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLabels(lang).then((l) => {
      if (!cancelled) setLabels(l);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    void fetchMarkets(lang)
      .then((m) => {
        if (!cancelled && m.length) setMarketsList(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    if (marketsList.length && !marketsList.includes(selectedMarket)) {
      setSelectedMarket(marketsList[0]);
    }
  }, [marketsList, selectedMarket]);

  const refreshPotatoes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const vars = await fetchVarieties(selectedMarket);
      const potatoCrops = await Promise.all(vars.map((v) => mapVarietyToCrop(v, lang, selectedMarket)));
      const merged = [...potatoCrops, ...STATIC_DEMO];
      setCrops(merged);
      setSelectedCrop((prev) => {
        if (prev) {
          const same = merged.find((c) => c.name === prev.name);
          if (same) return same;
        }
        return merged[0] ?? null;
      });
      setPriceTabVariety((prev) => prev || potatoCrops[0]?.apiVariety || potatoCrops[0]?.name || "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "API");
      setCrops([...STATIC_DEMO]);
      setSelectedCrop(STATIC_DEMO[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [lang, selectedMarket]);

  useEffect(() => {
    void refreshPotatoes();
  }, [refreshPotatoes]);

  useEffect(() => {
    const crop = selectedCrop;
    if (!crop?.apiVariety) {
      setInsight(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ins = await fetchFarmerInsight(crop.apiVariety, selectedMarket, lang);
        if (!cancelled) setInsight(ins);
      } catch {
        if (!cancelled) setInsight(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCrop, lang, selectedMarket]);

  useEffect(() => {
    if (tab !== "markets") return;
    let cancelled = false;
    void (async () => {
      try {
        const [sources, health, ingest] = await Promise.all([
          fetchSources(lang),
          fetchDataHealth(lang),
          fetchIngestRecent(lang, 25),
        ]);
        if (!cancelled) setMarketsData({ sources, health, ingest });
      } catch {
        if (!cancelled) setMarketsData({ sources: null, health: null, ingest: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, lang]);

  useEffect(() => {
    if (tab !== "price" || !priceTabVariety) return;
    let cancelled = false;
    setPriceLoading(true);
    void (async () => {
      try {
        const [series, fc] = await Promise.all([
          fetchSeriesDaily(priceTabVariety, selectedMarket),
          fetchForecast(priceTabVariety, selectedMarket, lang),
        ]);
        if (!cancelled) {
          setPriceSeriesAll(series);
          setPriceForecast(fc);
        }
      } catch {
        if (!cancelled) {
          setPriceSeriesAll([]);
          setPriceForecast(null);
        }
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, priceTabVariety, lang, selectedMarket]);

  const filteredCrops = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (!cleanSearch) return crops;
    return crops.filter((crop) => `${crop.name} ${crop.region} ${crop.market}`.toLowerCase().includes(cleanSearch));
  }, [searchTerm, crops]);

  const costPerKg = useMemo(() => COST_KEYS.reduce((s, k) => s + (costs[k] ?? 0), 0), [costs]);
  const qualityBonus = quality === "high" ? 0.18 : quality === "good" ? 0.09 : 0;
  const activeCrop = selectedCrop ?? crops[0] ?? STATIC_DEMO[0];
  const suggestedPrice = activeCrop.today + qualityBonus;
  const profit = Math.max(0, (suggestedPrice - costPerKg) * quantity);
  const fairSpan = activeCrop.fair[1] - activeCrop.fair[0];
  const fairRangePercent =
    fairSpan > 1e-6
      ? Math.min(100, Math.max(0, ((suggestedPrice - activeCrop.fair[0]) / fairSpan) * 100))
      : 50;

  const priceSeries21 = useMemo(() => priceSeriesAll.slice(-21), [priceSeriesAll]);

  const onBellNotifications = useCallback(async () => {
    if (!notifSupported || notifPermission === "unsupported") {
      setTab("home");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      try {
        new Notification(L(labels, "notif_demo_title", "Alertas del mercado"), {
          body: L(labels, "notif_demo_body", "Le avisaremos cuando revise precios y datos nuevos."),
        });
      } catch {
        /* WebView may block */
      }
    }
  }, [notifSupported, notifPermission, labels]);

  const alerts = useMemo(() => {
    const fb = [
      L(labels, "fallback_alert_1", "La papa subió 11% esta semana en el mercado mayorista."),
      L(labels, "fallback_alert_2", "Lluvias fuertes pueden afectar transporte mañana."),
      L(labels, "fallback_alert_3", "Compradores están pagando más por producto seleccionado y limpio."),
    ];
    if (insight?.localized?.sms) {
      const extra = insight.localized.bullets?.slice(0, 2) ?? [];
      return [insight.localized.sms, ...extra, ...fb].slice(0, 5);
    }
    return fb;
  }, [insight, labels]);

  const negotiationText = useMemo(
    () =>
      buildNegotiationDraft({
        insight,
        crop: activeCrop,
        suggestedPrice,
        quantity,
        labels,
      }),
    [insight, activeCrop, suggestedPrice, quantity, labels]
  );

  const potatoVarieties = useMemo(() => crops.filter((c) => c.apiVariety).map((c) => c.apiVariety as string), [crops]);

  const copyNegotiation = async () => {
    try {
      await navigator.clipboard.writeText(negotiationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const openWhatsApp = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(negotiationText)}`;
    window.open(u, "_blank", "noopener,noreferrer");
  };

  const saveSaleEntry = () => {
    const kg = Number(saleKg);
    const pp = Number(salePrice);
    if (!saleProduct.trim() || !saleBuyer.trim() || !Number.isFinite(kg) || kg <= 0 || !Number.isFinite(pp) || pp <= 0)
      return;
    addSale({ date: saleDate, product: saleProduct.trim(), kg, pricePerKg: pp, buyer: saleBuyer.trim() });
    setSales(loadSales());
    setSaleKg("");
    setSalePrice("");
    setSaleBuyer("");
    setSaleProduct(activeCrop.name);
  };

  useEffect(() => {
    if (tab === "sales" && activeCrop) setSaleProduct((p) => p || activeCrop.name);
  }, [tab, activeCrop]);

  const headerBlock = (
    <header className="relative overflow-hidden bg-gradient-to-br from-emerald-700 to-lime-600 px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-5 sm:pb-7">
      <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-white/10" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/80">{L(labels, "greeting", "Buenos días")}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{L(labels, "hero_title", "Pon un precio justo hoy")}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex rounded-xl bg-white/15 p-0.5 text-[10px] font-bold backdrop-blur">
            {(["es", "qu", "ay"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLang(code);
                  setTab("home");
                }}
                className={`rounded-lg px-2 py-1 uppercase ${lang === code ? "bg-white text-emerald-800" : "text-white/90"}`}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void onBellNotifications()}
            className="rounded-2xl bg-white/15 p-3 backdrop-blur transition hover:bg-white/25"
            aria-label={L(labels, "alerts_aria", "Activar alertas")}
            title={
              notifPermission === "granted"
                ? L(labels, "notif_on", "Notificaciones activadas")
                : L(labels, "notif_tap", "Toque para permitir avisos")
            }
          >
            <span className="text-lg leading-none" aria-hidden="true">
              🔔
            </span>
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex flex-col gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-base leading-none" aria-hidden="true">
            📍
          </span>
          {marketsList.length > 1 ? (
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                {L(labels, "location_pick", "Mercado / ubicación")}
              </span>
              <select
                className="w-full rounded-xl border border-white/25 bg-white/95 px-2 py-2 text-sm font-semibold text-emerald-900"
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                aria-label={L(labels, "location_pick", "Mercado")}
              >
                {marketsList.map((m) => (
                  <option key={m} value={m}>
                    {formatMarketLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="font-medium">
              {loading
                ? L(labels, "status_loading", "Cargando datos del servidor…")
                : loadError
                  ? L(labels, "status_demo", "Modo demo").replace("{error}", loadError)
                  : `${formatMarketLabel(selectedMarket)} · ${L(labels, "status_backend", "Datos del backend")}`}
            </span>
          )}
        </div>
        {marketsList.length > 1 && (
          <p className="pl-7 text-[11px] leading-snug text-white/75">
            {loading
              ? L(labels, "status_loading", "Cargando datos del servidor…")
              : loadError
                ? L(labels, "status_demo", "Modo demo").replace("{error}", loadError)
                : L(labels, "status_backend_hint", "Precios y pronóstico usan el mercado elegido.")}
          </p>
        )}
      </div>
    </header>
  );

  const homeMain = (
    <main className="space-y-5 px-4 pt-4 sm:px-5 sm:pt-5">
      <Card className="rounded-3xl border-0 bg-white shadow-lg">
        <CardContent className="p-4">
          <label className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2">
            <span className="shrink-0 text-base leading-none text-slate-500" aria-hidden="true">
              🔎
            </span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              placeholder={L(labels, "search_placeholder", "Buscar producto…")}
              aria-label={L(labels, "search_aria", "Buscar")}
            />
          </label>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{L(labels, "section_products", "Tus productos")}</h2>
          <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setSearchTerm("")}>
            {L(labels, "view_all", "Ver todo")}
          </button>
        </div>

        {filteredCrops.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {filteredCrops.map((crop) => {
              const isSelected = activeCrop.name === crop.name;
              return (
                <button
                  key={crop.name}
                  type="button"
                  onClick={() => setSelectedCrop(crop)}
                  className={`rounded-3xl p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 ${
                    isSelected ? "bg-emerald-700 text-white" : "bg-white text-slate-900"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="text-3xl" aria-hidden="true">
                    {crop.emoji}
                  </div>
                  <div className="mt-2 text-xs font-bold leading-tight">{crop.name}</div>
                  <div className={`mt-1 text-[11px] ${isSelected ? "text-white/75" : "text-slate-500"}`}>{crop.region}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-4 text-sm font-medium text-slate-600 shadow-sm">
            {L(labels, "no_search_results", "No encontramos ese producto.")}
          </div>
        )}
      </section>

      <section key={activeCrop.name}>
        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white shadow-xl">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-amber-200 to-lime-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-600">{L(labels, "recommended_price", "Referencia sugerida")}</p>
                  <h2 className="mt-1 text-4xl font-black">{soles(suggestedPrice)}</h2>
                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    {L(labels, "negotiate_range_short", "Negocia entre")}{" "}
                    <span className="whitespace-nowrap">{soles(activeCrop.fair[0])}</span>
                    {" – "}
                    <span className="whitespace-nowrap">{soles(activeCrop.fair[1])}</span>
                    <span className="font-semibold text-slate-700">
                      {" "}
                      / {activeCrop.unit}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {L(labels, "per_unit_por", "por")} {activeCrop.unit} · {activeCrop.market}
                  </p>
                  {insight?.localized?.headline && (
                    <p className="mt-2 text-xs font-medium leading-snug text-slate-700">{insight.localized.headline}</p>
                  )}
                </div>
                <PriceBadge crop={activeCrop} labels={labels} />
              </div>

              <div className="mt-5 rounded-3xl bg-white/80 p-4 shadow-sm">
                <div className="mb-2 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{L(labels, "fair_range_title", "Banda modelo (7 días)")}</span>
                  <span className="text-right">
                    {soles(activeCrop.fair[0])} - {soles(activeCrop.fair[1])}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-700" style={{ width: `${fairRangePercent}%` }} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {insight?.localized?.disclaimer ??
                    "Evita vender por debajo del rango bajo si tus costos lo permiten. Datos orientativos."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x border-t bg-white text-center">
              <div className="p-3">
                <p className="text-[11px] text-slate-500">{L(labels, "demand_col", "Demanda")}</p>
                <p className="font-bold">{L(labels, `demand_${activeCrop.supplyKey}`, activeCrop.supplyKey)}</p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500">{L(labels, "risk_col", "Riesgo")}</p>
                <p className="font-bold">{L(labels, `risk_${activeCrop.riskKey}`, activeCrop.riskKey)}</p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500">{L(labels, "yesterday_col", "Ayer")}</p>
                <p className="font-bold">{soles(activeCrop.yesterday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{L(labels, "section_profit", "Calcula tu ganancia")}</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            {L(labels, "profit_badge_simple", "Simple")}
          </span>
        </div>

        <Card className="rounded-[2rem] border-0 bg-white shadow-lg">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="mb-2 flex justify-between text-sm font-semibold">
                <label htmlFor="quantity-range">{L(labels, "quantity_label", "Cantidad")}</label>
                <span>
                  {quantity} kg
                </span>
              </div>
              <input
                id="quantity-range"
                type="range"
                min="20"
                max="500"
                step="10"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">{L(labels, "quality_title", "Calidad")}</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "regular" as const, key: "quality_regular" },
                    { id: "good" as const, key: "quality_good" },
                    { id: "high" as const, key: "quality_high" },
                  ] as const
                ).map(({ id, key }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setQuality(id)}
                    className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                      quality === id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                    aria-pressed={quality === id}
                  >
                    {L(labels, key, id)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-600">{L(labels, "estimated_profit", "Ganancia estimada")}</p>
                  <p className="text-2xl font-black">{soles(profit)}</p>
                </div>
                <span className="shrink-0 text-3xl leading-none text-emerald-700" aria-hidden="true">
                  ✅
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{L(labels, "profit_hint", "")}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{L(labels, "section_costs", "Costos")}</h2>
        <Card className="rounded-[2rem] border-0 bg-white shadow-lg">
          <CardContent className="p-2">
            {COST_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3">
                <span className="text-sm font-semibold">{L(labels, k, k)}</span>
                <span className="text-right text-sm font-bold text-slate-700">
                  {soles(costs[k])} {L(labels, "per_kg_suffix", "/ kg")}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCostEditorOpen(true)}
              className="mt-1 flex w-full items-center justify-between rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800"
            >
              {L(labels, "edit_costs", "Editar mis costos")}
              <span aria-hidden="true">›</span>
            </button>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{L(labels, "section_alerts", "Alertas")}</h2>
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <Card key={`${index}-${alert.slice(0, 20)}`} className="rounded-3xl border-0 bg-white shadow-md">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-2xl bg-amber-100 p-2 text-amber-800">
                  <span className="text-lg leading-none" aria-hidden="true">
                    {index === 1 ? "🌧️" : "📈"}
                  </span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-700">{alert}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Button
        type="button"
        onClick={() => setNegotiateOpen(true)}
        className="h-14 w-full rounded-3xl bg-slate-950 text-base font-bold text-white shadow-xl hover:bg-slate-800"
      >
        {L(labels, "prepare_negotiate", "Preparar precio para negociar")}
      </Button>
    </main>
  );

  const marketsMain = (
    <main className="space-y-4 px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-6">
      <h2 className="text-lg font-bold text-slate-900">{L(labels, "markets_title", "Mercados")}</h2>
      <p className="text-sm text-slate-600">{L(labels, "markets_intro", "")}</p>
      {marketsData.sources && (
        <Card className="rounded-3xl border-0 bg-white shadow-lg">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-bold text-emerald-800">{L(labels, "markets_sources", "Fuentes MIDAGRI / SISAP")}</h3>
            {(marketsData.sources.links?.length
              ? marketsData.sources.links
              : Object.entries(marketsData.sources.urls).map(([id, url]) => ({ id, title: id, url }))
            ).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <span className="min-w-0 flex-1 leading-snug">{link.title}</span>
                <span className="shrink-0">{L(labels, "markets_open", "Abrir enlace")} ›</span>
              </a>
            ))}
            <p className="text-xs text-slate-500">{marketsData.sources.attribution}</p>
          </CardContent>
        </Card>
      )}
      {marketsData.ingest && marketsData.ingest.length > 0 && (
        <Card className="rounded-3xl border-0 bg-white shadow-lg">
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-bold text-emerald-800">{L(labels, "markets_updates", "Actualizaciones de datos")}</h3>
            <p className="text-xs text-slate-600">{L(labels, "markets_updates_hint", "Últimas cargas al servidor (hora local).")}</p>
            <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
              {marketsData.ingest.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-slate-800">{run.source}</span>
                  <span className="text-slate-600">{formatRunTimestamp(run.finished_at ?? run.started_at)}</span>
                  <span
                    className={`font-bold uppercase tracking-wide ${
                      run.status === "ok" ? "text-emerald-700" : run.status === "running" ? "text-amber-700" : "text-red-700"
                    }`}
                  >
                    {run.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {marketsData.health && (
        <Card className="rounded-3xl border-0 bg-white shadow-lg">
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="text-sm font-bold text-emerald-800">{L(labels, "markets_health", "Datos")}</h3>
            <div className="flex justify-between">
              <span>{L(labels, "markets_rows", "Filas")}</span>
              <span className="font-bold">{marketsData.health.rows}</span>
            </div>
            <div className="flex justify-between">
              <span>{L(labels, "markets_days", "Días")}</span>
              <span className="font-bold">{marketsData.health.distinct_days}</span>
            </div>
            <div className="flex justify-between">
              <span>{L(labels, "markets_outliers", "Atípicos")}</span>
              <span className="font-bold">{marketsData.health.outlier_rows}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );

  const priceMain = (
    <main className="space-y-4 px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-6">
      <h2 className="text-lg font-bold">{L(labels, "price_title", "Precio")}</h2>
      <p className="text-sm text-slate-600">{L(labels, "price_subtitle", "")}</p>
      <label className="block text-sm font-semibold text-slate-700">{L(labels, "price_pick", "Variedad")}</label>
      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium"
        value={priceTabVariety}
        onChange={(e) => setPriceTabVariety(e.target.value)}
      >
        {potatoVarieties.length === 0 ? (
          <option value="">—</option>
        ) : (
          potatoVarieties.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))
        )}
      </select>
      {priceLoading ? (
        <p className="text-sm text-slate-500">…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10 flex-1 rounded-2xl border border-emerald-200 bg-white text-xs font-bold text-emerald-900 sm:flex-none"
              disabled={!priceTabVariety || priceSeries21.length === 0}
              onClick={() => {
                const csv = buildPriceForecastCsv({
                  variety: priceTabVariety,
                  market: selectedMarket,
                  series: priceSeries21,
                  horizons: priceForecast?.horizons,
                });
                const safe = priceTabVariety.replace(/\s+/g, "_");
                downloadTextFile(`precio_${safe}_${selectedMarket}.csv`, csv, "text/csv;charset=utf-8");
              }}
            >
              {L(labels, "export_csv", "Descargar CSV")}
            </Button>
            <Button
              type="button"
              className="h-10 flex-1 rounded-2xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 sm:flex-none"
              disabled={!priceTabVariety || priceSeries21.length === 0}
              onClick={() => {
                downloadPriceForecastXlsx(`precio_${priceTabVariety.replace(/\s+/g, "_")}_${selectedMarket}.xlsx`, {
                  variety: priceTabVariety,
                  market: selectedMarket,
                  series: priceSeries21,
                  horizons: priceForecast?.horizons,
                });
              }}
            >
              {L(labels, "export_xlsx", "Descargar Excel")}
            </Button>
          </div>
          <PriceTrendChart
            series={priceSeries21}
            horizons={priceForecast?.horizons}
            pastLabel={L(labels, "chart_past", "Precio observado")}
            forecastLabel={L(labels, "chart_forecast", "Tendencia pronóstico")}
          />
          <h3 className="text-sm font-bold text-emerald-800">{L(labels, "price_last_days", "Últimos 21 días")}</h3>
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-2">{L(labels, "price_table_day", "Día")}</th>
                  <th className="p-2">{L(labels, "price_table_price", "S/ kg")}</th>
                </tr>
              </thead>
              <tbody>
                {[...priceSeries21].reverse().map((row) => (
                  <tr key={row.ds} className="border-t border-slate-100">
                    <td className="p-2">{row.ds}</td>
                    <td className="p-2 font-semibold">{soles(row.price_soles_per_kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="text-sm font-bold text-emerald-800">{L(labels, "forecast_title", "Pronóstico")}</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-2">{L(labels, "forecast_days", "Días")}</th>
                  <th className="p-2">{L(labels, "forecast_mean", "Medio")}</th>
                  <th className="p-2">{L(labels, "forecast_low", "Bajo")}</th>
                  <th className="p-2">{L(labels, "forecast_high", "Alto")}</th>
                </tr>
              </thead>
              <tbody>
                {(priceForecast?.horizons ?? []).map((h) => (
                  <tr key={h.days} className="border-t border-slate-100">
                    <td className="p-2">{h.days}</td>
                    <td className="p-2 font-semibold">{soles(h.price_mean)}</td>
                    <td className="p-2">{soles(h.price_low)}</td>
                    <td className="p-2">{soles(h.price_high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );

  const salesMain = (
    <main className="space-y-4 px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-6">
      <h2 className="text-lg font-bold">{L(labels, "sales_title", "Mis ventas")}</h2>
      <p className="text-sm leading-relaxed text-slate-600">{L(labels, "sales_subtitle", "")}</p>
      <Card className="rounded-3xl border-0 bg-white shadow-lg">
        <CardContent className="space-y-3 p-4">
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            aria-label={L(labels, "sales_date", "Fecha")}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={L(labels, "sales_product", "Producto")}
            value={saleProduct}
            onChange={(e) => setSaleProduct(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder={L(labels, "sales_kg", "Kg")}
              inputMode="decimal"
              value={saleKg}
              onChange={(e) => setSaleKg(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder={L(labels, "sales_price", "S/ kg")}
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={L(labels, "sales_buyer", "Comprador")}
            value={saleBuyer}
            onChange={(e) => setSaleBuyer(e.target.value)}
          />
          <Button
            type="button"
            onClick={saveSaleEntry}
            className="h-12 w-full rounded-2xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800"
          >
            {L(labels, "sales_save", "Guardar")}
          </Button>
          <p className="text-xs text-slate-500">
            {L(labels, "sales_total", "Total")}:{" "}
            {Number.isFinite(Number(saleKg)) && Number.isFinite(Number(salePrice))
              ? soles(Number(saleKg) * Number(salePrice))
              : "—"}
          </p>
        </CardContent>
      </Card>
      {sales.length === 0 ? (
        <p className="text-center text-sm text-slate-500">{L(labels, "sales_empty", "")}</p>
      ) : (
        <div className="space-y-2">
          {sales.map((s) => (
            <Card key={s.id} className="rounded-2xl border-0 bg-white shadow">
              <CardContent className="p-3 text-xs">
                <div className="font-bold text-slate-800">{s.date}</div>
                <div>
                  {s.product} · {s.kg} kg @ {soles(s.pricePerKg)}
                </div>
                <div className="text-slate-600">{s.buyer}</div>
                <div className="mt-1 font-semibold text-emerald-800">{L(labels, "sales_total", "Total")}: {soles(s.kg * s.pricePerKg)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Button
        type="button"
        onClick={() => {
          clearSales();
          setSales([]);
        }}
        className="h-11 w-full rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-800 hover:bg-red-100"
      >
        {L(labels, "sales_delete_all", "Borrar")}
      </Button>
    </main>
  );

  return (
    <>
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-emerald-100 via-lime-50 to-amber-50 text-slate-900">
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {headerBlock}
          {tab === "home" && homeMain}
          {tab === "markets" && marketsMain}
          {tab === "price" && priceMain}
          {tab === "sales" && salesMain}
        </div>

        <BottomNav tab={tab} onChange={setTab} labels={labels} />
      </div>

      {negotiateOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
          role="dialog"
          aria-modal="true"
        >
              <div className="max-h-[85%] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
                <h3 className="text-lg font-bold text-slate-900">{L(labels, "negotiate_title", "Negociar")}</h3>
                <p className="mt-1 text-sm text-slate-600">{L(labels, "negotiate_hint", "")}</p>
                <pre className="mt-3 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs text-slate-800">
                  {negotiationText}
                </pre>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={() => void copyNegotiation()}
                    className="h-12 w-full rounded-2xl bg-emerald-700 font-bold text-white hover:bg-emerald-800"
                  >
                    {copied ? L(labels, "negotiate_copied", "Copiado") : L(labels, "negotiate_copy", "Copiar")}
                  </Button>
                  <Button
                    type="button"
                    onClick={openWhatsApp}
                    className="h-12 w-full rounded-2xl bg-[#25D366] font-bold text-white hover:opacity-95"
                  >
                    {L(labels, "negotiate_whatsapp", "WhatsApp")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setNegotiateOpen(false)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white font-bold text-slate-800"
                  >
                    {L(labels, "negotiate_close", "Cerrar")}
                  </Button>
                </div>
              </div>
        </div>
      )}

      {costEditorOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
          role="dialog"
          aria-modal="true"
        >
              <div className="w-full rounded-3xl bg-white p-5 shadow-2xl">
                <h3 className="text-lg font-bold">{L(labels, "edit_costs", "Costos")}</h3>
                <div className="mt-3 space-y-3">
                  {COST_KEYS.map((k) => (
                    <label key={k} className="block text-sm">
                      <span className="font-semibold text-slate-700">{L(labels, k, k)}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={costs[k]}
                        onChange={(e) => setCosts((prev) => ({ ...prev, [k]: Number(e.target.value) || 0 }))}
                      />
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => setCostEditorOpen(false)}
                  className="mt-4 h-12 w-full rounded-2xl bg-slate-900 font-bold text-white"
                >
                  {L(labels, "negotiate_close", "Listo")}
                </Button>
              </div>
        </div>
      )}
    </>
  );
}
