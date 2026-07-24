"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Addon = {
  kind: "plugin" | "theme";
  addonId: string;
  name: string;
  version: string;
  description?: string;
  path: string;
  enabled: boolean;
  active?: boolean;
  loadError: string | null;
  discoveryError?: string;
  provides?: string[];
  overrides?: string[];
};

export default function AdminPluginsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Addon[]>(
    ["addons-plugins"],
    "/api/v1/addons?kind=plugin",
  );

  const toggle = useMutation({
    mutationFn: ({
      addonId,
      enabled,
    }: {
      addonId: string;
      enabled: boolean;
    }) =>
      apiFetch("/api/v1/addons", {
        method: "PATCH",
        body: JSON.stringify({
          action: "enable_plugin",
          addonId,
          enabled,
        }),
      }),
    onSuccess: () => {
      toast.success("Plugin updated");
      queryClient.invalidateQueries({ queryKey: ["addons-plugins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reload = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/addons", {
        method: "PATCH",
        body: JSON.stringify({ action: "reload" }),
      }),
    onSuccess: () => {
      toast.success("Addons reloaded");
      queryClient.invalidateQueries({ queryKey: ["addons-plugins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Plugins"
        description="Extract zip addons into /plugins, then enable them here. Restart the app/worker after installing new packages if reload is not enough."
        actions={
          <Button
            variant="outline"
            onClick={() => reload.mutate()}
            disabled={reload.isPending}
          >
            {reload.isPending ? "Reloading..." : "Reload addons"}
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Discovered plugins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No plugins found under <code className="font-mono">/plugins</code>.
                Built-in Stripe, PayPal, Pterodactyl, and Proxmox still load from
                core. Drop a folder with <code className="font-mono">addon.json</code>{" "}
                and <code className="font-mono">dist/index.js</code> to install an
                external plugin.
              </p>
            ) : (
              data.map((plugin) => (
                <div
                  key={plugin.addonId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{plugin.name}</p>
                      <Badge>
                        {plugin.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{plugin.version}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plugin.addonId}
                      {plugin.description ? ` — ${plugin.description}` : ""}
                    </p>
                    {plugin.provides && plugin.provides.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Provides: {plugin.provides.join(", ")}
                      </p>
                    ) : null}
                    {(plugin.loadError || plugin.discoveryError) && (
                      <p className="text-xs text-destructive">
                        {plugin.loadError || plugin.discoveryError}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggle.isPending || Boolean(plugin.discoveryError)}
                    onClick={() =>
                      toggle.mutate({
                        addonId: plugin.addonId,
                        enabled: !plugin.enabled,
                      })
                    }
                  >
                    {plugin.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </PageMotion>
  );
}
