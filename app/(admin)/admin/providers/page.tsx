"use client";

import { useEffect, useState, type FocusEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { ToggleField } from "@/components/admin/settings-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProviderRow = {
  id: string;
  name: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  apiKeySet: boolean;
  node?: string;
};

type TestResult = { ok: boolean; message: string };
type ProviderForm = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  node: string;
};

const noLoginAutofill = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const noLoginAutofillSecret = {
  ...noLoginAutofill,
  autoComplete: "new-password",
} as const;

function unlockAutofill(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.removeAttribute("readonly");
}

function StatusDialog({
  open,
  title,
  description,
  ok,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  ok: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p
          className={`mt-2 text-sm ${ok ? "text-primary" : "text-destructive"}`}
        >
          {description}
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  form,
  setForm,
  onSave,
  onTest,
  onCancel,
  saving,
  testing,
  showNode,
  secretPlaceholder,
}: {
  provider: ProviderRow;
  form: ProviderForm;
  setForm: (f: ProviderForm) => void;
  onSave: () => void;
  onTest: () => void;
  onCancel: () => void;
  saving: boolean;
  testing: boolean;
  showNode?: boolean;
  secretPlaceholder: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider.name}</CardTitle>
      </CardHeader>
      <CardContent className="max-w-xl space-y-4">
        <ToggleField
          label="Enabled"
          checked={form.enabled}
          onChange={(v) => setForm({ ...form, enabled: v })}
          description={`When disabled, ${provider.name} provisioning will not run.`}
        />
        <div className="space-y-2">
          <Label>API URL</Label>
          <Input
            name={`apex-${provider.id}-url`}
            {...noLoginAutofill}
            placeholder="https://panel.example.com"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          />
        </div>
        {showNode ? (
          <div className="space-y-2">
            <Label>Default node</Label>
            <Input
              {...noLoginAutofill}
              placeholder="pve"
              value={form.node}
              onChange={(e) => setForm({ ...form, node: e.target.value })}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>API credential</Label>
          <Input
            type="password"
            name={`apex-${provider.id}-api-key`}
            readOnly
            onFocus={unlockAutofill}
            {...noLoginAutofillSecret}
            placeholder={
              provider.apiKeySet
                ? "•••••••• (unchanged)"
                : secretPlaceholder
            }
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={testing || saving}
          >
            {testing ? "Testing..." : "Test connection"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, refetch } = useApiQuery<ProviderRow[]>(
    ["providers"],
    "/api/v1/providers",
  );
  const ptero = data.find((p) => p.id === "pterodactyl");
  const prox = data.find((p) => p.id === "proxmox");

  const [pteroForm, setPteroForm] = useState<ProviderForm>({
    enabled: false,
    baseUrl: "",
    apiKey: "",
    node: "",
  });
  const [proxForm, setProxForm] = useState<ProviderForm>({
    enabled: false,
    baseUrl: "",
    apiKey: "",
    node: "pve",
  });
  const [testOpen, setTestOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (ptero) {
      setPteroForm({
        enabled: ptero.enabled,
        baseUrl: ptero.baseUrl,
        apiKey: ptero.apiKeySet ? ptero.apiKey : "",
        node: "",
      });
    }
    if (prox) {
      setProxForm({
        enabled: prox.enabled,
        baseUrl: prox.baseUrl,
        apiKey: prox.apiKeySet ? prox.apiKey : "",
        node: prox.node || "pve",
      });
    }
  }, [ptero, prox]);

  const savePtero = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/providers", {
        method: "PATCH",
        body: JSON.stringify({
          providerId: "pterodactyl",
          enabled: pteroForm.enabled,
          baseUrl: pteroForm.baseUrl,
          apiKey: pteroForm.apiKey,
        }),
      }),
    onSuccess: () => {
      toast.success("Pterodactyl settings saved");
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProx = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/providers", {
        method: "PATCH",
        body: JSON.stringify({
          providerId: "proxmox",
          enabled: proxForm.enabled,
          baseUrl: proxForm.baseUrl,
          apiKey: proxForm.apiKey,
          node: proxForm.node,
        }),
      }),
    onSuccess: () => {
      toast.success("Proxmox settings saved");
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testPtero = useMutation({
    mutationFn: () =>
      apiFetch<TestResult>("/api/v1/providers/pterodactyl/test", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: pteroForm.baseUrl,
          apiKey: pteroForm.apiKey,
        }),
      }),
    onSuccess: (result) => {
      setTestResult(result);
      setTestOpen(true);
    },
    onError: (err: Error) => {
      setTestResult({ ok: false, message: err.message });
      setTestOpen(true);
    },
  });

  const testProx = useMutation({
    mutationFn: () =>
      apiFetch<TestResult>("/api/v1/providers/proxmox/test", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: proxForm.baseUrl,
          apiKey: proxForm.apiKey,
        }),
      }),
    onSuccess: (result) => {
      setTestResult(result);
      setTestOpen(true);
    },
    onError: (err: Error) => {
      setTestResult({ ok: false, message: err.message });
      setTestOpen(true);
    },
  });

  return (
    <PageMotion>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="text-sm text-muted-foreground">
          Configure provisioning providers
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          {ptero ? (
            <ProviderCard
              provider={ptero}
              form={pteroForm}
              setForm={setPteroForm}
              onSave={() => savePtero.mutate()}
              onTest={() => testPtero.mutate()}
              onCancel={async () => {
                const result = await refetch();
                const next = result.data?.find((p) => p.id === "pterodactyl");
                if (next) {
                  setPteroForm({
                    enabled: next.enabled,
                    baseUrl: next.baseUrl,
                    apiKey: next.apiKeySet ? next.apiKey : "",
                    node: "",
                  });
                }
                toast.message("Changes discarded");
              }}
              saving={savePtero.isPending}
              testing={testPtero.isPending}
              secretPlaceholder="ptla_..."
            />
          ) : null}
          {prox ? (
            <ProviderCard
              provider={prox}
              form={proxForm}
              setForm={setProxForm}
              showNode
              onSave={() => saveProx.mutate()}
              onTest={() => testProx.mutate()}
              onCancel={async () => {
                const result = await refetch();
                const next = result.data?.find((p) => p.id === "proxmox");
                if (next) {
                  setProxForm({
                    enabled: next.enabled,
                    baseUrl: next.baseUrl,
                    apiKey: next.apiKeySet ? next.apiKey : "",
                    node: next.node || "pve",
                  });
                }
                toast.message("Changes discarded");
              }}
              saving={saveProx.isPending}
              testing={testProx.isPending}
              secretPlaceholder="root@pam!token=secret"
            />
          ) : null}
        </div>
      )}

      <StatusDialog
        open={testOpen}
        title={
          testResult?.ok ? "Connection successful" : "Connection failed"
        }
        description={testResult?.message ?? ""}
        ok={Boolean(testResult?.ok)}
        onClose={() => setTestOpen(false)}
      />
    </PageMotion>
  );
}
