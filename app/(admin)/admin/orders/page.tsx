"use client";

import Link from "next/link";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
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
  const { data = [], isLoading } = useApiQuery<Order[]>(
    ["orders"],
    "/api/v1/orders",
  );

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24" />
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
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/orders/${order.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
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
