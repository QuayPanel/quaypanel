"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  filter: string;
  productId: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
};

type FormState = {
  name: string;
  subject: string;
  body: string;
  filter: string;
  productId: string;
};

export default function EditMailCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: campaign, isLoading } = useApiQuery<Campaign>(
    ["mail-campaign", id],
    `/api/v1/mail-campaigns/${id}`,
  );
  const [form, setForm] = useState<FormState>({
    name: "",
    subject: "",
    body: "",
    filter: "all",
    productId: "",
  });

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      filter: campaign.filter,
      productId: campaign.productId ?? "",
    });
  }, [campaign]);

  const readOnly =
    campaign?.status === "SENT" || campaign?.status === "SENDING";

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/mail-campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          body: form.body,
          filter: form.filter,
          productId: form.filter === "productId" ? form.productId : null,
        }),
      }),
    onSuccess: () => {
      toast.success("Campaign saved");
      queryClient.invalidateQueries({ queryKey: ["mail-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const send = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/mail-campaigns/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send" }),
      }),
    onSuccess: () => {
      toast.success("Campaign sent");
      queryClient.invalidateQueries({ queryKey: ["mail-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicate = useMutation({
    mutationFn: () =>
      apiFetch<Campaign>(`/api/v1/mail-campaigns/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "duplicate" }),
      }),
    onSuccess: (copy) => {
      toast.success("Duplicated");
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
      router.push(`/admin/mail-campaigns/${copy.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !campaign) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/admin/mail-campaigns">← Campaigns</Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge>{campaign.status}</Badge>
          </div>
          {campaign.sentAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Sent {new Date(campaign.sentAt).toLocaleString()} ·{" "}
              {campaign.sentCount}/{campaign.recipientCount} delivered
              {campaign.failedCount
                ? ` · ${campaign.failedCount} failed`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                disabled={send.isPending}
                onClick={() => {
                  if (confirm("Send this campaign now?")) send.mutate();
                }}
              >
                {send.isPending ? "Sending…" : "Send campaign"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate()}
            >
              Duplicate to edit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{readOnly ? "Sent campaign" : "Edit draft"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label required>Campaign name</Label>
            <Input
              value={form.name}
              disabled={readOnly}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm"
              value={form.filter}
              disabled={readOnly}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  filter: e.target.value,
                  productId: "",
                }))
              }
            >
              <option value="all">All clients</option>
              <option value="activeServices">
                Clients with active services
              </option>
              <option value="overdue">Overdue invoices</option>
              <option value="productId">Product (by ID)</option>
            </select>
          </div>
          {form.filter === "productId" ? (
            <div className="space-y-2">
              <Label required>Product ID</Label>
              <Input
                className="max-w-md"
                value={form.productId}
                disabled={readOnly}
                onChange={(e) =>
                  setForm((f) => ({ ...f, productId: e.target.value }))
                }
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label required>Subject</Label>
            <Input
              className="max-w-xl"
              value={form.subject}
              disabled={readOnly}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
            />
          </div>
          {readOnly ? (
            <div className="space-y-2">
              <Label>Body</Label>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                {form.body}
              </pre>
            </div>
          ) : (
            <MarkdownEditor
              label="Body"
              required
              value={form.body}
              onChange={(body) => setForm((f) => ({ ...f, body }))}
              hint="Write in markdown. It is converted to HTML when the campaign is sent."
            />
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
