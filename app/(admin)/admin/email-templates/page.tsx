"use client";

import Link from "next/link";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
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

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  bodyFormat: "markdown" | "html";
  enabled: boolean;
  updatedAt: string;
};

export default function AdminEmailTemplatesPage() {
  const { data = [], isLoading } = useApiQuery<EmailTemplate[]>(
    ["email-templates"],
    "/api/v1/email-templates",
  );

  return (
    <PageMotion>
      <PageHeader
        title="Email templates"
        description="Edit outbound email subjects and bodies. Use placeholders like {{brand}} and {{clientName}}."
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Default templates will appear after the next seed or first send."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      {row.description ? (
                        <p className="text-xs text-muted-foreground">
                          {row.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="capitalize">{row.bodyFormat}</TableCell>
                    <TableCell>
                      {row.enabled ? "Enabled" : "Disabled"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/email-templates/${row.key}`}>
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
