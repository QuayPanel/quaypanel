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

type Order = {
  id: string;
  number: number;
  status: string;
  total: number;
  currency: string;
  client: { name: string; email: string };
  createdAt: string;
};

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Order[]>(
    ["orders"],
    "/api/v1/orders",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<Order | null>(null);

  const remove = useMutation({
    mutationFn: (order: Order) =>
      apiFetch(`/api/v1/orders/${order.number}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Order deleted");
      setConfirmOpen(false);
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Orders"
        description="Checkout submissions from the storefront."
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Orders appear after customers complete checkout."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>{order.client.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.client.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(order.total, order.currency)}
                    </TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/orders/${order.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      {order.status !== "COMPLETED" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setPending(order);
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
        title="Delete order?"
        description={`Permanently delete order #${pending?.number}? Linked unpaid invoices will be unlinked.`}
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
