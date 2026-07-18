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

type Invoice = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  discountMinor: number;
  taxMinor: number;
  total: number;
  dueAt: string | null;
  payments: Array<{ id: string }>;
  client: { name: string };
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useApiQuery<Invoice>(
    ["invoice", id],
    `/api/v1/invoices/${id}`,
  );

  const [form, setForm] = useState({
    status: "UNPAID",
    dueAt: "",
    currency: "USD",
    subtotal: "0",
    discountMinor: "0",
    taxMinor: "0",
    total: "0",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPaid = invoice?.status === "PAID" || invoice?.status === "REFUNDED";
  const isVoid = invoice?.status === "VOID";
  const canHardDelete = Boolean(
    isVoid && invoice && invoice.payments.length === 0,
  );
  const canVoid = Boolean(invoice && !isPaid && !isVoid);

  useEffect(() => {
    if (!invoice) return;
    setForm({
      status: invoice.status,
      dueAt: toLocalInput(invoice.dueAt),
      currency: invoice.currency,
      subtotal: minorToDollars(invoice.subtotal),
      discountMinor: minorToDollars(invoice.discountMinor),
      taxMinor: minorToDollars(invoice.taxMinor),
      total: minorToDollars(invoice.total),
    });
  }, [invoice]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          currency: form.currency,
          subtotal: dollarsToMinor(form.subtotal),
          discountMinor: dollarsToMinor(form.discountMinor),
          taxMinor: dollarsToMinor(form.taxMinor),
          total: dollarsToMinor(form.total),
        }),
      }),
    onSuccess: () => {
      toast.success("Invoice updated");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const destroy = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(canHardDelete ? "Invoice deleted" : "Invoice voided");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (canHardDelete) {
        router.push("/admin/invoices");
      } else {
        queryClient.invalidateQueries({ queryKey: ["invoice", id] });
        setConfirmOpen(false);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaid = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !invoice) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`Invoice ${invoice.number}`}
      backHref="/admin/invoices"
      backLabel="Back to invoices"
      onSave={() => {
        if (isPaid) return;
        save.mutate();
      }}
      onCancel={() => router.push("/admin/invoices")}
      saving={save.isPending}
      showDelete={canVoid || canHardDelete}
      onDelete={() => setConfirmOpen(true)}
      deleteTitle={canHardDelete ? "Delete invoice?" : "Void invoice?"}
      deleteDescription={
        canHardDelete
          ? "This permanently deletes the voided invoice."
          : "This marks the invoice as VOID. You can permanently delete it afterward if it has no payments."
      }
      confirmOpen={confirmOpen}
      onCancelDelete={() => setConfirmOpen(false)}
      onConfirmDelete={() => destroy.mutate()}
      deleting={destroy.isPending}
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Client: {invoice.client.name} · Current total{" "}
            {formatMoney(invoice.total, invoice.currency)}
          </p>
          {isPaid ? (
            <p className="text-sm text-muted-foreground">
              Paid invoices are read-only.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.status}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="DRAFT">DRAFT</option>
                <option value="UNPAID">UNPAID</option>
                <option value="VOID">VOID</option>
                {isPaid ? <option value={invoice.status}>{invoice.status}</option> : null}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Due at</Label>
              <Input
                type="datetime-local"
                value={form.dueAt}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueAt: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <Input
                value={form.total}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, total: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Subtotal</Label>
              <Input
                value={form.subtotal}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtotal: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Discount</Label>
              <Input
                value={form.discountMinor}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountMinor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tax</Label>
              <Input
                value={form.taxMinor}
                disabled={isPaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxMinor: e.target.value }))
                }
              />
            </div>
          </div>
          {canVoid ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => markPaid.mutate()}
                disabled={markPaid.isPending}
              >
                {markPaid.isPending ? "Marking..." : "Mark as paid"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
              >
                Void invoice
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
