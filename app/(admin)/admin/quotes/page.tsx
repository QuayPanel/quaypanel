"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/src/core/utils";

type Quote = {
  id: string;
  number: number;
  status: string;
  total: number;
  currency: string;
  client: { name: string };
  createdAt: string;
};

export default function AdminQuotesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Quote[]>(
    ["quotes"],
    "/api/v1/quotes",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<Quote | null>(null);

  const send = useMutation({
    mutationFn: (number: number) =>
      apiFetch(`/api/v1/quotes/${number}/send`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Quote sent");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const convert = useMutation({
    mutationFn: (number: number) =>
      apiFetch(`/api/v1/quotes/${number}/convert`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Converted to invoice");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (quote: Quote) =>
      apiFetch(`/api/v1/quotes/${quote.number}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Quote deleted");
      setConfirmOpen(false);
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Quotes"
        description="Custom quotes for offline sales and approvals."
        actions={
          <Button asChild>
            <Link href="/admin/quotes/new">New quote</Link>
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create a quote to send pricing to a client."
          actionHref="/admin/quotes/new"
          actionLabel="New quote"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono">{quote.number}</TableCell>
                    <TableCell>{quote.client.name}</TableCell>
                    <TableCell>
                      <Badge className="border-dashed">{quote.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(quote.total, quote.currency)}
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      {(quote.status === "DRAFT" || quote.status === "SENT") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => send.mutate(quote.number)}
                        >
                          Send
                        </Button>
                      )}
                      {(quote.status === "SENT" ||
                        quote.status === "ACCEPTED") && (
                        <Button
                          size="sm"
                          onClick={() => convert.mutate(quote.number)}
                        >
                          Convert
                        </Button>
                      )}
                      {quote.status !== "CONVERTED" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setPending(quote);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete quote?"
        description={`Permanently delete quote #${pending?.number}? This cannot be undone.`}
        onCancel={() => {
          setConfirmOpen(false);
          setPending(null);
        }}
        onConfirm={() => {
          if (pending) remove.mutate(pending);
        }}
        loading={remove.isPending}
      />
    </PageMotion>
  );
}
