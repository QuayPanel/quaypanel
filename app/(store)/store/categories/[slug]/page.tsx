"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { StoreMarkdown } from "@/components/store-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/src/core/utils";
import { getProductViewHref } from "@/src/store/product-links";

type ProductCard = {
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

type Category = {
  name: string;
  description: string | null;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
  }>;
  products: ProductCard[];
  featuredProducts?: ProductCard[];
};

export default function StoreCategoryPage() {
  const params = useParams<{ slug: string }>();
  const { data, isLoading, error } = useApiQuery<Category>(
    ["category", params.slug],
    `/api/v1/catalog?type=category&slug=${params.slug}`,
  );
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  const directCheckout = Boolean(settings?.["theme.directCheckout"]);

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (error || !data) {
    return (
      <p className="text-destructive">{error?.message ?? "Not found"}</p>
    );
  }

  const children = data.children ?? [];
  const featured = data.featuredProducts ?? [];

  function ProductGrid({ items }: { items: ProductCard[] }) {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((product) => {
          const from = product.plans[0];
          const href = getProductViewHref(product, directCheckout);
          return (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.description ? (
                  <StoreMarkdown compact>{product.description}</StoreMarkdown>
                ) : (
                  <p className="text-sm text-muted-foreground">View plans</p>
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
    );
  }

  return (
    <PageMotion>
      <h1 className="text-3xl font-semibold">{data.name}</h1>
      {data.description ? (
        <div className="mt-4 max-w-3xl">
          <StoreMarkdown>{data.description}</StoreMarkdown>
        </div>
      ) : null}

      {children.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Subcategories</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Link key={child.id} href={`/store/categories/${child.slug}`}>
                <Card className="h-full transition hover:border-primary">
                  <CardHeader>
                    <CardTitle>{child.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {child.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={child.imageUrl}
                        alt=""
                        className="h-32 w-full rounded object-cover"
                      />
                    ) : null}
                    {child.description ? (
                      <StoreMarkdown compact>
                        {child.description}
                      </StoreMarkdown>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Featured</h2>
          <ProductGrid items={featured} />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">
          {children.length > 0 ? "Products in this category" : "Products"}
        </h2>
        {data.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products in this category yet.
          </p>
        ) : (
          <ProductGrid items={data.products} />
        )}
      </section>
    </PageMotion>
  );
}
