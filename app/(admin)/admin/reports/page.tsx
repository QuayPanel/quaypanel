"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";

type Summary = {
  mrrEstimateMinor: number;
  ordersCount: number;
  revenueMinor: number;
  taxMinor: number;
  byGateway: Array<{ gatewayId: string; count: number; amountMinor: number }>;
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AdminReportsPage() {
  const range = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const { data: summary, isLoading } = useApiQuery<Summary>(
    ["admin-report-summary", from, to],
    `/api/v1/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-report-summary"] });

  return (
    <PageMotion>
      <PageHeader
        title="Reports"
        description="Revenue summary and CSV exports."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refresh()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {isLoading || !summary ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MRR estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.mrrEstimateMinor)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {summary.ordersCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.revenueMinor)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tax collected
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.taxMinor)}
            </CardContent>
          </Card>
        </div>
      )}

      {summary && summary.byGateway.length > 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Revenue by gateway</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Gateway</th>
                  <th className="py-2 pr-4">Payments</th>
                  <th className="py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.byGateway.map((row) => (
                  <tr key={row.gatewayId} className="border-b">
                    <td className="py-2 pr-4 font-mono">{row.gatewayId}</td>
                    <td className="py-2 pr-4">{row.count}</td>
                    <td className="py-2">{formatMoney(row.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>CSV exports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/v1/exports/clients" download>
              Export clients
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/v1/exports/invoices" download>
              Export invoices
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/v1/exports/payments" download>
              Export payments
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/v1/exports/services" download>
              Export services
            </a>
          </Button>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
