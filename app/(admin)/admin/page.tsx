"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
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
  setup: {
    brandConfigured: boolean;
    paymentGatewayEnabled: boolean;
    hasCategory: boolean;
    hasProductWithPlan: boolean;
    hasKnowledgeArticle: boolean;
  };
};

const SETUP_STEPS = [
  {
    key: "brandConfigured" as const,
    label: "Set your brand name or logo",
    href: "/admin/settings",
    core: true,
  },
  {
    key: "paymentGatewayEnabled" as const,
    label: "Enable a payment gateway",
    href: "/admin/settings",
    core: true,
  },
  {
    key: "hasCategory" as const,
    label: "Create a store category",
    href: "/admin/categories/new",
    core: true,
  },
  {
    key: "hasProductWithPlan" as const,
    label: "Add a product with at least one plan",
    href: "/admin/products/new",
    core: true,
  },
  {
    key: "hasKnowledgeArticle" as const,
    label: "Publish a knowledge base article",
    href: "/admin/knowledge/new",
    core: false,
  },
];

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

  const setup = data?.setup;
  const coreDone = setup
    ? SETUP_STEPS.filter((s) => s.core).every((s) => setup[s.key])
    : false;
  const showSetup = setup && !coreDone;

  return (
    <PageMotion>
      <PageHeader
        title="Dashboard"
        description="Overview of clients, catalog, and billing activity."
      />
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      {showSetup ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Getting started</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Complete these steps to open your storefront for customers.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {SETUP_STEPS.map((step) => {
                const done = Boolean(setup[step.key]);
                return (
                  <li key={step.key} className="flex items-start gap-2 text-sm">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {done ? (
                      <span className="text-muted-foreground line-through">
                        {step.label}
                        {!step.core ? " (optional)" : ""}
                      </span>
                    ) : (
                      <Link
                        href={step.href}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {step.label}
                        {!step.core ? (
                          <span className="text-muted-foreground">
                            {" "}
                            (optional)
                          </span>
                        ) : null}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
