"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { CaptchaField, type CaptchaFieldHandle } from "@/components/captcha-field";
import { PageHeader } from "@/components/admin/page-header";
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
import { formatMoney } from "@/src/core/utils";

type CreditPayload = {
  balance: number;
  balanceMinor: number;
  ledger: Array<{
    id: string;
    amountMinor: number;
    type: string;
    note: string | null;
    createdAt: string;
  }>;
};

export default function ClientCreditsPage() {
  const queryClient = useQueryClient();
  const captchaRef = useRef<CaptchaFieldHandle>(null);
  const { data, isLoading } = useApiQuery<CreditPayload>(
    ["credits"],
    "/api/v1/credits",
  );
  const [amount, setAmount] = useState("25");

  const deposit = useMutation({
    mutationFn: async () => {
      const captchaToken = await captchaRef.current?.execute();
      return apiFetch<{ checkoutUrl: string | null }>("/api/v1/credits", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          gatewayId: "stripe",
          captchaToken,
        }),
      });
    },
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error("No checkout URL returned");
      }
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => {
      captchaRef.current?.reset();
      toast.error(err.message);
    },
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <PageMotion>
      <PageHeader
        title="Account credits"
        description="Pre-pay balance applied automatically at checkout."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {formatMoney(data.balanceMinor)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <CaptchaField ref={captchaRef} />
            <Button
              onClick={() => deposit.mutate()}
              disabled={deposit.isPending || Number(amount) <= 0}
            >
              {deposit.isPending ? "Redirecting..." : "Pay with Stripe"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {data.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.note ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.amountMinor)}
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
