"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/src/core/utils";

type Me = { clientId: string | null };

type Contributor = {
  id: string;
  email: string | null;
  canPay: boolean;
  client: { name: string; email: string };
};

type Service = {
  id: string;
  number: number;
  status: string;
  clientId: string;
  hostname: string | null;
  externalId: string | null;
  providerId: string;
  nextDueAt: string | null;
  billingCycle: string;
  cancelAt: string | null;
  cancelReason: string | null;
  plan: {
    name: string;
    price: number;
    currency: string;
    product: { name: string };
  };
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function ClientServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: service, isLoading } = useApiQuery<Service>(
    ["client-service", id],
    `/api/v1/services/${id}`,
  );
  const isOwner = Boolean(me?.clientId && service?.clientId === me.clientId);
  const { data: contributors = [] } = useApiQuery<Contributor[]>(
    ["service-contributors", id],
    `/api/v1/services/${id}/contributors`,
    { enabled: isOwner },
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCanPay, setInviteCanPay] = useState(true);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<"end_of_term" | "immediate">(
    "end_of_term",
  );
  const [cancelReason, setCancelReason] = useState("");
  const [immediateConfirm, setImmediateConfirm] = useState(false);

  const openConsole = useMutation({
    mutationFn: () =>
      apiFetch<{ console: { url: string; label: string } | null }>(
        `/api/v1/services/${id}`,
        { method: "POST", body: JSON.stringify({ action: "console" }) },
      ),
    onSuccess: (data) => {
      if (!data.console?.url) {
        toast.error("No panel link available for this service");
        return;
      }
      window.open(data.console.url, "_blank", "noopener,noreferrer");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelService = useMutation({
    mutationFn: (mode: "end_of_term" | "immediate") =>
      apiFetch(`/api/v1/services/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action: "cancel",
          mode,
          reason: cancelReason.trim() || null,
        }),
      }),
    onSuccess: (_d, mode) => {
      toast.success(
        mode === "immediate"
          ? "Termination requested"
          : "Cancellation scheduled",
      );
      setCancelOpen(false);
      setImmediateConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["client-service", id] });
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const undoCancel = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/services/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "cancel_undo" }),
      }),
    onSuccess: () => {
      toast.success("Cancellation removed");
      queryClient.invalidateQueries({ queryKey: ["client-service", id] });
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteContributor = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/services/${id}/contributors`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, canPay: inviteCanPay }),
      }),
    onSuccess: () => {
      toast.success("Contributor invited");
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["service-contributors", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeContributor = useMutation({
    mutationFn: (contributorId: string) =>
      apiFetch(`/api/v1/services/${id}/contributors/${contributorId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Contributor removed");
      queryClient.invalidateQueries({ queryKey: ["service-contributors", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !service) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const canManage =
    service.status === "ACTIVE" || service.status === "SUSPENDED";
  const pendingCancel = Boolean(service.cancelAt) && canManage;

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/client/services">← Services</Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {service.plan.product.name} / {service.plan.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Service #{service.number}
          </p>
        </div>
        <Badge>{service.status}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Price:</span>{" "}
              {formatMoney(service.plan.price, service.plan.currency)} /{" "}
              {service.billingCycle}
            </p>
            <p>
              <span className="text-muted-foreground">Next due:</span>{" "}
              {formatDate(service.nextDueAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Hostname:</span>{" "}
              {service.hostname || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">External ID:</span>{" "}
              {service.externalId || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Provider:</span>{" "}
              {service.providerId}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open your provider panel for this service. You may need to be
              logged into the panel separately.
            </p>
            <Button
              disabled={
                openConsole.isPending ||
                service.status === "TERMINATED" ||
                service.status === "PENDING"
              }
              onClick={() => openConsole.mutate()}
            >
              {openConsole.isPending ? "Opening…" : "Open panel"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {isOwner ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Billing contributors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Invite others to view and pay invoices for this service.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="contributor@example.com"
                />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={inviteCanPay}
                  onChange={(e) => setInviteCanPay(e.target.checked)}
                />
                Can pay invoices
              </label>
              <Button
                disabled={!inviteEmail.trim() || inviteContributor.isPending}
                onClick={() => inviteContributor.mutate()}
              >
                Invite
              </Button>
            </div>
            {contributors.length === 0 ? (
              <p className="text-muted-foreground">No contributors yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {contributors.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p>{row.client.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.canPay ? "Can pay" : "View only"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokeContributor.isPending}
                      onClick={() => revokeContributor.mutate(row.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {pendingCancel ? (
        <Card className="mt-4 border-amber-500/40">
          <CardContent className="space-y-2 pt-6 text-sm">
            <p>
              Cancellation scheduled for{" "}
              <strong>{formatDate(service.cancelAt)}</strong>
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
              onClick={() => undoCancel.mutate()}
            >
              Remove cancellation
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canManage && !pendingCancel ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/client/services">Upgrade from list</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setCancelOpen(true);
              setCancelMode(service.nextDueAt ? "end_of_term" : "immediate");
            }}
          >
            Cancel service
          </Button>
        </div>
      ) : null}

      {cancelOpen ? (
        <Card className="mt-4">
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-2">
              <Label>When to cancel</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={cancelMode}
                onChange={(e) =>
                  setCancelMode(e.target.value as "end_of_term" | "immediate")
                }
              >
                {service.nextDueAt ? (
                  <option value="end_of_term">
                    At end of term ({formatDate(service.nextDueAt)})
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
                maxLength={2000}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={cancelService.isPending}
                onClick={() => {
                  if (cancelMode === "immediate") setImmediateConfirm(true);
                  else cancelService.mutate("end_of_term");
                }}
              >
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={immediateConfirm}
        title="Cancel immediately?"
        description="This terminates your service right away and cannot be undone from your account."
        confirmLabel="Yes, cancel immediately"
        loading={cancelService.isPending}
        onCancel={() => setImmediateConfirm(false)}
        onConfirm={() => cancelService.mutate("immediate")}
      />
    </PageMotion>
  );
}
