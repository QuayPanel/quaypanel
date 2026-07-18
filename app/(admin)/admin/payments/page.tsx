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

type Payment = {
  id: string;
  number: number;
  gatewayId: string;
  status: string;
  amount: number;
  currency: string;
  invoice: { number: string };
  createdAt: string;
};

export default function AdminPaymentsPage() {
  const { data = [], isLoading } = useApiQuery<Payment[]>(
    ["payments"],
    "/api/v1/payments",
  );

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Payments</h1>
      <Card>
        <CardHeader>
          <CardTitle>All payments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.invoice.number}</TableCell>
                    <TableCell>{payment.gatewayId}</TableCell>
                    <TableCell>
                      <Badge>{payment.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/payments/${payment.number}/edit`}>
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
