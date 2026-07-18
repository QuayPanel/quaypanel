"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";

type Order = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | string;
  total: number;
  currency: string;
  client: { name: string; email: string };
  invoices: Array<{ id: string; status: string; number: string }>;
  createdAt: string;
};

export default function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useApiQuery<Order>(
    ["order", id],
    `/api/v1/orders/${id}`,
  );
  const [status, setStatus] = useState("PENDING");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (order) setStatus(order.status);
  }, [order]);

  const canDelete =
    order &&
    order.status !== "COMPLETED" &&
    !order.invoices.some((inv) => inv.status === "PAID");

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Order updated");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/orders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Order deleted");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/admin/orders");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !order) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`Order ${order.id.slice(0, 8)}…`}
      backHref="/admin/orders"
      backLabel="Back to orders"
      onSave={() => save.mutate()}
      onCancel={() => router.push("/admin/orders")}
      saving={save.isPending}
      showDelete={Boolean(canDelete)}
      onDelete={() => setConfirmOpen(true)}
      deleteTitle="Delete order?"
      deleteDescription="This permanently deletes the order. Linked unpaid invoices will be unlinked."
      confirmOpen={confirmOpen}
      onCancelDelete={() => setConfirmOpen(false)}
      onConfirmDelete={() => remove.mutate()}
      deleting={remove.isPending}
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {order.client.name} · {order.client.email}
          </p>
          <p className="text-sm">
            Total: {formatMoney(order.total, order.currency)}
          </p>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="PENDING">PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          {order.invoices.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              Invoices:{" "}
              {order.invoices
                .map((inv) => `${inv.number} (${inv.status})`)
                .join(", ")}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
