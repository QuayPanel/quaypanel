"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";

type Me = { clientId: string | null };
type Affiliate = {
  code: string;
  commissionPercent: number;
  balanceMinor: number;
  status: string;
  referrals: Array<{
    id: string;
    commissionMinor: number;
    status: string;
    createdAt: string;
  }>;
} | null;

type Payout = {
  id: string;
  amountMinor: number;
  status: string;
  createdAt: string;
};

export default function ClientAffiliatesPage() {
  const queryClient = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState("");
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: affiliate, isLoading } = useApiQuery<Affiliate>(
    ["client-affiliate"],
    "/api/v1/affiliates",
  );
  const { data: payouts = [] } = useApiQuery<Payout[]>(
    ["client-affiliate-payouts"],
    "/api/v1/affiliates/payouts",
    { enabled: Boolean(affiliate) },
  );

  const enroll = useMutation({
    mutationFn: () => {
      if (!me?.clientId) throw new Error("Missing client");
      return apiFetch("/api/v1/affiliates", {
        method: "POST",
        body: JSON.stringify({ clientId: me.clientId }),
      });
    },
    onSuccess: () => {
      toast.success("Enrolled as affiliate");
      queryClient.invalidateQueries({ queryKey: ["client-affiliate"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestPayout = useMutation({
    mutationFn: () => {
      const amountMinor = Math.round(Number(payoutAmount) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error("Enter a valid payout amount");
      }
      return apiFetch("/api/v1/affiliates/payouts", {
        method: "POST",
        body: JSON.stringify({ amountMinor }),
      });
    },
    onSuccess: () => {
      toast.success("Payout requested");
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["client-affiliate"] });
      queryClient.invalidateQueries({ queryKey: ["client-affiliate-payouts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const link =
    typeof window !== "undefined" && affiliate
      ? `${window.location.origin}/r/${affiliate.code}`
      : affiliate
        ? `/r/${affiliate.code}`
        : "";

  if (settings && settings["affiliates.enabled"] === false) {
    return (
      <PageMotion>
        <h1 className="mb-6 text-2xl font-semibold">Affiliates</h1>
        <p className="text-muted-foreground">
          The affiliate program is currently disabled.
        </p>
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Affiliates</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !affiliate ? (
        <Card>
          <CardHeader>
            <CardTitle>Join the affiliate program</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => enroll.mutate()}>Enroll</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your affiliate link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-mono break-all">{link}</p>
              <p>
                Commission: {affiliate.commissionPercent}% · Balance:{" "}
                {formatMoney(affiliate.balanceMinor)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request payout</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="25.00"
                  className="w-40"
                />
              </div>
              <Button
                disabled={requestPayout.isPending || !payoutAmount}
                onClick={() => requestPayout.mutate()}
              >
                Request payout
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payout history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payouts.length === 0 && (
                <p className="text-muted-foreground">No payout requests yet.</p>
              )}
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex justify-between border-b py-2"
                >
                  <span>{formatMoney(payout.amountMinor)}</span>
                  <span>{payout.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referrals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {affiliate.referrals.length === 0 && (
                <p className="text-muted-foreground">No referrals yet.</p>
              )}
              {affiliate.referrals.map((ref) => (
                <div key={ref.id} className="flex justify-between border-b py-2">
                  <span>{formatMoney(ref.commissionMinor)}</span>
                  <span>{ref.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </PageMotion>
  );
}
