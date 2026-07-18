"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SettingsMap = Record<string, unknown>;

type ThemePackage = {
  id: string;
  name: string;
  description?: string;
};

export default function AdminThemesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiQuery<SettingsMap>(
    ["settings"],
    "/api/v1/settings",
  );
  const [activeId, setActiveId] = useState("default");
  const [packages, setPackages] = useState<ThemePackage[]>([
    { id: "default", name: "Default", description: "Built-in QuayPanel theme" },
  ]);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!data) return;
    setActiveId(String(data["theme.id"] ?? "default"));
    const raw = data["theme.packages"];
    if (Array.isArray(raw) && raw.length) {
      setPackages(raw as ThemePackage[]);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({
          "theme.id": activeId,
          "theme.packages": packages,
        }),
      }),
    onSuccess: () => {
      toast.success("Theme settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Themes</h1>
        <p className="text-sm text-muted-foreground">
          Select and register theme packages for this installation
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active theme</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3">
              <Label>Theme package</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered packages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {packages.map((pkg) => (
                  <li
                    key={pkg.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{pkg.name}</p>
                      <p className="text-muted-foreground">
                        {pkg.id}
                        {pkg.description ? ` — ${pkg.description}` : ""}
                      </p>
                    </div>
                    {pkg.id !== "default" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPackages((prev) =>
                            prev.filter((p) => p.id !== pkg.id),
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Package id</Label>
                  <Input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="midnight"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Midnight"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const id = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
                  if (!id || !newName.trim()) {
                    toast.error("Id and name required");
                    return;
                  }
                  if (packages.some((p) => p.id === id)) {
                    toast.error("Package already registered");
                    return;
                  }
                  setPackages((prev) => [
                    ...prev,
                    { id, name: newName.trim() },
                  ]);
                  setNewId("");
                  setNewName("");
                }}
              >
                Register package
              </Button>
            </CardContent>
          </Card>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save themes"}
          </Button>
        </div>
      )}
    </PageMotion>
  );
}
