// GENERATED from web/src/lib/format.ts by scripts/sync-shared.mjs. Edit it there, then run `npm run sync-shared`.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 1234567 -> "12,34,567" (Indian grouping), done by hand so it behaves the same on every JS engine. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${digits.slice(-3)}`;
}

/** Rupees with Indian digit grouping; whole amounts drop the decimals. Display only, never arithmetic. */
export function inr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const [whole, frac] = Math.abs(n).toFixed(Number.isInteger(n) ? 0 : 2).split(".");
  return `${n < 0 ? "-" : ""}₹${groupIndian(whole)}${frac ? "." + frac : ""}`;
}

export function compactInr(n: number): string {
  return "₹" + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  return short ? MONTHS[m - 1].slice(0, 3) : `${MONTHS[m - 1]} ${y}`;
}

export function todayIso(now = new Date()): string {
  return `${currentMonth(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function sourceLabel(source: string | null, confidence: number | null): string {
  if (!source) return "Needs a category";
  if (source === "user") return "Set by you";
  const pct = confidence !== null ? ` ${Math.round(confidence * 100)}%` : "";
  return `AI (${source})${pct}`;
}

/** "6 Oct", or "6 Oct 2025" when it's not this year. Parsed by hand so timezones can't shift the day. */
export function shortDate(iso: string, now = new Date()): string {
  const [y, m, d] = iso.split("-").map(Number);
  const label = `${d} ${MONTHS[m - 1].slice(0, 3)}`;
  return y === now.getFullYear() ? label : `${label} ${y}`;
}
