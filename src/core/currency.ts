import { getSetting } from "@/src/domains/settings/service";

/**
 * Convert amount between currencies using `currency.rates` (quote vs base=1).
 * Rates are “units of currency per 1 USD” style: USD=1, EUR=0.92 means 1 USD → 0.92 EUR.
 */
export async function convertCurrencyMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amountMinor;
  const rates = (await getSetting("currency.rates", {
    USD: 1,
  })) as Record<string, number>;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  if (!fromRate || !toRate) return amountMinor;
  const inUsd = amountMinor / fromRate;
  return Math.round(inUsd * toRate);
}

export async function formatMoneyFx(
  amountMinor: number,
  fromCurrency: string,
  displayCurrency?: string,
): Promise<{ amountMinor: number; currency: string }> {
  const base = (await getSetting("currency", "USD")) as string;
  const target = (displayCurrency || base).toUpperCase();
  const converted = await convertCurrencyMinor(
    amountMinor,
    fromCurrency,
    target,
  );
  return { amountMinor: converted, currency: target };
}
