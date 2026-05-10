import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const crops = [
  {
    name: "Papa amarilla",
    region: "Huánuco",
    market: "Mercado Mayorista",
    unit: "kg",
    today: 2.42,
    yesterday: 2.18,
    fair: [2.28, 2.64],
    demand: "Alta",
    risk: "Media",
    emoji: "🥔",
  },
  {
    name: "Maíz choclo",
    region: "Cusco",
    market: "Acopio local",
    unit: "kg",
    today: 1.86,
    yesterday: 1.92,
    fair: [1.72, 2.03],
    demand: "Media",
    risk: "Baja",
    emoji: "🌽",
  },
  {
    name: "Quinua",
    region: "Puno",
    market: "Cooperativa",
    unit: "kg",
    today: 5.38,
    yesterday: 5.04,
    fair: [5.05, 5.82],
    demand: "Alta",
    risk: "Baja",
    emoji: "🌾",
  },
];

const alerts = [
  "La papa subió 11% esta semana en el mercado mayorista.",
  "Lluvias fuertes pueden afectar transporte mañana.",
  "Compradores están pagando más por producto seleccionado y limpio.",
];

const costRows = [
  { label: "Semilla", value: 0.36 },
  { label: "Fertilizante", value: 0.41 },
  { label: "Transporte", value: 0.22 },
  { label: "Mano de obra", value: 0.33 },
];

function soles(value) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function AppIcon({ children, className = "" }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center text-base leading-none ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function PriceBadge({ crop }) {
  const isUp = crop.today >= crop.yesterday;

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
      <AppIcon>{isUp ? "↗" : "↘"}</AppIcon>
      <span>{isUp ? "Subiendo" : "Bajando"}</span>
    </div>
  );
}

function BottomNav() {
  const items = [
    { label: "Inicio", icon: "🏠", active: true },
    { label: "Mercados", icon: "📈", active: false },
    { label: "Precio", icon: "🧮", active: false },
    { label: "Ventas", icon: "📦", active: false },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t bg-white px-5 pb-4 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
      <div className="grid grid-cols-4 text-center text-[11px] font-medium text-slate-500">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex flex-col items-center gap-1 ${item.active ? "text-emerald-700" : "text-slate-500"}`}
            aria-label={item.label}
          >
            <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function RuralPricingApp() {
  const [selectedCrop, setSelectedCrop] = useState(crops[0]);
  const [quantity, setQuantity] = useState(120);
  const [quality, setQuality] = useState("Buena");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCrops = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (!cleanSearch) return crops;

    return crops.filter((crop) =>
      `${crop.name} ${crop.region} ${crop.market}`.toLowerCase().includes(cleanSearch)
    );
  }, [searchTerm]);

  const costPerKg = useMemo(() => costRows.reduce((sum, row) => sum + row.value, 0), []);
  const qualityBonus = quality === "Alta" ? 0.18 : quality === "Buena" ? 0.09 : 0;
  const suggestedPrice = selectedCrop.today + qualityBonus;
  const profit = Math.max(0, (suggestedPrice - costPerKg) * quantity);
  const fairRangePercent = Math.min(
    100,
    Math.max(
      0,
      ((suggestedPrice - selectedCrop.fair[0]) / (selectedCrop.fair[1] - selectedCrop.fair[0])) * 100
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-lime-50 to-amber-50 p-4 text-slate-900">
      <div className="mx-auto flex min-h-[860px] max-w-[410px] items-center justify-center">
        <div className="relative h-[840px] w-full overflow-hidden rounded-[2.4rem] border-[10px] border-slate-950 bg-slate-50 shadow-2xl">
          <div className="absolute left-1/2 top-0 z-20 h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-slate-950" />

          <div className="h-full overflow-y-auto pb-28">
            <header className="relative overflow-hidden bg-gradient-to-br from-emerald-700 to-lime-600 px-5 pb-7 pt-9 text-white">
              <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-white/10" />

              <div className="relative z-10 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white/80">Buenos días</p>
                  <h1 className="mt-1 text-2xl font-bold leading-tight">Pon un precio justo hoy</h1>
                </div>
                <button
                  type="button"
                  className="rounded-2xl bg-white/15 p-3 backdrop-blur transition hover:bg-white/25"
                  aria-label="Ver alertas"
                >
                  <span className="text-lg leading-none" aria-hidden="true">🔔</span>
                </button>
              </div>

              <div className="relative z-10 mt-5 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">
                <span className="shrink-0 text-base leading-none" aria-hidden="true">📍</span>
                <span>Huánuco · Datos actualizados · Modo offline listo</span>
              </div>
            </header>

            <main className="space-y-5 px-5 pt-5">
              <Card className="rounded-3xl border-0 bg-white shadow-lg">
                <CardContent className="p-4">
                  <label className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2">
                    <span className="shrink-0 text-base leading-none text-slate-500" aria-hidden="true">🔎</span>
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                      placeholder="Buscar producto: papa, quinua, maíz..."
                      aria-label="Buscar producto"
                    />
                  </label>
                </CardContent>
              </Card>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Tus productos</h2>
                  <button type="button" className="text-sm font-semibold text-emerald-700">
                    Ver todo
                  </button>
                </div>

                {filteredCrops.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {filteredCrops.map((crop) => {
                      const isSelected = selectedCrop.name === crop.name;
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
                          <div className={`mt-1 text-[11px] ${isSelected ? "text-white/75" : "text-slate-500"}`}>
                            {crop.region}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl bg-white p-4 text-sm font-medium text-slate-600 shadow-sm">
                    No encontramos ese producto. Prueba con papa, maíz o quinua.
                  </div>
                )}
              </section>

              <section key={selectedCrop.name}>
                <Card className="overflow-hidden rounded-[2rem] border-0 bg-white shadow-xl">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-amber-200 to-lime-100 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-600">Precio recomendado</p>
                          <h2 className="mt-1 text-4xl font-black">{soles(suggestedPrice)}</h2>
                          <p className="mt-1 text-sm text-slate-700">
                            por {selectedCrop.unit} · {selectedCrop.market}
                          </p>
                        </div>
                        <PriceBadge crop={selectedCrop} />
                      </div>

                      <div className="mt-5 rounded-3xl bg-white/80 p-4 shadow-sm">
                        <div className="mb-2 flex justify-between gap-2 text-sm">
                          <span className="font-semibold">Rango justo</span>
                          <span className="text-right">
                            {soles(selectedCrop.fair[0])} - {soles(selectedCrop.fair[1])}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-700"
                            style={{ width: `${fairRangePercent}%` }}
                          />
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-slate-600">
                          Evita vender por debajo de {soles(selectedCrop.fair[0])}. El mercado está pagando mejor si el producto está seleccionado, limpio y listo para transportar.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x border-t bg-white text-center">
                      <div className="p-3">
                        <p className="text-[11px] text-slate-500">Demanda</p>
                        <p className="font-bold">{selectedCrop.demand}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] text-slate-500">Riesgo</p>
                        <p className="font-bold">{selectedCrop.risk}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] text-slate-500">Ayer</p>
                        <p className="font-bold">{soles(selectedCrop.yesterday)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Calcula tu ganancia</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Simple
                  </span>
                </div>

                <Card className="rounded-[2rem] border-0 bg-white shadow-lg">
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <div className="mb-2 flex justify-between text-sm font-semibold">
                        <label htmlFor="quantity-range">Cantidad para vender</label>
                        <span>{quantity} kg</span>
                      </div>
                      <input
                        id="quantity-range"
                        type="range"
                        min="20"
                        max="500"
                        step="10"
                        value={quantity}
                        onChange={(event) => setQuantity(Number(event.target.value))}
                        className="w-full accent-emerald-700"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold">Calidad del producto</p>
                      <div className="grid grid-cols-3 gap-2">
                        {["Regular", "Buena", "Alta"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setQuality(item)}
                            className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                              quality === item ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
                            }`}
                            aria-pressed={quality === item}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-600">Ganancia estimada</p>
                          <p className="text-2xl font-black">{soles(profit)}</p>
                        </div>
                        <span className="shrink-0 text-3xl leading-none text-emerald-700" aria-hidden="true">✅</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        Incluye costos aproximados de producción y transporte. Puedes ajustar cada costo antes de negociar.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-bold">Costos usados</h2>
                <Card className="rounded-[2rem] border-0 bg-white shadow-lg">
                  <CardContent className="p-2">
                    {costRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3">
                        <span className="text-sm font-semibold">{row.label}</span>
                        <span className="text-right text-sm font-bold text-slate-700">{soles(row.value)} / kg</span>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-1 flex w-full items-center justify-between rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800"
                    >
                      Editar mis costos
                      <span aria-hidden="true">›</span>
                    </button>
                  </CardContent>
                </Card>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-bold">Alertas importantes</h2>
                <div className="space-y-3">
                  {alerts.map((alert, index) => (
                    <Card key={alert} className="rounded-3xl border-0 bg-white shadow-md">
                      <CardContent className="flex items-start gap-3 p-4">
                        <div className="rounded-2xl bg-amber-100 p-2 text-amber-800">
                          <span className="text-lg leading-none" aria-hidden="true">{index === 1 ? "🌧️" : "📈"}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-slate-700">{alert}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <Button className="h-14 w-full rounded-3xl bg-slate-950 text-base font-bold text-white shadow-xl hover:bg-slate-800">
                Preparar precio para negociar
              </Button>
            </main>
          </div>

          <BottomNav />
        </div>
      </div>
    </div>
  );
}
