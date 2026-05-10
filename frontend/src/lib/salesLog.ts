/**
 * Optional local "sales diary" — compares real sales to mayorista reference.
 * Stored only on this device (localStorage).
 */
const STORAGE_KEY = "andean_rural_sales_v1";

export type SaleRow = {
  id: string;
  date: string;
  product: string;
  kg: number;
  pricePerKg: number;
  buyer: string;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadSales(): SaleRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SaleRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSales(rows: SaleRow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function addSale(entry: Omit<SaleRow, "id">): SaleRow {
  const row: SaleRow = { ...entry, id: uid() };
  const next = [row, ...loadSales()];
  saveSales(next);
  return row;
}

export function clearSales(): void {
  localStorage.removeItem(STORAGE_KEY);
}
