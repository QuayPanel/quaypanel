"use client";

import Link from "next/link";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/src/core/utils";

type Invoice = {
  id: string;
  status: string;
  total: number;
  currency: string;
};

type Service = { id: string; status: string };
type Ticket = { id: string; status: string };
type Affiliate = {
  code: string;
  balanceMinor: number;
  referrals: unknown[];
} | null;

export default function ClientDashboardPage() {
  const { data: invoices = [] } = useApiQuery<Invoice[]>(
    ["client-invoices"],
    "/api/v1/invoices",
  );
  const { data: services = [] } = useApiQuery<Service[]>(
    ["client-services"],
    "/api/v1/services",
  );
  const { data: tickets = [] } = useApiQuery<Ticket[]>(
    ["client-tickets"],
    "/api/v1/tickets",
  );
  const { data: affiliate } = useApiQuery<Affiliate>(
    ["client-affiliate"],
    "/api/v1/affiliates",
  );

  const unpaid = invoices.filter((i) => i.status === "UNPAID");
  const openTickets = tickets.filter((t) => t.status !== "CLOSED");

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Services</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {services.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Unpaid invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {unpaid.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Open tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {openTickets.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Amount due
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatMoney(
              unpaid.reduce((sum, i) => sum + i.total, 0),
              unpaid[0]?.currency ?? "USD",
            )}
          </CardContent>
        </Card>
      </div>

      {affiliate && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Affiliate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              Code <span className="font-mono">{affiliate.code}</span> · Balance{" "}
              {formatMoney(affiliate.balanceMinor)}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/client/affiliates">View details</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/store">Browse store</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/client/invoices">Invoices</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/client/tickets">Tickets</Link>
        </Button>
      </div>
    </PageMotion>
  );
}
