"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
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

type GdprRequest = {
  id: string;
  type: string;
  status: string;
  note: string | null;
  payload: unknown;
  createdAt: string;
  client: { name: string; email: string; number: number };
};

export default function AdminGdprPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<GdprRequest[]>(
    ["admin-gdpr"],
    "/api/v1/gdpr",
  );

  const updateRequest = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "complete" | "reject";
    }) =>
      apiFetch("/api/v1/gdpr", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      }),
    onSuccess: () => {
      toast.success("Request updated");
      queryClient.invalidateQueries({ queryKey: ["admin-gdpr"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="GDPR requests"
        description="Review privacy export and deletion requests."
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>{req.client.name}</div>
                      <div className="text-xs text-muted-foreground">
                        #{req.client.number} · {req.client.email}
                      </div>
                    </TableCell>
                    <TableCell>{req.type}</TableCell>
                    <TableCell>
                      <Badge>{req.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(req.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-2">
                      {req.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateRequest.mutate({
                                id: req.id,
                                action: "complete",
                              })
                            }
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateRequest.mutate({
                                id: req.id,
                                action: "reject",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      ) : req.type === "EXPORT" &&
                        req.status === "COMPLETED" &&
                        req.payload ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const blob = new Blob(
                              [JSON.stringify(req.payload, null, 2)],
                              { type: "application/json" },
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `gdpr-export-${req.client.number}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          Download JSON
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
    </PageMotion>
  );
}
