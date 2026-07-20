"use client";

import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
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

type Order = {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

export default function ClientOrdersPage() {
  const { data: orders = [], isLoading } = useApiQuery<Order[]>(
    ["client-orders"],
    "/api/v1/orders",
  );

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Badge>{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(order.total, order.currency)}
                    </TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
