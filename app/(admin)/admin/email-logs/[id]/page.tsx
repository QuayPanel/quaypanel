"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmailLog = {
  id: string;
  to: string;
  from: string;
  subject: string;
  status: string;
  templateKey: string | null;
  html: string | null;
  error: string | null;
  createdAt: string;
};

export default function AdminEmailLogDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, error } = useApiQuery<EmailLog>(
    ["email-log", params.id],
    `/api/v1/email-logs/${params.id}`,
  );

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (error || !data) {
    return (
      <p className="text-destructive">{error?.message ?? "Not found"}</p>
    );
  }

  return (
    <PageMotion>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Email preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href="/admin/email-logs" className="underline">
            Back to logs
          </Link>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{data.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">When</p>
              <p>{new Date(data.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">To</p>
              <p className="break-all">{data.to}</p>
            </div>
            <div>
              <p className="text-muted-foreground">From</p>
              <p className="break-all">{data.from || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Subject</p>
              <p>{data.subject}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Template</p>
              <p className="font-mono text-xs">{data.templateKey ?? "—"}</p>
            </div>
            {data.error ? (
              <div>
                <p className="text-muted-foreground">Error</p>
                <p className="text-destructive">{data.error}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>As received</CardTitle>
          </CardHeader>
          <CardContent>
            {data.html ? (
              <iframe
                title="Email preview"
                className="min-h-[640px] w-full rounded-md border bg-white"
                srcDoc={data.html}
                sandbox=""
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No HTML body was stored for this log entry.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
