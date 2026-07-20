"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  filter: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
};

const FILTER_LABELS: Record<string, string> = {
  all: "All clients",
  activeServices: "Active services",
  overdue: "Overdue invoices",
  productId: "Product",
};

export default function AdminMailCampaignsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Campaign[]>(
    ["mail-campaigns"],
    "/api/v1/mail-campaigns",
  );

  const send = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/mail-campaigns/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send" }),
      }),
    onSuccess: () => {
      toast.success("Campaign sent");
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<Campaign>(`/api/v1/mail-campaigns/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "duplicate" }),
      }),
    onSuccess: (campaign) => {
      toast.success("Campaign duplicated");
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
      window.location.href = `/admin/mail-campaigns/${campaign.id}`;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/mail-campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Mail campaigns"
        description="Draft, save, and send markdown email campaigns to client audiences."
        actions={
          <Button asChild>
            <Link href="/admin/mail-campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a draft campaign, then send it when ready."
          actionHref="/admin/mail-campaigns/new"
          actionLabel="New campaign"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/admin/mail-campaigns/${campaign.id}`}
                          className="font-medium hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {campaign.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        {FILTER_LABELS[campaign.filter] ?? campaign.filter}
                      </TableCell>
                      <TableCell>
                        <Badge>{campaign.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {campaign.status === "DRAFT"
                          ? "—"
                          : `${campaign.sentCount}/${campaign.recipientCount} sent${
                              campaign.failedCount
                                ? `, ${campaign.failedCount} failed`
                                : ""
                            }`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/mail-campaigns/${campaign.id}`}>
                            Open
                          </Link>
                        </Button>
                        {(campaign.status === "DRAFT" ||
                          campaign.status === "FAILED") && (
                          <Button
                            size="sm"
                            disabled={send.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Send “${campaign.name}” to the selected audience now?`,
                                )
                              ) {
                                send.mutate(campaign.id);
                              }
                            }}
                          >
                            Send
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={duplicate.isPending}
                          onClick={() => duplicate.mutate(campaign.id)}
                        >
                          Duplicate
                        </Button>
                        {campaign.status !== "SENDING" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm("Delete this campaign?")) {
                                remove.mutate(campaign.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageMotion>
  );
}
