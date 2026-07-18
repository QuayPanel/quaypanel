import { z } from "zod";
import { getSetting, updateSettings } from "@/src/domains/settings/service";
import { ValidationError } from "@/src/core/errors";

export const MASKED_SECRET = "••••••••";

export type ProviderConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  /** Proxmox node name (optional) */
  node?: string;
};

const providerUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  node: z.string().optional(),
});

function normalizeProvider(raw: unknown): ProviderConfig {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: Boolean(obj.enabled),
    baseUrl: typeof obj.baseUrl === "string" ? obj.baseUrl : "",
    apiKey: typeof obj.apiKey === "string" ? obj.apiKey : "",
    node: typeof obj.node === "string" ? obj.node : "",
  };
}

function maskProvider(
  id: "pterodactyl" | "proxmox",
  name: string,
  config: ProviderConfig,
) {
  const hasKey = config.apiKey.length > 0;
  return {
    id,
    name,
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    apiKey: hasKey ? MASKED_SECRET : "",
    apiKeySet: hasKey,
    node: config.node ?? "",
  };
}

export async function getPterodactylConfig(): Promise<ProviderConfig> {
  const raw = await getSetting("provisioning.pterodactyl", {
    enabled: false,
    baseUrl: "",
    apiKey: "",
  });
  return normalizeProvider(raw);
}

export async function getProxmoxConfig(): Promise<ProviderConfig> {
  const raw = await getSetting("provisioning.proxmox", {
    enabled: false,
    baseUrl: "",
    apiKey: "",
    node: "pve",
  });
  return normalizeProvider(raw);
}

export async function listProviders() {
  const [ptero, prox] = await Promise.all([
    getPterodactylConfig(),
    getProxmoxConfig(),
  ]);
  return [
    maskProvider("pterodactyl", "Pterodactyl", ptero),
    maskProvider("proxmox", "Proxmox VE", prox),
  ];
}

async function updateProvider(
  settingKey: "provisioning.pterodactyl" | "provisioning.proxmox",
  getter: () => Promise<ProviderConfig>,
  input: z.infer<typeof providerUpdateSchema>,
  id: "pterodactyl" | "proxmox",
  name: string,
) {
  const data = providerUpdateSchema.parse(input);
  const current = await getter();

  let nextKey = current.apiKey;
  if (data.apiKey !== undefined && data.apiKey !== MASKED_SECRET) {
    nextKey = data.apiKey;
  }

  const next: ProviderConfig = {
    enabled: data.enabled ?? current.enabled,
    baseUrl: data.baseUrl !== undefined ? data.baseUrl.trim() : current.baseUrl,
    apiKey: nextKey,
    node:
      data.node !== undefined
        ? data.node.trim()
        : current.node || (id === "proxmox" ? "pve" : ""),
  };

  await updateSettings({ [settingKey]: next });
  return maskProvider(id, name, next);
}

export async function updatePterodactylProvider(
  input: z.infer<typeof providerUpdateSchema>,
) {
  return updateProvider(
    "provisioning.pterodactyl",
    getPterodactylConfig,
    input,
    "pterodactyl",
    "Pterodactyl",
  );
}

export async function updateProxmoxProvider(
  input: z.infer<typeof providerUpdateSchema>,
) {
  return updateProvider(
    "provisioning.proxmox",
    getProxmoxConfig,
    input,
    "proxmox",
    "Proxmox VE",
  );
}

export async function testPterodactylConnection(input: {
  baseUrl?: string;
  apiKey?: string;
}) {
  const saved = await getPterodactylConfig();
  const baseUrl = (input.baseUrl ?? saved.baseUrl).trim().replace(/\/$/, "");
  let apiKey = input.apiKey ?? "";
  if (!apiKey || apiKey === MASKED_SECRET) {
    apiKey = saved.apiKey;
  }

  if (!baseUrl) {
    throw new ValidationError("Pterodactyl URL is required");
  }
  if (!apiKey) {
    throw new ValidationError("Application API key is required");
  }

  const url = `${baseUrl}/api/application/nodes?per_page=1`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Pterodactyl panel";
    return { ok: false as const, message };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false as const,
      message:
        text.trim() ||
        `Connection failed with HTTP ${res.status} ${res.statusText}`,
    };
  }

  return {
    ok: true as const,
    message: "Connected successfully to the Pterodactyl Application API.",
  };
}

export async function testProxmoxConnection(input: {
  baseUrl?: string;
  apiKey?: string;
}) {
  const saved = await getProxmoxConfig();
  const baseUrl = (input.baseUrl ?? saved.baseUrl).trim().replace(/\/$/, "");
  let apiKey = input.apiKey ?? "";
  if (!apiKey || apiKey === MASKED_SECRET) {
    apiKey = saved.apiKey;
  }

  if (!baseUrl) {
    throw new ValidationError("Proxmox URL is required");
  }
  if (!apiKey) {
    throw new ValidationError("API token is required");
  }

  const url = `${baseUrl}/api2/json/version`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `PVEAPIToken=${apiKey}`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Proxmox API";
    return { ok: false as const, message };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false as const,
      message:
        text.trim() ||
        `Connection failed with HTTP ${res.status} ${res.statusText}`,
    };
  }

  return {
    ok: true as const,
    message: "Connected successfully to the Proxmox VE API.",
  };
}

type PteroListItem = {
  attributes?: Record<string, unknown>;
};

type PteroPaginated = {
  data?: PteroListItem[];
  meta?: {
    pagination?: {
      current_page?: number;
      total_pages?: number;
    };
  };
};

async function pteroAppFetch(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const cfg = await getPterodactylConfig();
  const baseUrl = cfg.baseUrl.trim().replace(/\/$/, "");
  if (!baseUrl || !cfg.apiKey) {
    throw new ValidationError(
      "Pterodactyl is not configured (URL and Application API key required)",
    );
  }
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        Accept: "application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Pterodactyl panel";
    throw new ValidationError(message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ValidationError(
      text.trim() ||
        `Pterodactyl API error: HTTP ${res.status} ${res.statusText}`,
    );
  }
  if (res.status === 204) return null;
  return res.json();
}

async function pteroPaginateAll(
  path: string,
): Promise<PteroListItem[]> {
  const items: PteroListItem[] = [];
  let page = 1;
  let totalPages = 1;
  const sep = path.includes("?") ? "&" : "?";
  while (page <= totalPages) {
    const json = (await pteroAppFetch(
      `${path}${sep}per_page=100&page=${page}`,
    )) as PteroPaginated;
    items.push(...(json.data ?? []));
    totalPages = Number(json.meta?.pagination?.total_pages ?? 1);
    page += 1;
    if (page > 50) break;
  }
  return items;
}

export type PteroMetaLocation = { id: number; short: string; long: string };
export type PteroMetaNode = { id: number; name: string; locationId: number };
export type PteroMetaNest = { id: number; name: string };
export type PteroMetaEgg = { id: number; name: string; nestId: number };

export async function getPterodactylMeta(input: {
  include?: string[];
  nestId?: number;
}) {
  const include = new Set(
    (input.include?.length ? input.include : ["locations", "nodes", "nests"]).map(
      (s) => s.toLowerCase(),
    ),
  );
  if (input.nestId) include.add("eggs");

  const result: {
    locations: PteroMetaLocation[];
    nodes: PteroMetaNode[];
    nests: PteroMetaNest[];
    eggs: PteroMetaEgg[];
  } = { locations: [], nodes: [], nests: [], eggs: [] };

  const tasks: Promise<void>[] = [];

  if (include.has("locations")) {
    tasks.push(
      (async () => {
        const rows = await pteroPaginateAll("/api/application/locations");
        result.locations = rows.map((row) => {
          const a = row.attributes ?? {};
          return {
            id: Number(a.id),
            short: String(a.short ?? a.id),
            long: String(a.long ?? a.short ?? a.id),
          };
        });
      })(),
    );
  }

  if (include.has("nodes")) {
    tasks.push(
      (async () => {
        const rows = await pteroPaginateAll("/api/application/nodes");
        result.nodes = rows.map((row) => {
          const a = row.attributes ?? {};
          return {
            id: Number(a.id),
            name: String(a.name ?? a.id),
            locationId: Number(a.location_id ?? 0),
          };
        });
      })(),
    );
  }

  if (include.has("nests")) {
    tasks.push(
      (async () => {
        const rows = await pteroPaginateAll("/api/application/nests");
        result.nests = rows.map((row) => {
          const a = row.attributes ?? {};
          return {
            id: Number(a.id),
            name: String(a.name ?? a.id),
          };
        });
      })(),
    );
  }

  if (include.has("eggs") && input.nestId) {
    tasks.push(
      (async () => {
        const rows = await pteroPaginateAll(
          `/api/application/nests/${input.nestId}/eggs`,
        );
        result.eggs = rows.map((row) => {
          const a = row.attributes ?? {};
          return {
            id: Number(a.id),
            name: String(a.name ?? a.id),
            nestId: Number(a.nest ?? input.nestId),
          };
        });
      })(),
    );
  }

  await Promise.all(tasks);
  return result;
}

export const pterodactylUpdateSchema = providerUpdateSchema;
export { providerUpdateSchema };
