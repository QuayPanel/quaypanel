"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type GdprRequest = {
  id: string;
  type: string;
  status: string;
  note: string | null;
  createdAt: string;
};

export default function ClientPrivacyPage() {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useApiQuery<GdprRequest[]>(
    ["client-gdpr"],
    "/api/v1/gdpr",
  );

  const createRequest = useMutation({
    mutationFn: (type: "EXPORT" | "DELETE") =>
      apiFetch("/api/v1/gdpr", {
        method: "POST",
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => {
      toast.success("Privacy request submitted");
      queryClient.invalidateQueries({ queryKey: ["client-gdpr"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-2 text-2xl font-semibold">Privacy</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Request an export of your data or account deletion under GDPR.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={createRequest.isPending}
          onClick={() => createRequest.mutate("EXPORT")}
        >
          Request data export
        </Button>
        <Button
          variant="destructive"
          disabled={createRequest.isPending}
          onClick={() => createRequest.mutate("DELETE")}
        >
          Request account deletion
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground">No requests yet.</p>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2"
              >
                <div>
                  <p className="font-medium">{req.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge>{req.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
