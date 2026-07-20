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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  client: { name: string };
  createdAt: string;
};

type Client = { id: string; name: string; email: string };

export default function AdminInvoicesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Invoice[]>(
    ["invoices"],
    "/api/v1/invoices",
  );
  const { data: clients = [] } = useApiQuery<Client[]>(
    ["clients"],
    "/api/v1/clients",
  );

  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("50");

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          items: [
            {
              description: description || "Custom invoice item",
              quantity: 1,
              unitPrice: Number(amount),
            },
          ],
        }),
      }),
    onSuccess: () => {
      toast.success("Custom invoice created");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Invoices"
        description="Bills for orders, renewals, and upgrades."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Custom invoice"}
          </Button>
        }
      />
      {showForm && (
        <div className="mb-6 max-w-xl space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || create.isPending}
          >
            Create invoice
          </Button>
        </div>
      )}
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices are created from orders, renewals, and manual billing."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All invoices</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">
                      {invoice.number}
                    </TableCell>
                    <TableCell>{invoice.client.name}</TableCell>
                    <TableCell>
                      <Badge>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/invoices/${encodeURIComponent(invoice.number)}/pdf`}
                        >
                          PDF
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/invoices/${encodeURIComponent(invoice.number)}/edit`}>
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageMotion>
  );
}
