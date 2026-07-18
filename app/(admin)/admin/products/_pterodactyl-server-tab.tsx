"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PteroServerForm = {
  locationIds: number[];
  nodeId: string;
  nestId: string;
  eggId: string;
  memory: string;
  swap: string;
  disk: string;
  io: string;
  cpu: string;
  threads: string;
  databases: string;
  backups: string;
  allocations: string;
  portArrayText: string;
  skipScripts: boolean;
  dedicatedIp: boolean;
  startOnCompletion: boolean;
  oomKiller: boolean;
};

type Meta = {
  locations: Array<{ id: number; short: string; long: string }>;
  nodes: Array<{ id: number; name: string; locationId: number }>;
  nests: Array<{ id: number; name: string }>;
  eggs: Array<{ id: number; name: string; nestId: number }>;
};

export function defaultPteroServerForm(): PteroServerForm {
  return {
    locationIds: [],
    nodeId: "",
    nestId: "",
    eggId: "",
    memory: "1024",
    swap: "0",
    disk: "5120",
    io: "500",
    cpu: "100",
    threads: "",
    databases: "0",
    backups: "0",
    allocations: "0",
    portArrayText: "",
    skipScripts: false,
    dedicatedIp: false,
    startOnCompletion: true,
    oomKiller: false,
  };
}

export function parsePortArray(
  text: string,
): { value: Record<string, number | number[]> | null; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, error: null };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: "Port Array must be a JSON object" };
    }
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "number" && Number.isFinite(val)) continue;
      if (
        Array.isArray(val) &&
        val.every((n) => typeof n === "number" && Number.isFinite(n))
      ) {
        continue;
      }
      return {
        value: null,
        error: `Invalid value for "${key}" — use a number or number array`,
      };
    }
    return {
      value: parsed as Record<string, number | number[]>,
      error: null,
    };
  } catch {
    return { value: null, error: "Invalid JSON" };
  }
}

export function pteroServerFormFromConfig(
  config: Record<string, unknown> | null | undefined,
): PteroServerForm {
  const base = defaultPteroServerForm();
  if (!config) return base;
  const limits =
    config.limits && typeof config.limits === "object"
      ? (config.limits as Record<string, unknown>)
      : {};
  const featureLimits =
    config.featureLimits && typeof config.featureLimits === "object"
      ? (config.featureLimits as Record<string, unknown>)
      : {};

  const locationIds = Array.isArray(config.locationIds)
    ? config.locationIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : config.locationId != null
      ? [Number(config.locationId)].filter((n) => Number.isFinite(n) && n > 0)
      : [];

  let portArrayText = "";
  if (config.portArray && typeof config.portArray === "object") {
    portArrayText = JSON.stringify(config.portArray, null, 2);
  }

  return {
    locationIds,
    nodeId: config.nodeId != null ? String(config.nodeId) : "",
    nestId: config.nestId != null ? String(config.nestId) : "",
    eggId: config.eggId != null ? String(config.eggId) : "",
    memory: String(limits.memory ?? base.memory),
    swap: String(limits.swap ?? base.swap),
    disk: String(limits.disk ?? base.disk),
    io: String(limits.io ?? base.io),
    cpu: String(limits.cpu ?? base.cpu),
    threads: typeof limits.threads === "string" ? limits.threads : "",
    databases: String(featureLimits.databases ?? base.databases),
    backups: String(featureLimits.backups ?? base.backups),
    allocations: String(featureLimits.allocations ?? base.allocations),
    portArrayText,
    skipScripts: Boolean(config.skipScripts),
    dedicatedIp: Boolean(config.dedicatedIp),
    startOnCompletion:
      config.startOnCompletion == null
        ? true
        : Boolean(config.startOnCompletion),
    oomKiller: Boolean(config.oomKiller),
  };
}

export function buildPteroProvisionConfig(server: PteroServerForm) {
  const { value: portArray, error } = parsePortArray(server.portArrayText);
  if (error) {
    throw new Error(error);
  }
  const hasPortArray = Boolean(portArray && Object.keys(portArray).length > 0);
  return {
    locationIds: server.locationIds,
    nodeId: server.nodeId ? Number(server.nodeId) : null,
    nestId: Number(server.nestId) || 1,
    eggId: Number(server.eggId) || 1,
    limits: {
      memory: Number(server.memory) || 0,
      swap: Number(server.swap) || 0,
      disk: Number(server.disk) || 0,
      io: Number(server.io) || 500,
      cpu: Number(server.cpu) || 0,
      ...(server.threads.trim()
        ? { threads: server.threads.trim() }
        : {}),
    },
    featureLimits: {
      databases: Number(server.databases) || 0,
      backups: Number(server.backups) || 0,
      allocations: Number(server.allocations) || 0,
    },
    portArray,
    skipScripts: server.skipScripts,
    dedicatedIp: hasPortArray ? false : server.dedicatedIp,
    startOnCompletion: server.startOnCompletion,
    oomKiller: server.oomKiller,
  };
}

export function PterodactylServerTab({
  server,
  onChange,
}: {
  server: PteroServerForm;
  onChange: (next: PteroServerForm | ((prev: PteroServerForm) => PteroServerForm)) => void;
}) {
  const queryClient = useQueryClient();
  const nestIdNum = Number(server.nestId) || 0;
  const { data: meta, isFetching, isError, error, refetch } = useApiQuery<Meta>(
    ["pterodactyl-meta", String(nestIdNum || "none")],
    `/api/v1/providers/pterodactyl/meta?include=locations,nodes,nests,eggs${
      nestIdNum > 0 ? `&nestId=${nestIdNum}` : ""
    }`,
  );

  const portParsed = parsePortArray(server.portArrayText);
  const hasPortArray = Boolean(
    portParsed.value && Object.keys(portParsed.value).length > 0,
  );

  const nodes = useMemo(() => {
    const list = meta?.nodes ?? [];
    if (!server.locationIds.length) return list;
    return list.filter((n) => server.locationIds.includes(n.locationId));
  }, [meta?.nodes, server.locationIds]);

  function set(patch: Partial<PteroServerForm>) {
    onChange((prev) => ({ ...prev, ...patch }));
  }

  function toggleLocation(id: number) {
    onChange((prev) => {
      const nextIds = prev.locationIds.includes(id)
        ? prev.locationIds.filter((x) => x !== id)
        : [...prev.locationIds, id];
      let nodeId = prev.nodeId;
      if (nodeId) {
        const node = (meta?.nodes ?? []).find((n) => String(n.id) === nodeId);
        if (node && nextIds.length && !nextIds.includes(node.locationId)) {
          nodeId = "";
        }
      }
      return { ...prev, locationIds: nextIds, nodeId };
    });
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["pterodactyl-meta"] });
    const result = await refetch();
    if (result.isError) {
      toast.error(
        result.error instanceof Error
          ? result.error.message
          : "Failed to refresh Pterodactyl data",
      );
      return;
    }
    toast.success("Pterodactyl data refreshed");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Server</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isFetching}
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Could not load Pterodactyl metadata. Check Providers settings."}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Location(s) (optional)</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {(meta?.locations ?? []).length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  {isFetching ? "Loading locations..." : "No locations found"}
                </p>
              ) : (
                (meta?.locations ?? []).map((loc) => (
                  <label
                    key={loc.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={server.locationIds.includes(loc.id)}
                      onChange={() => toggleLocation(loc.id)}
                    />
                    <span>
                      {loc.short}
                      {loc.long && loc.long !== loc.short
                        ? ` — ${loc.long}`
                        : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Node (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={server.nodeId}
              onChange={(e) => set({ nodeId: e.target.value })}
            >
              <option value="">Any</option>
              {nodes.map((node) => (
                <option key={node.id} value={String(node.id)}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label required>Nest</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={server.nestId}
              onChange={(e) => {
                const nestId = e.target.value;
                set({ nestId, eggId: "" });
              }}
            >
              <option value="">Select nest...</option>
              {(meta?.nests ?? []).map((nest) => (
                <option key={nest.id} value={String(nest.id)}>
                  {nest.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label required>Egg</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={server.eggId}
              onChange={(e) => set({ eggId: e.target.value })}
              disabled={!server.nestId}
            >
              <option value="">Select egg...</option>
              {(meta?.eggs ?? []).map((egg) => (
                <option key={egg.id} value={String(egg.id)}>
                  {egg.name}
                </option>
              ))}
            </select>
          </div>

          {(
            [
              ["memory", "Memory (MiB)", server.memory],
              ["swap", "Swap (MiB)", server.swap],
              ["disk", "Disk (MiB)", server.disk],
              ["io", "IO Weight", server.io],
              ["cpu", "CPU Limit", server.cpu],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input
                inputMode="numeric"
                value={value}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label>CPU Pinning (optional)</Label>
            <Input
              placeholder="0,2-4,5,6"
              value={server.threads}
              onChange={(e) => set({ threads: e.target.value })}
            />
          </div>

          {(
            [
              ["databases", "Databases", server.databases],
              ["backups", "Backups", server.backups],
              [
                "allocations",
                "Additional Allocation Ports",
                server.allocations,
              ],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input
                inputMode="numeric"
                value={value}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </div>
          ))}

          <div className="space-y-2 md:col-span-2">
            <Label>Port Array (optional)</Label>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
              placeholder='{"SERVER_PORT": 7777, "NONE": [7778, 7779]}'
              value={server.portArrayText}
              onChange={(e) => set({ portArrayText: e.target.value })}
            />
            {portParsed.error ? (
              <p className="text-xs text-destructive">{portParsed.error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                JSON object mapping environment keys to port numbers or arrays.
                Dedicated IP is disabled when set.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={server.skipScripts}
              onChange={(e) => set({ skipScripts: e.target.checked })}
            />
            Skip Egg Install Script
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${
              hasPortArray ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={hasPortArray ? false : server.dedicatedIp}
              disabled={hasPortArray}
              onChange={(e) => set({ dedicatedIp: e.target.checked })}
            />
            Dedicated IP
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={server.startOnCompletion}
              onChange={(e) => set({ startOnCompletion: e.target.checked })}
            />
            Start on completion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={server.oomKiller}
              onChange={(e) => set({ oomKiller: e.target.checked })}
            />
            Enable OOM Killer
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
