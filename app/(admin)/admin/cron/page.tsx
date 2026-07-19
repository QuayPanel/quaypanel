"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type CronStatsRange = "today" | "week" | "month" | "year";

type CronStats = {
  lastSchedulerRun: string | null;
  lastCronRun: string | null;
  nextCronRun: string;
  cronTime: string;
  timezone: string;
  range: CronStatsRange;
  series: Array<{
    date: string;
    invoicesCreated: number;
    servicesSuspended: number;
    servicesTerminated: number;
    invoicesCharged: number;
  }>;
  today: {
    invoicesCreated: number;
    servicesSuspended: number;
    servicesTerminated: number;
    ticketsClosed: number;
    invoicesCharged: number;
  };
};

const RANGE_OPTIONS: Array<{ value: CronStatsRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
  { value: "year", label: "This Year" },
];

const SERIES_COLORS = {
  invoicesCreated: "#2563eb",
  servicesSuspended: "#d97706",
  servicesTerminated: "#dc2626",
  invoicesCharged: "#16a34a",
} as const;

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function AdminCronPage() {
  const [range, setRange] = useState<CronStatsRange>("week");
  const { data, isLoading, error } = useApiQuery<CronStats>(
    ["cron-stats", range],
    `/api/v1/cron-stats?range=${range}`,
  );

  const todayStats = [
    {
      label: "Invoices Created",
      value: data?.today.invoicesCreated,
      color: SERIES_COLORS.invoicesCreated,
    },
    {
      label: "Services Suspended",
      value: data?.today.servicesSuspended,
      color: SERIES_COLORS.servicesSuspended,
    },
    {
      label: "Services Terminated",
      value: data?.today.servicesTerminated,
      color: SERIES_COLORS.servicesTerminated,
    },
    {
      label: "Tickets Closed",
      value: data?.today.ticketsClosed,
      color: "#7c3aed",
    },
    {
      label: "Invoices Charged",
      value: data?.today.invoicesCharged,
      color: SERIES_COLORS.invoicesCharged,
    },
  ];

  const hasRuns = Boolean(data?.lastCronRun || data?.lastSchedulerRun);

  return (
    <PageMotion>
      <PageHeader
        title="Cron"
        description={
          data?.cronTime
            ? `Renewal and maintenance job history · daily at ${data.cronTime} (${data.timezone})`
            : "Renewal and maintenance job history."
        }
        actions={
          <div className="space-y-2 sm:w-48">
            <Label htmlFor="cron-range">Period</Label>
            <select
              id="cron-range"
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={range}
              onChange={(e) => setRange(e.target.value as CronStatsRange)}
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      {!isLoading && data && !hasRuns ? (
        <EmptyState
          title="No cron runs yet"
          description="Renewal and maintenance job history will appear after the scheduler runs."
        />
      ) : null}

      {data && hasRuns ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Last scheduler run
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {formatWhen(data.lastSchedulerRun)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Last cron run
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {formatWhen(data.lastCronRun)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Next cron run
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {formatWhen(data.nextCronRun)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Cron activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      width={40}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="invoicesCreated"
                      name="Invoices Created"
                      stroke={SERIES_COLORS.invoicesCreated}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="servicesSuspended"
                      name="Services Suspended"
                      stroke={SERIES_COLORS.servicesSuspended}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="servicesTerminated"
                      name="Services Terminated"
                      stroke={SERIES_COLORS.servicesTerminated}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="invoicesCharged"
                      name="Invoices Charged"
                      stroke={SERIES_COLORS.invoicesCharged}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s cron totals
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {todayStats.map((stat) => (
                <Card key={stat.label}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stat.color }}
                      />
                      {stat.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">
                      {stat.value ?? 0}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </PageMotion>
  );
}
