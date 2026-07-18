"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
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

export default function AdminAffiliatesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Affiliate[]>(
    ["admin-affiliates"],
    "/api/v1/affiliates",
  );

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

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Affiliates</h1>
      <Card>
        <CardHeader>
          <CardTitle>Program</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Referrals</TableHead>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
