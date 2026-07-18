"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { STORE_PROSE_CLASS } from "@/components/store-prose";
import { formatMoney } from "@/src/core/utils";
import {
  addSolePlanAndGoToCart,
  productNeedsConfigure,
} from "@/src/store/product-links";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    setupFee?: number;
  }>;
  configOptions?: Array<{ hidden?: boolean }>;
};

export default function StoreProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useApiQuery<Product>(
    ["product", params.slug],
    `/api/v1/catalog?type=product&slug=${params.slug}`,
  );
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  const directCheckout = Boolean(settings?.["theme.directCheckout"]);

  const needsConfigure = useMemo(
    () => (product ? productNeedsConfigure(product) : true),
    [product],
  );

  useEffect(() => {
    if (!product || settings === undefined) return;

    // Direct checkout: skip summary → configure or cart
    if (directCheckout) {
      if (needsConfigure) {
        router.replace(`/store/products/${product.slug}/configure`);
      } else {
        addSolePlanAndGoToCart(product, router);
      }
      return;
    }

    // No configure needed: auto cart
    if (!needsConfigure) {
      addSolePlanAndGoToCart(product, router);
    }
  }, [product, settings, directCheckout, needsConfigure, router]);

  if (isLoading || !product || settings === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (directCheckout || !needsConfigure) {
    return <p className="text-muted-foreground">Redirecting...</p>;
  }

  const fromPlan = product.plans[0];

  return (
    <PageMotion>
      <h1 className="text-3xl font-semibold">{product.name}</h1>
      <div className={`mt-4 max-w-2xl ${STORE_PROSE_CLASS}`}>
        {product.description ? (
          <Markdown>{product.description}</Markdown>
        ) : (
          <p>Configure this product to continue.</p>
        )}
      </div>

      {fromPlan ? (
        <p className="mt-6 text-lg">
          From{" "}
          <span className="font-semibold">
            {formatMoney(fromPlan.price, fromPlan.currency)}
          </span>
        </p>
      ) : (
        <p className="mt-6 text-sm text-destructive">
          No pricing plans available.
        </p>
      )}

      <div className="mt-8">
        <Button asChild disabled={product.plans.length === 0}>
          <Link href={`/store/products/${product.slug}/configure`}>
            Configure
          </Link>
        </Button>
      </div>
    </PageMotion>
  );
}
