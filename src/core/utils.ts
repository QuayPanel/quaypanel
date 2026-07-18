import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amountMinor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

/** Convert a dollar string/number (e.g. 10.98) to minor units (cents). */
export function dollarsToMinor(value: string | number): number {
  const raw = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error("Invalid amount");
  }
  return Math.round(raw * 100);
}

/** Convert minor units to a dollar string with up to 2 decimals (e.g. "10.98"). */
export function minorToDollars(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

/** Lowercase; non-alphanumeric runs become a single dash. */
export function slugify(
  input: string,
  options?: { keepTrailingDash?: boolean },
): string {
  let out = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
  if (!options?.keepTrailingDash) {
    out = out.replace(/-+$/, "");
  }
  return out;
}
