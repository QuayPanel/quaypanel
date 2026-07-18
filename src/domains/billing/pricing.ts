import { getSetting } from "@/src/domains/settings/service";

export type CouponLike = {
  type: "PERCENT" | "FIXED";
  value: number;
};

export type BillingPeriodLike = "DAY" | "WEEK" | "MONTH" | "YEAR" | string;

export function addInterval(
  from: Date,
  intervalOrPeriod: string | BillingPeriodLike,
  count = 1,
): Date {
  const next = new Date(from);
  const n = Math.max(1, count);

  const raw = String(intervalOrPeriod).trim().toLowerCase();
  if (raw === "once" || raw === "free") return next;

  let period = raw;
  let amount = n;
  const match = raw.match(/^(\d+)\s+(day|week|month|year)s?$/);
  if (match) {
    amount = Number(match[1]);
    period = match[2];
  } else if (["day", "week", "month", "year"].includes(raw)) {
    period = raw;
  } else {
    period = String(intervalOrPeriod).toLowerCase();
  }

  switch (period) {
    case "day":
      next.setDate(next.getDate() + amount);
      break;
    case "week":
      next.setDate(next.getDate() + 7 * amount);
      break;
    case "year":
      next.setFullYear(next.getFullYear() + amount);
      break;
    case "month":
    default:
      next.setMonth(next.getMonth() + amount);
      break;
  }
  return next;
}

export function computeDiscount(subtotal: number, coupon: CouponLike): number {
  if (coupon.type === "PERCENT") {
    return Math.min(subtotal, Math.round((subtotal * coupon.value) / 100));
  }
  return Math.min(subtotal, coupon.value);
}

export async function computeTax(
  amountAfterDiscount: number,
): Promise<{ taxMinor: number; taxableBase: number }> {
  const enabled = Boolean(await getSetting("tax.enabled", false));
  if (!enabled) return { taxMinor: 0, taxableBase: amountAfterDiscount };
  const rate = Number(await getSetting("tax.rate", 0));
  if (!rate || rate <= 0) return { taxMinor: 0, taxableBase: amountAfterDiscount };
  const type = String(await getSetting("tax.type", "exclusive"));

  if (type === "inclusive") {
    // amount already includes tax; extract portion
    const taxMinor = Math.round(
      amountAfterDiscount - amountAfterDiscount / (1 + rate / 100),
    );
    return {
      taxMinor,
      taxableBase: amountAfterDiscount - taxMinor,
    };
  }

  const taxMinor = Math.round((amountAfterDiscount * rate) / 100);
  return { taxMinor, taxableBase: amountAfterDiscount };
}

export async function priceOrder(input: {
  subtotal: number;
  coupon?: CouponLike | null;
}) {
  const discountMinor = input.coupon
    ? computeDiscount(input.subtotal, input.coupon)
    : 0;
  const afterDiscount = Math.max(0, input.subtotal - discountMinor);
  const type = String(await getSetting("tax.type", "exclusive"));
  const { taxMinor, taxableBase } = await computeTax(afterDiscount);

  if (type === "inclusive") {
    return {
      subtotal: input.subtotal,
      discountMinor,
      taxMinor,
      total: afterDiscount,
      taxableBase,
    };
  }

  return {
    subtotal: input.subtotal,
    discountMinor,
    taxMinor,
    total: afterDiscount + taxMinor,
    taxableBase,
  };
}
