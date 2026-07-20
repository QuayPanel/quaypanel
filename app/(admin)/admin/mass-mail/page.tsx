"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminMassMailPage() {
  const [massMail, setMassMail] = useState({
    filter: "all",
    productId: "",
    subject: "",
    body: "",
  });

  const sendMass = useMutation({
    mutationFn: () =>
      apiFetch<{ recipients: number; sent: number; failed: number }>(
        "/api/v1/mail/mass",
        {
          method: "POST",
          body: JSON.stringify({
            filter: massMail.filter,
            productId:
              massMail.filter === "productId"
                ? massMail.productId
                : undefined,
            subject: massMail.subject,
            body: massMail.body,
          }),
        },
      ),
    onSuccess: (result) => {
      toast.success(
        `Sent ${result.sent} of ${result.recipients} (${result.failed} failed)`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Mass mail"
        description="Send a markdown email to filtered groups of clients."
      />

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Recipients</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm"
              value={massMail.filter}
              onChange={(e) =>
                setMassMail((f) => ({ ...f, filter: e.target.value }))
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
          {massMail.filter === "productId" ? (
            <div className="space-y-2">
              <Label>Product ID</Label>
              <Input
                className="max-w-md"
                value={massMail.productId}
                onChange={(e) =>
                  setMassMail((f) => ({ ...f, productId: e.target.value }))
                }
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label required>Subject</Label>
            <Input
              className="max-w-xl"
              value={massMail.subject}
              onChange={(e) =>
                setMassMail((f) => ({ ...f, subject: e.target.value }))
              }
            />
          </div>
          <MarkdownEditor
            label="Body"
            required
            value={massMail.body}
            onChange={(body) => setMassMail((f) => ({ ...f, body }))}
            hint="Write in markdown. It is converted to HTML when the email is sent."
          />
          <Button
            onClick={() => sendMass.mutate()}
            disabled={
              !massMail.subject.trim() ||
              !massMail.body.trim() ||
              sendMass.isPending
            }
          >
            {sendMass.isPending ? "Sending…" : "Send mass mail"}
          </Button>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
