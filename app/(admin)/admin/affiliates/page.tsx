"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/src/core/utils";

type Affiliate = {
  id: string;
  code: string;
  commissionPercent: number;
  balanceMinor: number;
  status: string;
  client: { name: string; email: string };
  referrals: Array<{
    id: string;
    commissionMinor: number;
    status: string;
  }>;
};

type Payout = {
  id: string;
  amountMinor: number;
  status: string;
  createdAt: string;
  client: { name: string; email: string };
  affiliate: { code: string };
};

export default function AdminAffiliatesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("program");
  const { data = [], isLoading } = useApiQuery<Affiliate[]>(
    ["admin-affiliates"],
    "/api/v1/affiliates",
  );
  const { data: payouts = [], isLoading: payoutsLoading } = useApiQuery<
    Payout[]
  >(["admin-affiliate-payouts"], "/api/v1/affiliates/payouts");

  const updateReferral = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "APPROVED" | "PAID";
    }) =>
      apiFetch(`/api/v1/affiliates/referrals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Referral updated");
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePayout = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "APPROVED" | "PAID" | "REJECTED";
    }) =>
      apiFetch(`/api/v1/affiliates/payouts?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Payout updated");
      queryClient.invalidateQueries({ queryKey: ["admin-affiliate-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Affiliates"
        description="Referral partners, commissions, and payouts."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="program">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : data.length === 0 ? (
            <EmptyState
              title="No affiliates yet"
              description="Affiliates are created when you enroll partners."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Affiliates</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((aff) => (
                      <TableRow key={aff.id}>
                        <TableCell>
                          <div>{aff.client.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {aff.client.email}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{aff.code}</TableCell>
                        <TableCell>{formatMoney(aff.balanceMinor)}</TableCell>
                        <TableCell className="space-y-2">
                          {aff.referrals.slice(0, 3).map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span>
                                {formatMoney(ref.commissionMinor)} · {ref.status}
                              </span>
                              {ref.status === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateReferral.mutate({
                                      id: ref.id,
                                      status: "APPROVED",
                                    })
                                  }
                                >
                                  Approve
                                </Button>
                              )}
                              {ref.status === "APPROVED" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateReferral.mutate({
                                      id: ref.id,
                                      status: "PAID",
                                    })
                                  }
                                >
                                  Mark paid
                                </Button>
                              )}
                            </div>
                          ))}
                          {aff.referrals.length > 3 ? (
                            <div className="text-xs text-muted-foreground">
                              +{aff.referrals.length - 3} more
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/affiliates/${aff.id}/edit`}>
                              Edit
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payouts">
          {payoutsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : payouts.length === 0 ? (
            <EmptyState
              title="No payout requests"
              description="Affiliates request payouts from their client area."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Payout queue</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div>{payout.client.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {payout.affiliate.code} · {payout.client.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatMoney(payout.amountMinor)}
                        </TableCell>
                        <TableCell>{payout.status}</TableCell>
                        <TableCell>
                          {new Date(payout.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="space-x-2">
                          {payout.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updatePayout.mutate({
                                    id: payout.id,
                                    status: "APPROVED",
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  updatePayout.mutate({
                                    id: payout.id,
                                    status: "REJECTED",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {(payout.status === "APPROVED" ||
                            payout.status === "PENDING") && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updatePayout.mutate({
                                  id: payout.id,
                                  status: "PAID",
                                })
                              }
                            >
                              Mark paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageMotion>
  );
}
