"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
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

export default function ClientAffiliatesPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data: affiliate, isLoading } = useApiQuery<Affiliate>(
    ["client-affiliate"],
    "/api/v1/affiliates",
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
