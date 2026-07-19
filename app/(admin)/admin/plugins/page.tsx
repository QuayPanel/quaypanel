"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SettingsMap = Record<string, unknown>;

type PluginEntry = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  source?: string;
};

export default function AdminPluginsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiQuery<SettingsMap>(
    ["settings"],
    "/api/v1/settings",
  );
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [packageName, setPackageName] = useState("");

  useEffect(() => {
    if (!data) return;
    const raw = data["plugins.installed"];
    if (Array.isArray(raw)) setPlugins(raw as PluginEntry[]);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ "plugins.installed": plugins }),
      }),
    onSuccess: () => {
      toast.success("Plugins updated");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Plugins"
        description="Payment and provisioning plugin packages."
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Installed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plugins.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No external plugins registered. Built-in gateways and
                  provisioning providers ship with the core.
                </p>
              ) : (
                plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{plugin.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {plugin.source || plugin.id}
                        {plugin.version ? ` @ ${plugin.version}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>
                        {plugin.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPlugins((prev) =>
                            prev.map((p) =>
                              p.id === plugin.id
                                ? { ...p, enabled: !p.enabled }
                                : p,
                            ),
                          )
                        }
                      >
                        Toggle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPlugins((prev) =>
                            prev.filter((p) => p.id !== plugin.id),
                          )
                        }
                      >
                        Uninstall
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Install from package</CardTitle>
            </CardHeader>
            <CardContent className="max-w-lg space-y-3">
              <Label>npm / package name</Label>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="@quaypanel/plugin-example"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const source = packageName.trim();
                  if (!source) {
                    toast.error("Package name required");
                    return;
                  }
                  const id = source.replace(/[^a-zA-Z0-9@/_-]/g, "");
                  if (plugins.some((p) => p.id === id || p.source === source)) {
                    toast.error("Already installed");
                    return;
                  }
                  setPlugins((prev) => [
                    ...prev,
                    {
                      id,
                      name: source.split("/").pop() || source,
                      source,
                      version: "pending",
                      enabled: true,
                    },
                  ]);
                  setPackageName("");
                  toast.message(
                    "Registered for install — restart worker after deploying the package",
                  );
                }}
              >
                Register plugin
              </Button>
            </CardContent>
          </Card>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save plugins"}
          </Button>
        </div>
      )}
    </PageMotion>
  );
}
