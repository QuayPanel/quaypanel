"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/src/core/utils";

type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
};

type Product = {
  id: string;
  name: string;
  plans: Plan[];
};

type Order = {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

type Me = {
  clientId: string | null;
};

export default function ClientOrdersPage() {
  const queryClient = useQueryClient();
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: products = [] } = useApiQuery<Product[]>(
    ["catalog"],
    "/api/v1/products?active=1",
  );
  const { data: orders = [], isLoading } = useApiQuery<Order[]>(
    ["client-orders"],
    "/api/v1/orders",
  );
  const [planId, setPlanId] = useState("");

  const createOrder = useMutation({
    mutationFn: () => {
      if (!me?.clientId) throw new Error("Missing client profile");
      return apiFetch("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify({
          clientId: me.clientId,
          items: [{ planId, quantity: 1 }],
        }),
      });
    },
    onSuccess: () => {
      toast.success("Order created — invoice issued");
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const plans = products.flatMap((p) =>
    p.plans.map((plan) => ({
      ...plan,
      label: `${p.name} — ${plan.name} (${formatMoney(plan.price, plan.currency)})`,
    })),
  );

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Place order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Plan ID</Label>
              <Input
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                placeholder="Paste plan id"
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block text-left hover:text-foreground"
                  onClick={() => setPlanId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              disabled={!planId || createOrder.isPending}
              onClick={() => createOrder.mutate()}
            >
              Order
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Badge>{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatMoney(order.total, order.currency)}
                      </TableCell>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
