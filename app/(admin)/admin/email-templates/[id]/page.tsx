"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { FieldHint } from "@/components/admin/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  bodyFormat: "markdown" | "html";
  body: string;
  enabled: boolean;
  placeholders: string[];
};

export default function AdminEmailTemplateEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiQuery<EmailTemplate>(
    ["email-template", params.id],
    `/api/v1/email-templates/${params.id}`,
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    subject: "",
    bodyFormat: "markdown" as "markdown" | "html",
    body: "",
    enabled: true,
  });
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      description: data.description ?? "",
      subject: data.subject,
      bodyFormat: data.bodyFormat,
      body: data.body,
      enabled: data.enabled,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<EmailTemplate>("/api/v1/email-templates", {
        method: "PATCH",
        body: JSON.stringify({
          key: params.id,
          name: form.name,
          description: form.description || null,
          subject: form.subject,
          bodyFormat: form.bodyFormat,
          body: form.body,
          enabled: form.enabled,
        }),
      }),
    onSuccess: () => {
      toast.success("Template saved");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["email-template", params.id],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = useMutation({
    mutationFn: () =>
      apiFetch<EmailTemplate>("/api/v1/email-templates", {
        method: "PATCH",
        body: JSON.stringify({ key: params.id, reset: true }),
      }),
    onSuccess: (result) => {
      toast.success("Reset to default");
      setForm({
        name: result.name,
        description: result.description ?? "",
        subject: result.subject,
        bodyFormat: result.bodyFormat,
        body: result.body,
        enabled: result.enabled,
      });
      setResetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["email-template", params.id],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testSend = useMutation({
    mutationFn: () =>
      apiFetch<{ to: string }>("/api/v1/email-templates", {
        method: "PATCH",
        body: JSON.stringify({ key: params.id, test: true }),
      }),
    onSuccess: (result) => {
      toast.success(`Test email queued/sent to ${result.to}`);
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Key: <span className="font-mono">{data.key}</span>
          </p>
          <button
            type="button"
            className="mt-1 text-sm text-muted-foreground underline"
            onClick={() => router.push("/admin/email-templates")}
          >
            Back to templates
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setResetOpen(true)}
            disabled={reset.isPending}
          >
            Reset to default
          </Button>
          <Button
            variant="outline"
            onClick={() => testSend.mutate()}
            disabled={testSend.isPending}
          >
            {testSend.isPending ? "Sending…" : "Send test"}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label required>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label required>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
              <FieldHint>
                Supports placeholders such as {"{{brand}}"} and{" "}
                {"{{invoiceNumber}}"}.
              </FieldHint>
            </div>
            <div className="space-y-2">
              <Label required>Body format</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.bodyFormat}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bodyFormat: e.target.value as "markdown" | "html",
                  })
                }
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </select>
            </div>
            {form.bodyFormat === "markdown" ? (
              <MarkdownEditor
                label="Body"
                value={form.body}
                onChange={(body) => setForm({ ...form, body })}
                hint="Markdown is converted to HTML when the email is sent. Global header/footer from Settings wrap this body."
              />
            ) : (
              <div className="space-y-2">
                <Label required>Body (HTML)</Label>
                <textarea
                  className="min-h-[280px] w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <FieldHint>
                  Raw HTML fragment. Global mail CSS/header/footer still apply.
                </FieldHint>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Placeholders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Available for this template:
            </p>
            <ul className="space-y-1 font-mono text-xs">
              {(data.placeholders.length
                ? data.placeholders
                : ["brand", "appUrl"]
              ).map((p) => (
                <li key={p}>{`{{${p}}}`}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset template?"
        description="This replaces the subject and body with the built-in default."
        onCancel={() => setResetOpen(false)}
        onConfirm={() => reset.mutate()}
        loading={reset.isPending}
      />
    </PageMotion>
  );
}
