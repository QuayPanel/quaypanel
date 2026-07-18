"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";

type Service = {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    product: {
      id: string;
      name: string;
      upgrades?: Array<{
        targetProductId: string;
        targetProduct?: {
          id: string;
          name: string;
          plans: Array<{ id: string; name: string; price: number }>;
        };
      }>;
    };
  };
};

type CatalogProduct = {
  id: string;
  name: string;
  plans: Array<{ id: string; name: string; price: number; currency: string }>;
  upgrades?: Array<{ targetProductId: string }>;
};

export default function ClientServicesPage() {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useApiQuery<Service[]>(
    ["client-services"],
    "/api/v1/services",
  );
  const { data: products = [] } = useApiQuery<CatalogProduct[]>(
    ["catalog-products"],
    "/api/v1/catalog",
  );

  const [upgradeFor, setUpgradeFor] = useState<string | null>(null);
  const [targetProductId, setTargetProductId] = useState("");
  const [targetPlanId, setTargetPlanId] = useState("");

  const upgradeTargets = useMemo(() => {
    const service = services.find((s) => s.id === upgradeFor);
    if (!service) return [];
    const links = products.find((p) => p.id === service.plan.product.id)?.upgrades ?? [];
    return products.filter((p) =>
      links.some((u) => u.targetProductId === p.id),
    );
  }, [services, products, upgradeFor]);

  const targetPlans = useMemo(() => {
    return products.find((p) => p.id === targetProductId)?.plans ?? [];
  }, [products, targetProductId]);

  useEffect(() => {
    setTargetPlanId(targetPlans[0]?.id ?? "");
  }, [targetPlans]);

  const upgrade = useMutation({
    mutationFn: () =>
      apiFetch<{ chargeMinor?: number; upgradeInvoiceId?: string }>(
        `/api/v1/services/${upgradeFor}`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "upgrade",
            targetProductId,
            targetPlanId,
          }),
        },
      ),
    onSuccess: (data) => {
      if (data.upgradeInvoiceId && (data.chargeMinor ?? 0) > 0) {
        toast.success("Upgraded — prorated invoice created");
      } else {
        toast.success("Service upgraded");
      }
      setUpgradeFor(null);
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Services</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {service.plan.product.name} / {service.plan.name}
                </CardTitle>
                <Badge>{service.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {formatMoney(service.plan.price, service.plan.currency)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUpgradeFor(service.id);
                    setTargetProductId("");
                    setTargetPlanId("");
                  }}
                >
                  Upgrade
                </Button>
                {upgradeFor === service.id ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>Target product</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                        value={targetProductId}
                        onChange={(e) => setTargetProductId(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {upgradeTargets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Target plan</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                        value={targetPlanId}
                        onChange={(e) => setTargetPlanId(e.target.value)}
                      >
                        {targetPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} — {formatMoney(plan.price, plan.currency)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={
                          !targetProductId || !targetPlanId || upgrade.isPending
                        }
                        onClick={() => upgrade.mutate()}
                      >
                        Confirm upgrade
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUpgradeFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageMotion>
  );
}
