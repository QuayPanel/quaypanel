import { addCartLine } from "@/src/store/cart";

export type ProductLinkInfo = {
  slug: string;
  id?: string;
  name?: string;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    setupFee?: number;
  }>;
  configOptionCount?: number;
  configOptions?: Array<{ hidden?: boolean }>;
};

/** Whether the product needs the configure page (options or multiple plans). */
export function productNeedsConfigure(product: ProductLinkInfo): boolean {
  const optionCount =
    product.configOptionCount ??
    (product.configOptions ?? []).filter((o) => !o.hidden).length;
  return optionCount > 0 || product.plans.length > 1;
}

/**
 * Resolve the href for a “View product” action.
 * When directCheckout is on, skip the summary page.
 */
export function getProductViewHref(
  product: ProductLinkInfo,
  directCheckout: boolean,
): string {
  if (!directCheckout) {
    return `/store/products/${product.slug}`;
  }
  if (productNeedsConfigure(product)) {
    return `/store/products/${product.slug}/configure`;
  }
  return `/store/products/${product.slug}`;
}

/** Auto-add single plan and go to cart (for direct / zero-config path). */
export function addSolePlanAndGoToCart(
  product: {
    id: string;
    slug: string;
    name: string;
    plans: Array<{
      id: string;
      name: string;
      price: number;
      currency: string;
      setupFee?: number;
    }>;
  },
  router: { replace: (href: string) => void },
) {
  const plan = product.plans[0];
  if (!plan) return false;
  addCartLine({
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    planId: plan.id,
    planName: plan.name,
    currency: plan.currency,
    quantity: 1,
    planPriceMinor: plan.price,
    setupFeeMinor: plan.setupFee ?? 0,
    config: [],
    lineTotalMinor: plan.price + (plan.setupFee ?? 0),
  });
  router.replace("/store/cart");
  return true;
}
