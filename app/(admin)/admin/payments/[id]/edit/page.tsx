"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dollarsToMinor, formatMoney, minorToDollars } from "@/src/core/utils";

type Payment = {
  id: string;
  gatewayId: string;
  status: string;
  amount: number;
  currency: string;
  invoice: { number: string; client?: { name: string } };
};

export default function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: payment, isLoading } = useApiQuery<Payment>(
    ["payment", id],
    `/api/v1/payments/${id}`,
  );

  const [form, setForm] = useState({
    status: "PENDING",
    amount: "0",
    currency: "USD",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isCompleted = payment?.status === "COMPLETED";
  const isRefunded = payment?.status === "REFUNDED";
  const canDelete =
    payment &&
    (payment.status === "PENDING" || payment.status === "FAILED");

  useEffect(() => {
    if (!payment) return;
    setForm({
      status: payment.status,
      amount: minorToDollars(payment.amount),
      currency: payment.currency,
    });
  }, [payment]);

  const save = useMutation({
    mutationFn: () => {
      if (isCompleted) {
        return apiFetch(`/api/v1/payments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: form.status }),
        });
      }
      return apiFetch(`/api/v1/payments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          amount: dollarsToMinor(form.amount),
          currency: form.currency,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Payment updated");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Payment deleted");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      router.push("/admin/payments");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const refund = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/payments/${id}/refund`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Payment refunded (credit applied when enabled)");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !payment) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`Payment ${payment.id.slice(0, 8)}…`}
      backHref="/admin/payments"
      backLabel="Back to payments"
      onSave={() => save.mutate()}
      onCancel={() => router.push("/admin/payments")}
      saving={save.isPending || isRefunded}
      showDelete={Boolean(canDelete)}
      onDelete={() => setConfirmOpen(true)}
      deleteTitle="Delete payment?"
      deleteDescription="This permanently deletes the pending/failed payment record."
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
            Invoice {payment.invoice.number} · Gateway {payment.gatewayId} ·{" "}
            {formatMoney(payment.amount, payment.currency)}
          </p>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
              value={form.status}
              disabled={isRefunded}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              {isCompleted ? (
                <>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REFUNDED">REFUNDED</option>
                </>
              ) : (
                <>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                </>
              )}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                value={form.amount}
                disabled={isCompleted || isRefunded}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                disabled={isCompleted || isRefunded}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              />
            </div>
          </div>
          {isCompleted ? (
            <Button
              type="button"
              variant="destructive"
              disabled={refund.isPending}
              onClick={() => refund.mutate()}
            >
              {refund.isPending ? "Refunding..." : "Refund & credit client"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
