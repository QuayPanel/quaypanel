"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
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
import { formatMoney } from "@/src/core/utils";

type FraudBlock = {
  id: string;
  type: string;
  value: string;
  note: string | null;
  createdAt: string;
};

type PendingOrder = {
  id: string;
  number: number;
  total: number;
  currency: string;
  status: string;
  reviewStatus: string;
  createdAt: string;
  client: { name: string; email: string };
};

export default function AdminFraudPage() {
  const queryClient = useQueryClient();
  const { data: blocks = [], isLoading: blocksLoading } = useApiQuery<
    FraudBlock[]
  >(["fraud-blocks"], "/api/v1/fraud/blocks");
  const { data: orders = [], isLoading: ordersLoading } = useApiQuery<
    PendingOrder[]
  >(["fraud-orders"], "/api/v1/fraud/orders");

  const [blockForm, setBlockForm] = useState({
    type: "ip",
    value: "",
    note: "",
  });

  const addBlock = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/fraud/blocks", {
        method: "POST",
        body: JSON.stringify({
          type: blockForm.type,
          value: blockForm.value,
          note: blockForm.note || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Block added");
      setBlockForm({ type: blockForm.type, value: "", note: "" });
      queryClient.invalidateQueries({ queryKey: ["fraud-blocks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeBlock = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/fraud/blocks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Block removed");
      queryClient.invalidateQueries({ queryKey: ["fraud-blocks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/fraud/orders/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Order approved");
      queryClient.invalidateQueries({ queryKey: ["fraud-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/fraud/orders/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Order rejected");
      queryClient.invalidateQueries({ queryKey: ["fraud-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Fraud & review"
        description="Block risky signups and manually review orders before provisioning."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={blockForm.type}
                  onChange={(e) =>
                    setBlockForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="ip">IP</option>
                  <option value="country">Country</option>
                  <option value="email_domain">Email domain</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Value</Label>
                <Input
                  value={blockForm.value}
                  onChange={(e) =>
                    setBlockForm((f) => ({ ...f, value: e.target.value }))
                  }
                  placeholder={
                    blockForm.type === "country" ? "US" : "example.com"
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={blockForm.note}
                onChange={(e) =>
                  setBlockForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
            <Button
              onClick={() => addBlock.mutate()}
              disabled={!blockForm.value.trim() || addBlock.isPending}
            >
              Add block
            </Button>

            {blocksLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active blocks.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => (
                    <TableRow key={block.id}>
                      <TableCell>{block.type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {block.value}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {block.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBlock.mutate(block.id)}
                          disabled={removeBlock.isPending}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending review</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No orders awaiting review.
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>#{order.number}</TableCell>
                      <TableCell>
                        <div>{order.client.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.client.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatMoney(order.total, order.currency)}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(String(order.number))}
                          disabled={approve.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => reject.mutate(String(order.number))}
                          disabled={reject.isPending}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
