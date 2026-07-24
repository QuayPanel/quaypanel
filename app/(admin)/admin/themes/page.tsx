"use client";

import { useRouter } from "next/navigation";
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
  overrides?: string[];
  assetsCss?: string[];
};

export default function AdminThemesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Addon[]>(
    ["addons-themes"],
    "/api/v1/addons?kind=theme",
  );

  const activate = useMutation({
    mutationFn: (addonId: string) =>
      apiFetch("/api/v1/addons", {
        method: "PATCH",
        body: JSON.stringify({ action: "activate_theme", addonId }),
      }),
    onSuccess: () => {
      toast.success("Theme activated");
      queryClient.invalidateQueries({ queryKey: ["addons-themes"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      router.refresh();
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
      queryClient.invalidateQueries({ queryKey: ["addons-themes"] });
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Themes"
        description="Extract theme zips into /themes. Only one theme is active. Activating a theme applies its colors; fine-tune them afterward in Settings → Theme."
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
            <CardTitle>Installed themes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No themes discovered. Ensure{" "}
                <code className="font-mono">themes/default</code> is present.
              </p>
            ) : (
              data.map((theme) => (
                <div
                  key={theme.addonId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{theme.name}</p>
                      {theme.active ? <Badge>Active</Badge> : null}
                      <span className="text-xs text-muted-foreground">
                        v{theme.version}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {theme.addonId}
                      {theme.description ? ` — ${theme.description}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(theme.overrides?.length ?? 0) > 0
                        ? `Overrides: ${theme.overrides?.join(", ")}`
                        : "Tokens / CSS only (core layouts)"}
                      {theme.assetsCss?.length
                        ? ` · CSS: ${theme.assetsCss.join(", ")}`
                        : ""}
                    </p>
                    {(theme.loadError || theme.discoveryError) && (
                      <p className="text-xs text-destructive">
                        {theme.loadError || theme.discoveryError}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={theme.active ? "outline" : "default"}
                    disabled={
                      theme.active ||
                      activate.isPending ||
                      Boolean(theme.discoveryError)
                    }
                    onClick={() => activate.mutate(theme.addonId)}
                  >
                    {theme.active ? "Active" : "Activate"}
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
