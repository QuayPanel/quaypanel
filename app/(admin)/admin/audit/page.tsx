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

type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

export default function AdminAuditPage() {
  const { data = [], isLoading } = useApiQuery<Audit[]>(
    ["audit"],
    "/api/v1/audit",
  );

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Audit log</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {row.actor?.email ?? "system"}
                    </TableCell>
                    <TableCell>{row.action}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.entityType}
                      {row.entityId ? `:${row.entityId}` : ""}
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
