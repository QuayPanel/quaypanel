"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ShoppingBag, ShoppingCart } from "lucide-react";
import { useApiQuery } from "@/components/api";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCartCount } from "@/src/store/cart";

type NavCategory = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  children?: Array<{ id: string; name: string; slug: string }>;
};

type Me = {
  email: string;
  role: string;
} | null;

type PublicBrand = {
  "brand.name"?: string;
  "brand.logoUrl"?: string;
  "theme.logoDisplay"?: string;
};

export type StoreHeaderBrand = {
  name: string;
  logoUrl: string;
  logoDisplay: string;
};

export function StoreHeader({
  brand: brandProp,
}: {
  brand?: StoreHeaderBrand;
} = {}) {
  const { data: categories = [] } = useApiQuery<NavCategory[]>(
    ["catalog-categories"],
    "/api/v1/catalog?type=categories",
  );
  const { data: me, isLoading } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: brand } = useApiQuery<PublicBrand>(
    ["public-settings"],
    "/api/v1/settings?public=1",
    { enabled: !brandProp },
  );
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    function refresh() {
      setCartCount(getCartCount());
    }
    refresh();
    window.addEventListener("quaypanel-cart-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("quaypanel-cart-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const roots = useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .slice(0, 5)
      .map((c) => ({
        ...c,
        children: c.children?.length
          ? c.children
          : categories.filter((child) => child.parentId === c.id),
      }));
  }, [categories]);

  const cartHasItems = cartCount > 0;
  const brandName =
    brandProp?.name || String(brand?.["brand.name"] || "QuayPanel");
  const logoUrl =
    brandProp?.logoUrl ?? String(brand?.["brand.logoUrl"] || "").trim();
  const logoDisplay =
    brandProp?.logoDisplay ||
    String(brand?.["theme.logoDisplay"] || "logo_name");

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-8">
          <BrandMark
            name={brandName}
            logoUrl={logoUrl}
            logoDisplay={logoDisplay}
            size="md"
          />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link
              href="/store"
              className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Store
            </Link>
            {roots.map((cat) =>
              cat.children && cat.children.length > 0 ? (
                <DropdownMenu key={cat.id}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {cat.name}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link href={`/store/categories/${cat.slug}`}>
                        All {cat.name}
                      </Link>
                    </DropdownMenuItem>
                    {cat.children.map((child) => (
                      <DropdownMenuItem key={child.id} asChild>
                        <Link href={`/store/categories/${child.slug}`}>
                          {child.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={cat.id}
                  href={`/store/categories/${cat.slug}`}
                  className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {cat.name}
                </Link>
              ),
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              cartHasItems
                ? `Cart (${cartCount} items)`
                : "Cart (empty)"
            }
          >
            <Link href="/store/cart">
              {cartHasItems ? (
                <ShoppingBag className="h-5 w-5" />
              ) : (
                <ShoppingCart className="h-5 w-5" />
              )}
              {cartHasItems ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </Link>
          </Button>
          {isLoading ? (
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          ) : me ? (
            <AccountMenu email={me.email} role={me.role} portal="public" />
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
