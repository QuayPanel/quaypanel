"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmailLogRow = {
  id: string;
  to: string;
  from: string;
  subject: string;
  status: string;
  templateKey: string | null;
  error: string | null;
  createdAt: string;
};

type EmailLogsResponse = {
  items: EmailLogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function AdminEmailLogsPage() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("pageSize", "25");
    return `/api/v1/email-logs?${params.toString()}`;
  }, [status, q, page]);

  const { data, isLoading } = useApiQuery<EmailLogsResponse>(
    ["email-logs", status, q, String(page)],
    query,
  );

  const items = data?.items ?? [];

  return (
    <PageMotion>
      <PageHeader
        title="Email logs"
        description="History of outbound emails, including failures and SMTP-not-configured logs."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="flex h-10 rounded-md border border-input bg-card px-3 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="logged">Logged (no SMTP)</option>
        </select>
        <Input
          className="max-w-sm"
          placeholder="Search to, from, or subject…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No emails logged yet"
          description="Sent, failed, and dry-run emails appear here after the worker processes them."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Logs ({data?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/admin/email-logs/${row.id}`}
                        className="block hover:underline"
                      >
                        {new Date(row.createdAt).toLocaleString()}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/email-logs/${row.id}`}>
                        {row.to}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs">
                      {row.from || "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      <Link href={`/admin/email-logs/${row.id}`}>
                        {row.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.templateKey ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.status === "failed"
                            ? "text-destructive"
                            : row.status === "sent"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }
                      >
                        {row.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data && data.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </PageMotion>
  );
}
