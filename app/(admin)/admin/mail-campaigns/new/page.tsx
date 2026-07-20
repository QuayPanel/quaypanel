"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
};

type FormState = {
  name: string;
  subject: string;
  body: string;
  filter: string;
  productId: string;
};

export default function NewMailCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: "",
    subject: "",
    body: "",
    filter: "all",
    productId: "",
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Campaign>("/api/v1/mail-campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          body: form.body,
          filter: form.filter,
          productId:
            form.filter === "productId" ? form.productId : undefined,
        }),
      }),
    onSuccess: (campaign) => {
      toast.success("Campaign created");
      queryClient.invalidateQueries({ queryKey: ["mail-campaigns"] });
      router.push(`/admin/mail-campaigns/${campaign.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/admin/mail-campaigns">← Campaigns</Link>
        </Button>
        <h1 className="text-2xl font-semibold">New campaign</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label required>Campaign name</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="March newsletter"
            />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm"
              value={form.filter}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
            />
          </div>
          <MarkdownEditor
            label="Body"
            required
            value={form.body}
            onChange={(body) => setForm((f) => ({ ...f, body }))}
            hint="Write in markdown. It is converted to HTML when the campaign is sent."
          />
          <div className="flex gap-2">
            <Button
              disabled={
                !form.name.trim() ||
                !form.subject.trim() ||
                !form.body.trim() ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Saving…" : "Save draft"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/mail-campaigns">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
