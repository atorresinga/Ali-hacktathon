import React, { useMemo } from "react";

type SeriesRow = { ds: string; price_soles_per_kg: number };
type Horizon = { days: number; price_mean: number; price_low: number; price_high: number };

const W = 340;
const H = 140;
const PAD = { l: 36, r: 10, t: 14, b: 28 };

export default function PriceTrendChart({
  series,
  horizons,
  pastLabel,
  forecastLabel,
}: {
  series: SeriesRow[];
  horizons?: Horizon[];
  pastLabel: string;
  forecastLabel: string;
}) {
  const { histPath, fcPath, yTicks, minP, maxP } = useMemo(() => {
    const pts = [...series].sort((a, b) => a.ds.localeCompare(b.ds));
    const histPrices = pts.map((p) => p.price_soles_per_kg);
    const fcPts = (horizons ?? [])
      .filter((h) => [7, 14, 21, 28].includes(h.days))
      .sort((a, b) => a.days - b.days);
    const fcMeans = fcPts.map((h) => h.price_mean);
    const all = [...histPrices, ...fcMeans];
    if (all.length === 0) {
      return { histPath: "", fcPath: "", yTicks: [0, 1, 2], minP: 0, maxP: 1 };
    }
    const minP = Math.min(...all) * 0.97;
    const maxP = Math.max(...all) * 1.03;
    const span = maxP - minP || 1;
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const xHist = (i: number) => PAD.l + (iw * i) / Math.max(1, pts.length - 1);
    const y = (price: number) => PAD.t + ih * (1 - (price - minP) / span);

    let d = "";
    pts.forEach((p, i) => {
      const px = xHist(i);
      const py = y(p.price_soles_per_kg);
      d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    });

    let fc = "";
    if (pts.length && fcPts.length) {
      const last = pts[pts.length - 1];
      const lastX = xHist(pts.length - 1);
      const lastY = y(last.price_soles_per_kg);
      const step = iw / 8;
      fc = `M ${lastX} ${lastY}`;
      fcPts.forEach((h, i) => {
        const px = lastX + step * (i + 1);
        const py = y(h.price_mean);
        fc += ` L ${px} ${py}`;
      });
    }

    const mid = (minP + maxP) / 2;
    const yTicks = [maxP, mid, minP].map((v) => Number(v.toFixed(2)));
    return { histPath: d, fcPath: fc, yTicks, minP, maxP };
  }, [series, horizons]);

  if (series.length === 0) return null;

  const yTxt = (price: number) => {
    const span = maxP - minP || 1;
    const ih = H - PAD.t - PAD.b;
    const y = PAD.t + ih * (1 - (price - minP) / span);
    return (
      <text key={price} x={PAD.l - 6} y={y + 4} textAnchor="end" className="fill-slate-500" fontSize="9">
        {price.toFixed(2)}
      </text>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={pastLabel}>
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth="1" />
        {yTicks.map(yTxt)}
        {histPath && (
          <path d={histPath} fill="none" stroke="#047857" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {fcPath && (
          <path
            d={fcPath}
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <text x={PAD.l} y={H - 6} className="fill-slate-400" fontSize="9">
          ← {pastLabel}
        </text>
        {fcPath ? (
          <text x={W - PAD.r} y={12} textAnchor="end" className="fill-amber-700" fontSize="9">
            ··· {forecastLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
