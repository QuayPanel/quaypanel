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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/src/core/utils";

type Service = {
  id: string;
  status: string;
  nextDueAt: string | null;
  cancelAt: string | null;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

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

  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelMode, setCancelMode] = useState<"end_of_term" | "immediate">(
    "end_of_term",
  );
  const [cancelReason, setCancelReason] = useState("");
  const [immediateConfirmOpen, setImmediateConfirmOpen] = useState(false);

  const upgradeTargets = useMemo(() => {
    const service = services.find((s) => s.id === upgradeFor);
    if (!service) return [];
    const links =
      products.find((p) => p.id === service.plan.product.id)?.upgrades ?? [];
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

  const cancelService = useMutation({
    mutationFn: (mode: "end_of_term" | "immediate") =>
      apiFetch(`/api/v1/services/${cancelFor}`, {
        method: "POST",
        body: JSON.stringify({
          action: "cancel",
          mode,
          reason: cancelReason.trim() || null,
        }),
      }),
    onSuccess: (_data, mode) => {
      toast.success(
        mode === "immediate"
          ? "Service termination requested"
          : "Cancellation scheduled for end of term",
      );
      setCancelFor(null);
      setCancelReason("");
      setImmediateConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const undoCancel = useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch(`/api/v1/services/${serviceId}`, {
        method: "POST",
        body: JSON.stringify({ action: "cancel_undo" }),
      }),
    onSuccess: () => {
      toast.success("Cancellation removed");
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function submitCancel() {
    if (cancelMode === "immediate") {
      setImmediateConfirmOpen(true);
      return;
    }
    cancelService.mutate("end_of_term");
  }

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Services</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          {services.map((service) => {
            const canManage =
              service.status === "ACTIVE" || service.status === "SUSPENDED";
            const pendingCancel = Boolean(service.cancelAt) && canManage;

            return (
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
                    {service.nextDueAt
                      ? ` · Next due ${formatDate(service.nextDueAt)}`
                      : ""}
                  </p>

                      {pendingCancel ? (
                    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                      <p>
                        {service.cancelAt &&
                        new Date(service.cancelAt).getTime() <= Date.now()
                          ? "Termination in progress…"
                          : (
                              <>
                                Cancellation scheduled for{" "}
                                <strong>{formatDate(service.cancelAt)}</strong>
                              </>
                            )}
                      </p>
                      {service.cancelReason ? (
                        <p className="text-muted-foreground">
                          Reason: {service.cancelReason}
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={undoCancel.isPending}
                        onClick={() => undoCancel.mutate(service.id)}
                      >
                        Remove cancellation
                      </Button>
                    </div>
                  ) : null}

                  {canManage && !pendingCancel ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUpgradeFor(service.id);
                          setCancelFor(null);
                          setTargetProductId("");
                          setTargetPlanId("");
                        }}
                      >
                        Upgrade
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setCancelFor(service.id);
                          setUpgradeFor(null);
                          setCancelMode(
                            service.nextDueAt ? "end_of_term" : "immediate",
                          );
                          setCancelReason("");
                        }}
                      >
                        Cancel service
                      </Button>
                    </div>
                  ) : null}

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
                              {plan.name} —{" "}
                              {formatMoney(plan.price, plan.currency)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={
                            !targetProductId ||
                            !targetPlanId ||
                            upgrade.isPending
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
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {cancelFor === service.id ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="space-y-2">
                        <Label>When to cancel</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                          value={cancelMode}
                          onChange={(e) =>
                            setCancelMode(
                              e.target.value as "end_of_term" | "immediate",
                            )
                          }
                        >
                          {service.nextDueAt ? (
                            <option value="end_of_term">
                              At end of service date (
                              {formatDate(service.nextDueAt)})
                            </option>
                          ) : null}
                          <option value="immediate">Cancel immediately</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <textarea
                          className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Tell us why you're cancelling…"
                          maxLength={2000}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={cancelService.isPending}
                          onClick={submitCancel}
                        >
                          Confirm cancellation
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelFor(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={immediateConfirmOpen}
        title="Cancel immediately?"
        description="This will terminate your service right away. Access will stop and this cannot be undone from your account. Are you sure?"
        confirmLabel="Yes, cancel immediately"
        loading={cancelService.isPending}
        onCancel={() => setImmediateConfirmOpen(false)}
        onConfirm={() => cancelService.mutate("immediate")}
      />
    </PageMotion>
  );
}
