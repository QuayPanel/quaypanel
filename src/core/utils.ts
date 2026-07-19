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

/** Short billing suffix for store “From …” prices, e.g. " /mo", " /yr", " /3mo". */
export function formatBillingSuffix(plan: {
  type?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  billingPeriod?: string | null;
}): string {
  const type = String(plan.type || "").toUpperCase();
  if (type === "FREE" || type === "ONE_TIME") return "";

  const periodRaw = String(plan.billingPeriod || "").toUpperCase();
  if (periodRaw) {
    const count = Math.max(1, Number(plan.intervalCount) || 1);
    const short =
      periodRaw === "MONTH"
        ? "mo"
        : periodRaw === "YEAR"
          ? "yr"
          : periodRaw === "WEEK"
            ? "wk"
            : periodRaw === "DAY"
              ? "day"
              : periodRaw.toLowerCase();
    if (count === 1) return ` /${short}`;
    return short === "day" ? ` /${count} days` : ` /${count}${short}`;
  }

  const interval = String(plan.interval || "").toLowerCase().trim();
  if (!interval || interval === "once") return "";
  if (interval === "month") return " /mo";
  if (interval === "year") return " /yr";
  if (interval === "week") return " /wk";
  if (interval === "day") return " /day";
  const match = interval.match(/^(\d+)\s+(month|year|week|day)s?$/);
  if (match) {
    const n = Number(match[1]);
    const unit =
      match[2] === "month"
        ? "mo"
        : match[2] === "year"
          ? "yr"
          : match[2] === "week"
            ? "wk"
            : "day";
    return unit === "day" ? ` /${n} days` : ` /${n}${unit}`;
  }
  return ` /${interval}`;
}

/** e.g. "From $9.99 /mo" */
export function formatFromPrice(plan: {
  price: number;
  currency?: string | null;
  type?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  billingPeriod?: string | null;
}): string {
  return `From ${formatMoney(plan.price, plan.currency || "USD")}${formatBillingSuffix(plan)}`;
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
