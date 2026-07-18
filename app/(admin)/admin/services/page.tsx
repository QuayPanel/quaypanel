"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
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

type Service = {
  id: string;
  number: number;
  status: string;
  hostname: string | null;
  providerId: string;
  nextDueAt: string | null;
  client: { name: string; email: string };
  plan: { name: string; product: { name: string } };
};

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Service[]>(
    ["admin-services"],
    "/api/v1/services",
  );

  const action = useMutation({
    mutationFn: ({
      id,
      act,
    }: {
      id: string;
      act: "suspend" | "unsuspend" | "terminate";
    }) =>
      apiFetch(`/api/v1/services/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: act }),
      }),
    onSuccess: () => {
      toast.success("Action queued");
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Services</h1>
      <Card>
        <CardHeader>
          <CardTitle>All services</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{service.client.name}</TableCell>
                    <TableCell>
                      {service.plan.product.name} / {service.plan.name}
                    </TableCell>
                    <TableCell>
                      <Badge>{service.status}</Badge>
                    </TableCell>
                    <TableCell>{service.providerId}</TableCell>
                    <TableCell className="space-x-1">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/services/${service.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          action.mutate({ id: service.id, act: "suspend" })
                        }
                      >
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          action.mutate({ id: service.id, act: "unsuspend" })
                        }
                      >
                        Unsuspend
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          action.mutate({ id: service.id, act: "terminate" })
                        }
                      >
                        Terminate
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
