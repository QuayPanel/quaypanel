"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  actionType: string;
  config: Record<string, unknown>;
};

const TRIGGERS = [
  "ORDER_PAID",
  "INVOICE_OVERDUE",
  "SERVICE_SUSPENDED",
  "SERVICE_TERMINATED",
  "TICKET_OPENED",
  "FRAUD_HOLD",
] as const;

const ACTIONS = ["EMAIL", "WEBHOOK", "CREATE_TICKET"] as const;

export default function AdminAutomationPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Rule[]>(
    ["automation"],
    "/api/v1/automation",
  );

  const [form, setForm] = useState({
    name: "",
    trigger: "ORDER_PAID" as (typeof TRIGGERS)[number],
    actionType: "WEBHOOK" as (typeof ACTIONS)[number],
    url: "",
    enabled: true,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/automation", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          actionType: form.actionType,
          enabled: form.enabled,
          config:
            form.actionType === "WEBHOOK"
              ? { url: form.url, method: "POST" }
              : form.actionType === "EMAIL"
                ? {
                    to: "{{clientEmail}}",
                    subject: "{{event}} — {{brand}}",
                    body: "Automation fired: {{event}}",
                  }
                : {
                    clientId: "{{clientId}}",
                    subject: "Automation: {{event}}",
                    body: "{{event}}",
                  },
        }),
      }),
    onSuccess: () => {
      toast.success("Rule created");
      setForm((f) => ({ ...f, name: "", url: "" }));
      queryClient.invalidateQueries({ queryKey: ["automation"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/automation/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Rule deleted");
      queryClient.invalidateQueries({ queryKey: ["automation"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Automation"
        description="React to billing events with webhooks, emails, or tickets."
      />

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>New rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.trigger}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    trigger: e.target.value as (typeof TRIGGERS)[number],
                  }))
                }
              >
                {TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.actionType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actionType: e.target.value as (typeof ACTIONS)[number],
                  }))
                }
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.actionType === "WEBHOOK" && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com/hook"
              />
            </div>
          )}
          <Button
            onClick={() => create.mutate()}
            disabled={!form.name || create.isPending}
          >
            {create.isPending ? "Creating..." : "Create rule"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState title="No rules" description="Create an automation rule above." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {rule.trigger} → {rule.actionType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      rule.enabled ? undefined : "border-dashed opacity-70"
                    }
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove.mutate(rule.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageMotion>
  );
}
