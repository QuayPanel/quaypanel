"use client";

import Link from "next/link";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dollarsToMinor, formatMoney, minorToDollars } from "@/src/core/utils";

type ReferredClient = {
  id: string;
  name: string;
  email: string;
  number: number;
} | null;

type Referral = {
  id: string;
  commissionMinor: number;
  status: string;
  createdAt: string;
  referredClientId: string | null;
  referredClient: ReferredClient;
};

type Affiliate = {
  id: string;
  code: string;
  commissionPercent: number;
  balanceMinor: number;
  status: string;
  client: {
    id: string;
    number: number;
    name: string;
    email: string;
  };
  referrals: Referral[];
};

export default function EditAffiliatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: affiliate, isLoading } = useApiQuery<Affiliate>(
    ["affiliate", id],
    `/api/v1/affiliates/${id}`,
  );

  const [form, setForm] = useState({
    code: "",
    balance: "0.00",
    commissionPercent: "10",
    status: "ACTIVE",
  });
  const [newReferral, setNewReferral] = useState({
    referredClient: "",
    commission: "0.00",
    status: "PENDING",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!affiliate) return;
    setForm({
      code: affiliate.code,
      balance: minorToDollars(affiliate.balanceMinor),
      commissionPercent: String(affiliate.commissionPercent),
      status: affiliate.status,
    });
  }, [affiliate]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/affiliates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: form.code.trim(),
          balanceMinor: dollarsToMinor(form.balance),
          commissionPercent: Number(form.commissionPercent),
          status: form.status,
        }),
      }),
    onSuccess: () => {
      toast.success("Affiliate updated");
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/affiliates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Affiliate deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      router.push("/admin/affiliates");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addReferral = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/affiliates/${id}/referrals`, {
        method: "POST",
        body: JSON.stringify({
          referredClient: newReferral.referredClient.trim() || null,
          commissionMinor: dollarsToMinor(newReferral.commission),
          status: newReferral.status,
        }),
      }),
    onSuccess: () => {
      toast.success("Referral added");
      setNewReferral({
        referredClient: "",
        commission: "0.00",
        status: "PENDING",
      });
      queryClient.invalidateQueries({ queryKey: ["affiliate", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteReferral = useMutation({
    mutationFn: (referralId: string) =>
      apiFetch(`/api/v1/affiliates/referrals/${referralId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Referral deleted");
      queryClient.invalidateQueries({ queryKey: ["affiliate", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateReferral = useMutation({
    mutationFn: ({
      referralId,
      status,
    }: {
      referralId: string;
      status: "APPROVED" | "PAID" | "PENDING";
    }) =>
      apiFetch(`/api/v1/affiliates/referrals/${referralId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Referral updated");
      queryClient.invalidateQueries({ queryKey: ["affiliate", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !affiliate) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`Affiliate ${affiliate.code}`}
      description={`${affiliate.client.name} · ${affiliate.client.email}`}
      backHref="/admin/affiliates"
      backLabel="Back to affiliates"
      onSave={() => save.mutate()}
      onCancel={() => router.push("/admin/affiliates")}
      saving={save.isPending}
      showDelete
      onDelete={() => setConfirmOpen(true)}
      deleteTitle="Delete affiliate?"
      deleteDescription="This permanently deletes the affiliate account, all referrals, and payout history. The client account is kept."
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
            Client{" "}
            <Link
              href={`/admin/clients/${affiliate.client.number}/edit`}
              className="underline"
            >
              #{affiliate.client.number} {affiliate.client.name}
            </Link>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Referral code</Label>
              <Input
                id="code"
                className="font-mono"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Balance (USD)</Label>
              <Input
                id="balance"
                type="number"
                min="0"
                step="0.01"
                value={form.balance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, balance: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission">Commission %</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.commissionPercent}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    commissionPercent: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="referred">Referred client</Label>
              <Input
                id="referred"
                placeholder="Email, client #, or id (optional)"
                value={newReferral.referredClient}
                onChange={(e) =>
                  setNewReferral((f) => ({
                    ...f,
                    referredClient: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-commission">Commission (USD)</Label>
              <Input
                id="ref-commission"
                type="number"
                min="0"
                step="0.01"
                value={newReferral.commission}
                onChange={(e) =>
                  setNewReferral((f) => ({
                    ...f,
                    commission: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-status">Status</Label>
              <select
                id="ref-status"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={newReferral.status}
                onChange={(e) =>
                  setNewReferral((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <Button
                type="button"
                onClick={() => addReferral.mutate()}
                disabled={addReferral.isPending}
              >
                {addReferral.isPending ? "Adding..." : "Add referral"}
              </Button>
            </div>
          </div>

          {affiliate.referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliate.referrals.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell>
                        {ref.referredClient ? (
                          <div>
                            <div>
                              #{ref.referredClient.number}{" "}
                              {ref.referredClient.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ref.referredClient.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatMoney(ref.commissionMinor)}
                      </TableCell>
                      <TableCell>{ref.status}</TableCell>
                      <TableCell>
                        {new Date(ref.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {ref.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateReferral.mutate({
                                referralId: ref.id,
                                status: "APPROVED",
                              })
                            }
                          >
                            Approve
                          </Button>
                        )}
                        {(ref.status === "PENDING" ||
                          ref.status === "APPROVED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateReferral.mutate({
                                referralId: ref.id,
                                status: "PAID",
                              })
                            }
                          >
                            Mark paid
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteReferral.mutate(ref.id)}
                          disabled={deleteReferral.isPending}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
