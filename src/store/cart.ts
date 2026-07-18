export type CartConfigSelection = {
  configOptionId: string;
  type: string;
  name: string;
  /** Free-text / number value */
  value?: string;
  /** Selected choice ids (select/radio/slider = one; checkbox = many) */
  choiceIds?: string[];
  /** Display labels for choices */
  choiceLabels?: string[];
  /** Extra price from priced choices (minor units) */
  extraMinor: number;
};

export type CartLine = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  planId: string;
  planName: string;
  currency: string;
  quantity: number;
  planPriceMinor: number;
  setupFeeMinor: number;
  config: CartConfigSelection[];
  /** plan + setup + config extras, per qty (setup once for COMBINED handled client-side already) */
  lineTotalMinor: number;
};

const STORAGE_KEY = "quaypanel.cart.v1";
const GUEST_KEY = "quaypanel.cart.guest";

export function getCartGuestKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(GUEST_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, key);
  }
  return key;
}

function readRaw(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncServerCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  const payload = {
    guestKey: getCartGuestKey(),
    lines: lines.map(({ id: _id, ...rest }) => rest),
  };
  void fetch("/api/v1/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

function writeRaw(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("quaypanel-cart-changed"));
  syncServerCart(lines);
}

/** Merge server cart into local when local is empty (multi-device / login). */
export async function hydrateCartFromServer(): Promise<CartLine[]> {
  if (typeof window === "undefined") return [];
  const local = readRaw();
  try {
    const guestKey = getCartGuestKey();
    const res = await fetch(`/api/v1/cart?guestKey=${encodeURIComponent(guestKey)}`, {
      credentials: "include",
    });
    if (!res.ok) return local;
    const json = (await res.json()) as {
      data?: { lines?: Array<CartLine & { id: string }> };
    };
    const remote = json.data?.lines ?? [];
    if (local.length === 0 && remote.length > 0) {
      const mapped: CartLine[] = remote.map((line) => ({
        id: line.id || crypto.randomUUID(),
        productId: line.productId,
        productSlug: line.productSlug,
        productName: line.productName,
        planId: line.planId,
        planName: line.planName,
        currency: line.currency,
        quantity: line.quantity,
        planPriceMinor: line.planPriceMinor,
        setupFeeMinor: line.setupFeeMinor,
        config: (line.config as CartConfigSelection[]) ?? [],
        lineTotalMinor: line.lineTotalMinor,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      window.dispatchEvent(new Event("quaypanel-cart-changed"));
      return mapped;
    }
    if (local.length > 0) syncServerCart(local);
  } catch {
    /* ignore */
  }
  return local;
}

export function getCartLines(): CartLine[] {
  return readRaw();
}

export function getCartCount(): number {
  return readRaw().reduce((sum, line) => sum + line.quantity, 0);
}

export function getCartTotalMinor(): number {
  return readRaw().reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

export function addCartLine(line: Omit<CartLine, "id">): CartLine {
  const next: CartLine = { ...line, id: crypto.randomUUID() };
  const lines = readRaw();
  lines.push(next);
  writeRaw(lines);
  return next;
}

export function removeCartLine(id: string) {
  writeRaw(readRaw().filter((line) => line.id !== id));
}

export function updateCartLineQuantity(id: string, quantity: number) {
  const qty = Math.max(1, Math.floor(quantity));
  writeRaw(
    readRaw().map((line) => {
      if (line.id !== id) return line;
      const unit =
        line.planPriceMinor +
        line.config.reduce((s, c) => s + c.extraMinor, 0);
      return {
        ...line,
        quantity: qty,
        lineTotalMinor: unit * qty + line.setupFeeMinor,
      };
    }),
  );
}

export function clearCart() {
  writeRaw([]);
}
