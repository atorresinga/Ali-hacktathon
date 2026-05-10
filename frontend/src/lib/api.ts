import { Capacitor } from "@capacitor/core";

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

const DEV_LOOPBACK = "http://127.0.0.1:8000";

/**
 * Resolve on every request (never cache at module load): the native bridge may not be
 * ready when modules first evaluate, so an eager `API_BASE` constant stayed "" → demo mode.
 *
 * Detection order: `VITE_API_BASE` → `capacitor:` / `ionic:` URL → `window.Capacitor` → imported API.
 *
 * - `npm run dev`: empty → relative `/api` → Vite proxy.
 * - Capacitor iOS Simulator: loopback reaches the Mac’s uvicorn.
 * - Physical iPhone: set `VITE_API_BASE=http://<Mac-LAN>:8000` (127.0.0.1 is the phone itself).
 */
export function getApiBase(): string {
  const env = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window === "undefined") return "";

  const proto = window.location?.protocol || "";
  if (proto === "capacitor:" || proto === "ionic:") {
    return DEV_LOOPBACK;
  }

  const w = window as CapWindow;
  if (w.Capacitor?.isNativePlatform?.()) {
    return DEV_LOOPBACK;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      return DEV_LOOPBACK;
    }
  } catch {
    /* bridge not ready */
  }

  return "";
}

export type FarmerInsight = {
  language: string;
  variety: string;
  market: string;
  metrics: {
    last_price_soles_per_kg?: number;
    last_obs_date?: string;
    change_7d_pct?: number | null;
    volume_pressure_z?: number;
    supply_regime?: string;
    volatility_30d_coefficient?: number | null;
    data_days?: number;
  };
  forecast: {
    method?: string;
    horizons?: { days: number; price_mean: number; price_low: number; price_high: number }[];
  };
  localized: {
    headline: string;
    bullets: string[];
    sms: string;
    disclaimer: string;
    forecast_caption?: string;
  };
};

export async function fetchVarieties(market = "GMML_Lima"): Promise<string[]> {
  const r = await fetch(`${getApiBase()}/api/v1/meta/varieties?market=${encodeURIComponent(market)}`);
  if (!r.ok) throw new Error(`varieties ${r.status}`);
  const j = (await r.json()) as { varieties: string[] };
  return j.varieties;
}

export async function fetchSeriesDaily(
  variety: string,
  market = "GMML_Lima"
): Promise<{ ds: string; price_soles_per_kg: number }[]> {
  const r = await fetch(
    `${getApiBase()}/api/v1/series/daily?variety=${encodeURIComponent(variety)}&market=${encodeURIComponent(market)}`
  );
  if (!r.ok) throw new Error(`series ${r.status}`);
  const j = (await r.json()) as { series: { ds: string; price_soles_per_kg: number }[] };
  return j.series;
}

export async function fetchFarmerInsight(
  variety: string,
  market = "GMML_Lima",
  lang = "es"
): Promise<FarmerInsight> {
  const r = await fetch(
    `${getApiBase()}/api/v1/insights/farmer?variety=${encodeURIComponent(variety)}&market=${encodeURIComponent(market)}&lang=${encodeURIComponent(lang)}`
  );
  if (!r.ok) throw new Error(`insight ${r.status}`);
  return r.json() as Promise<FarmerInsight>;
}

export type UiLabels = Record<string, string>;

export async function fetchLabels(lang: string): Promise<UiLabels> {
  const r = await fetch(`${getApiBase()}/api/v1/i18n/labels?lang=${encodeURIComponent(lang)}`);
  if (!r.ok) throw new Error(`labels ${r.status}`);
  const j = (await r.json()) as { labels: UiLabels };
  return j.labels;
}

export type ForecastResponse = {
  horizons?: { days: number; price_mean: number; price_low: number; price_high: number }[];
  method?: string;
  last_price?: number;
  last_obs_date?: string;
};

export async function fetchForecast(
  variety: string,
  market = "GMML_Lima",
  lang = "es"
): Promise<ForecastResponse> {
  const r = await fetch(
    `${getApiBase()}/api/v1/forecast?variety=${encodeURIComponent(variety)}&market=${encodeURIComponent(market)}&lang=${encodeURIComponent(lang)}`
  );
  if (!r.ok) throw new Error(`forecast ${r.status}`);
  return r.json() as Promise<ForecastResponse>;
}

export type DataHealth = {
  min_date: string | null;
  max_date: string | null;
  rows: number;
  outlier_rows: number;
  distinct_days: number;
  by_source: Record<string, number>;
};

export async function fetchDataHealth(lang = "es"): Promise<DataHealth> {
  const r = await fetch(`${getApiBase()}/api/v1/meta/data-health?lang=${encodeURIComponent(lang)}`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  const j = (await r.json()) as { data_health: DataHealth };
  return j.data_health;
}

export type SourceLink = { id: string; title: string; url: string };

export type SourcesResponse = {
  urls: Record<string, string>;
  links?: SourceLink[];
  attribution: string;
};

export async function fetchSources(lang = "es"): Promise<SourcesResponse> {
  const r = await fetch(`${getApiBase()}/api/v1/config/sources?lang=${encodeURIComponent(lang)}`);
  if (!r.ok) throw new Error(`sources ${r.status}`);
  return r.json() as Promise<SourcesResponse>;
}

export async function fetchMarkets(lang = "es"): Promise<string[]> {
  const r = await fetch(`${getApiBase()}/api/v1/meta/markets?lang=${encodeURIComponent(lang)}`);
  if (!r.ok) throw new Error(`markets ${r.status}`);
  const j = (await r.json()) as { markets: string[] };
  return j.markets;
}

export type IngestRun = {
  id: number;
  source: string;
  status: string;
  detail: string | null;
  started_at: string;
  finished_at: string | null;
};

export async function fetchIngestRecent(lang = "es", limit = 25): Promise<IngestRun[]> {
  const r = await fetch(
    `${getApiBase()}/api/v1/meta/ingest-recent?limit=${limit}&lang=${encodeURIComponent(lang)}`
  );
  if (!r.ok) throw new Error(`ingest ${r.status}`);
  const j = (await r.json()) as { runs: IngestRun[] };
  return j.runs;
}
