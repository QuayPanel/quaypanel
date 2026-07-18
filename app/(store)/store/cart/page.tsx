"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";
import {
  clearCart,
  getCartLines,
  getCartTotalMinor,
  hydrateCartFromServer,
  removeCartLine,
  updateCartLineQuantity,
  type CartLine,
} from "@/src/store/cart";

type Me = { clientId: string | null };
type PublicSettings = Record<string, unknown>;

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export default function StoreCartPage() {
  const router = useRouter();
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: settings } = useApiQuery<PublicSettings>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const termsUrl = String(settings?.["legal.termsUrl"] ?? "").trim();

  function refresh() {
    setLines(getCartLines());
  }

  useEffect(() => {
    void hydrateCartFromServer().then(() => refresh());
    const onChange = () => refresh();
    window.addEventListener("quaypanel-cart-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("quaypanel-cart-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const total = getCartTotalMinor();
  const currency = lines[0]?.currency ?? "USD";

  async function placeOrder() {
    if (!me?.clientId) {
      toast.message("Sign in to place an order");
      router.push("/login");
      return;
    }
    if (lines.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (termsUrl && !termsAccepted) {
      toast.error("Please agree to the Terms of Service");
      return;
    }

    setOrdering(true);
    try {
      const order = await apiFetch<{
        invoices: Array<{ id: string; number: string }>;
      }>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify({
          clientId: me.clientId,
          couponCode: couponCode || undefined,
            affiliateCode: getCookie("qp_aff") || undefined,
          items: lines.map((line) => ({
            planId: line.planId,
            quantity: line.quantity,
            config: line.config,
          })),
        }),
      });
      clearCart();
      refresh();
      toast.success("Order created");
      const invoiceNumber = order.invoices?.[0]?.number;
      router.push(
        invoiceNumber
          ? `/client/invoices/${encodeURIComponent(invoiceNumber)}`
          : "/client/orders",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setOrdering(false);
    }
  }

  return (
    <PageMotion>
      <h1 className="text-3xl font-semibold">Cart</h1>

      {lines.length === 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild variant="outline">
            <Link href="/store">Browse store</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {lines.map((line) => (
              <Card key={line.id}>
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {line.planName}
                    </p>
                    {line.config.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {line.config.map((c) => (
                          <li key={c.configOptionId}>
                            {c.name}:{" "}
                            {c.choiceLabels?.join(", ") || c.value || "—"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-2 text-sm font-medium">
                      {formatMoney(line.lineTotalMinor, line.currency)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        className="h-8 w-20"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => {
                          updateCartLineQuantity(
                            line.id,
                            Number(e.target.value) || 1,
                          );
                          refresh();
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      removeCartLine(line.id);
                      refresh();
                    }}
                  >
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold">
                {formatMoney(total, currency)}
              </p>
              <div className="space-y-2">
                <Label>Coupon code</Label>
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              {termsUrl ? (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Terms of Service
                    </a>
                  </span>
                </label>
              ) : null}
              <Button
                className="w-full"
                disabled={ordering}
                onClick={() => void placeOrder()}
              >
                {ordering ? "Placing order..." : "Place order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageMotion>
  );
}
