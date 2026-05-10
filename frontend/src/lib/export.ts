import * as XLSX from "xlsx";

import type { SaleRow } from "@/lib/salesLog";

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildPriceForecastCsv(params: {
  variety: string;
  market: string;
  series: { ds: string; price_soles_per_kg: number }[];
  horizons?: { days: number; price_mean: number; price_low: number; price_high: number }[];
}): string {
  const lines: string[] = [];
  lines.push(`variety,${escapeCsv(params.variety)}`);
  lines.push(`market,${escapeCsv(params.market)}`);
  lines.push("");
  lines.push("ds,price_soles_per_kg");
  for (const row of params.series) {
    lines.push(`${row.ds},${row.price_soles_per_kg}`);
  }
  lines.push("");
  lines.push("horizon_days,price_mean,price_low,price_high");
  for (const h of params.horizons ?? []) {
    lines.push(`${h.days},${h.price_mean},${h.price_low},${h.price_high}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadPriceForecastXlsx(filename: string, params: Parameters<typeof buildPriceForecastCsv>[0]) {
  const wb = XLSX.utils.book_new();
  const hist = params.series.map((r) => ({
    fecha: r.ds,
    precio_S_per_kg: r.price_soles_per_kg,
  }));
  const fc = (params.horizons ?? []).map((h) => ({
    dias: h.days,
    precio_medio: h.price_mean,
    precio_bajo: h.price_low,
    precio_alto: h.price_high,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hist), "precios_21d");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fc), "pronostico");
  const meta = [{ campo: "variedad", valor: params.variety }, { campo: "mercado", valor: params.market }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "datos");
  XLSX.writeFile(wb, filename);
}

export function buildSalesCsv(rows: SaleRow[]): string {
  const lines: string[] = ["fecha,producto,kg,precio_S_per_kg,comprador,total_S"];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        escapeCsv(r.product),
        r.kg,
        r.pricePerKg,
        escapeCsv(r.buyer),
        (r.kg * r.pricePerKg).toFixed(2),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function downloadSalesXlsx(filename: string, rows: SaleRow[]) {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    fecha: r.date,
    producto: r.product,
    kg: r.kg,
    precio_S_kg: r.pricePerKg,
    comprador: r.buyer,
    total_S: Number((r.kg * r.pricePerKg).toFixed(2)),
  }));
  if (data.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["fecha", "producto", "kg", "precio_S_kg", "comprador", "total_S"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "ventas");
  } else {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "ventas");
  }
  XLSX.writeFile(wb, filename);
}
