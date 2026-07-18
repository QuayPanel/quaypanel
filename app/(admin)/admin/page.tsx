"use client";

import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";

type Dashboard = {
  clients: number;
  products: number;
  orders: number;
  unpaidInvoices: number;
  paidInvoices: number;
  payments: number;
  revenueMinor: number;
};

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useApiQuery<Dashboard>(
    ["dashboard"],
    "/api/v1/dashboard",
  );

  const stats = [
    { label: "Clients", value: data?.clients },
    { label: "Products", value: data?.products },
    { label: "Orders", value: data?.orders },
    { label: "Unpaid invoices", value: data?.unpaidInvoices },
    { label: "Paid invoices", value: data?.paidInvoices },
    {
      label: "Revenue",
      value: data ? formatMoney(data.revenueMinor) : undefined,
    },
  ];

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Dashboard</h1>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stat.value ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageMotion>
  );
}
