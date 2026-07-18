"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import { FadeIn, PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  STORE_PROSE_CLASS,
  STORE_PROSE_COMPACT_CLASS,
} from "@/components/store-prose";
import { formatMoney } from "@/src/core/utils";
import { getProductViewHref } from "@/src/store/product-links";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  products: Array<{ id: string }>;
};

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
    setupFee?: number;
  }>;
  configOptionCount?: number;
};

export default function StorePage() {
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );
  const { data: categories = [] } = useApiQuery<Category[]>(
    ["store-categories"],
    "/api/v1/catalog?type=categories",
  );
  const { data: featured = [] } = useApiQuery<Product[]>(
    ["store-featured"],
    "/api/v1/catalog?type=featured",
  );

  const showCategoryDesc = settings?.["theme.showCategoryDescription"] !== false;
  const smallImages = Boolean(settings?.["theme.smallImages"]);
  const directCheckout = Boolean(settings?.["theme.directCheckout"]);
  const homeMd = String(
    settings?.["theme.homeMarkdown"] ||
      "Browse hosting products and plans. Order in a few clicks.",
  );

  const rootCategories = categories.filter((c) => !c.parentId);

  return (
    <PageMotion>
      <FadeIn>
        <div className={`max-w-2xl ${STORE_PROSE_CLASS} [&_h1]:text-4xl [&_h2]:text-2xl`}>
          <Markdown>{homeMd}</Markdown>
        </div>
      </FadeIn>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rootCategories.map((cat, i) => (
            <FadeIn key={cat.id} delay={0.05 * i}>
              <Link href={`/store/categories/${cat.slug}`}>
                <Card className="h-full transition hover:border-primary">
                  <CardHeader>
                    <CardTitle>{cat.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    {"imageUrl" in cat && cat.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cat.imageUrl}
                        alt=""
                        className={
                          smallImages
                            ? "h-16 w-16 rounded object-cover"
                            : "h-32 w-full rounded object-cover"
                        }
                      />
                    ) : null}
                    {showCategoryDesc && cat.description ? (
                      <div className={STORE_PROSE_COMPACT_CLASS}>
                        <Markdown>{cat.description}</Markdown>
                      </div>
                    ) : (
                      <p>{cat.products.length} products</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </FadeIn>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Featured</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => {
              const from = product.plans[0];
              const href = getProductViewHref(product, directCheckout);
              return (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.description ? (
                      <div className={STORE_PROSE_COMPACT_CLASS}>
                        <Markdown>{product.description}</Markdown>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        View plans and order.
                      </p>
                    )}
                    {from && (
                      <p className="font-medium">
                        From {formatMoney(from.price, from.currency)}
                      </p>
                    )}
                    <Button asChild>
                      <Link href={href}>View product</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </PageMotion>
  );
}
