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

type Service = {
  id: string;
  status: string;
  hostname: string | null;
  providerId: string;
  externalId: string | null;
  nextDueAt: string | null;
  billingCycle: string;
  quantity: number;
  client: { name: string; email: string };
  plan: { name: string; product: { name: string } };
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: service, isLoading } = useApiQuery<Service>(
    ["service", id],
    `/api/v1/services/${id}`,
  );

  const [form, setForm] = useState({
    status: "PENDING",
    hostname: "",
    nextDueAt: "",
    quantity: "1",
    billingCycle: "month",
    providerId: "noop",
    externalId: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!service) return;
    setForm({
      status: service.status,
      hostname: service.hostname ?? "",
      nextDueAt: toLocalInput(service.nextDueAt),
      quantity: String(service.quantity),
      billingCycle: service.billingCycle,
      providerId: service.providerId,
      externalId: service.externalId ?? "",
    });
  }, [service]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          hostname: form.hostname || null,
          nextDueAt: form.nextDueAt
            ? new Date(form.nextDueAt).toISOString()
            : null,
          quantity: Number(form.quantity),
          billingCycle: form.billingCycle,
          providerId: form.providerId,
          externalId: form.externalId || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Service updated");
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["service", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const action = useMutation({
    mutationFn: (act: "suspend" | "unsuspend" | "terminate") =>
      apiFetch(`/api/v1/services/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: act }),
      }),
    onSuccess: () => {
      toast.success("Action queued");
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["service", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Service deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      router.push("/admin/services");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !service) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`${service.plan.product.name} / ${service.plan.name}`}
      backHref="/admin/services"
      backLabel="Back to services"
      onSave={() => save.mutate()}
      onCancel={() => router.push("/admin/services")}
      saving={save.isPending}
      showDelete
      onDelete={() => setConfirmOpen(true)}
      deleteTitle="Delete service?"
      deleteDescription="This permanently deletes the service record. Linked invoices will be unlinked."
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
            {service.client.name} · {service.client.email}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hostname</Label>
              <Input
                value={form.hostname}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hostname: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Next due</Label>
              <Input
                type="datetime-local"
                value={form.nextDueAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nextDueAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Billing cycle</Label>
              <Input
                value={form.billingCycle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billingCycle: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input
                value={form.providerId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, providerId: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>External ID</Label>
              <Input
                value={form.externalId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, externalId: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => action.mutate("suspend")}
            >
              Suspend
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => action.mutate("unsuspend")}
            >
              Unsuspend
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => action.mutate("terminate")}
            >
              Terminate
            </Button>
          </div>
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
