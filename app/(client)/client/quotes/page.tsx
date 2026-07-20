"use client";

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
import { formatMoney } from "@/src/core/utils";

type Quote = {
  id: string;
  number: number;
  status: string;
  total: number;
  currency: string;
  validUntil: string | null;
  items: Array<{ description: string; total: number }>;
};

export default function ClientQuotesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Quote[]>(
    ["quotes"],
    "/api/v1/quotes",
  );

  const accept = useMutation({
    mutationFn: (number: number) =>
      apiFetch(`/api/v1/quotes/${number}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Quote accepted");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const decline = useMutation({
    mutationFn: (number: number) =>
      apiFetch(`/api/v1/quotes/${number}/decline`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Quote declined");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Quotes"
        description="Review and respond to quotes from our team."
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState title="No quotes" description="You have no quotes yet." />
      ) : (
        <div className="space-y-4">
          {data.map((quote) => (
            <Card key={quote.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Quote #{quote.number}</CardTitle>
                <Badge>{quote.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1 text-sm">
                  {quote.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{item.description}</span>
                      <span>{formatMoney(item.total, quote.currency)}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-medium">
                  Total {formatMoney(quote.total, quote.currency)}
                </p>
                {quote.validUntil && (
                  <p className="text-sm text-muted-foreground">
                    Valid until {new Date(quote.validUntil).toLocaleDateString()}
                  </p>
                )}
                {quote.status === "SENT" && (
                  <div className="flex gap-2">
                    <Button onClick={() => accept.mutate(quote.number)}>
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => decline.mutate(quote.number)}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageMotion>
  );
}
