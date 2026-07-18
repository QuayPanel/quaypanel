import type {
  ProvisioningProvider,
  ProvisionResult,
  ServiceContext,
} from "../types";
import { AppError } from "@/src/core/errors";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";

type PortArray = Record<string, number | number[]>;

type ProductPteroConfig = {
  nestId?: number;
  eggId?: number;
  locationId?: number;
  locationIds?: number[];
  nodeId?: number | null;
  dockerImage?: string;
  startup?: string;
  environment?: Record<string, string>;
  limits?: {
    memory?: number;
    swap?: number;
    disk?: number;
    io?: number;
    cpu?: number;
    threads?: string;
  };
  featureLimits?: {
    databases?: number;
    backups?: number;
    allocations?: number;
  };
  portArray?: PortArray | null;
  skipScripts?: boolean;
  dedicatedIp?: boolean;
  startOnCompletion?: boolean;
  oomKiller?: boolean;
  userId?: number;
};

type PteroCredentials = {
  enabled?: boolean;
  baseUrl: string;
  apiKey: string;
};

type EggResponse = {
  attributes?: {
    docker_image?: string;
    docker_images?: Record<string, string>;
    startup?: string;
    relationships?: {
      variables?: {
        data?: Array<{
          attributes?: {
            env_variable?: string;
            default_value?: string;
          };
        }>;
      };
    };
  };
};

type AllocationRow = {
  attributes?: {
    id?: number;
    port?: number;
    assigned?: boolean;
  };
};

function asProductConfig(
  provisionConfig?: Record<string, unknown>,
): ProductPteroConfig {
  return (provisionConfig ?? {}) as ProductPteroConfig;
}

function flattenPortArray(portArray: PortArray | null | undefined): number[] {
  if (!portArray) return [];
  const ports: number[] = [];
  for (const value of Object.values(portArray)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      ports.push(value);
    } else if (Array.isArray(value)) {
      for (const n of value) {
        if (typeof n === "number" && Number.isFinite(n)) ports.push(n);
      }
    }
  }
  return [...new Set(ports)];
}

function portRangeFromArray(portArray: PortArray | null | undefined): string[] {
  return flattenPortArray(portArray).map(String);
}

async function loadCredentials(): Promise<PteroCredentials> {
  const row = await prisma.setting.findUnique({
    where: { key: "provisioning.pterodactyl" },
  });
  const fromSettings = (row?.value ?? {}) as Record<string, unknown>;
  if (fromSettings.enabled !== true) {
    throw new AppError(
      "Pterodactyl provider is disabled",
      400,
      "PTERO_DISABLED",
    );
  }
  const baseUrl = String(fromSettings.baseUrl ?? "").replace(/\/$/, "");
  const apiKey = String(fromSettings.apiKey ?? "");
  if (!baseUrl || !apiKey) {
    throw new AppError(
      "Pterodactyl is not configured (provisioning.pterodactyl settings)",
      400,
      "PTERO_NOT_CONFIGURED",
    );
  }
  return { enabled: true, baseUrl, apiKey };
}

async function pteroFetch(
  credentials: PteroCredentials,
  path: string,
  init?: RequestInit,
) {
  const url = `${credentials.baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      Accept: "application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text, path }, "Pterodactyl API error");
    throw new AppError(`Pterodactyl API error: ${res.status}`, 502);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadEggDefaults(
  credentials: PteroCredentials,
  nestId: number,
  eggId: number,
) {
  const egg = (await pteroFetch(
    credentials,
    `/api/application/nests/${nestId}/eggs/${eggId}?include=variables`,
  )) as EggResponse;

  const attrs = egg.attributes ?? {};
  const dockerImage =
    attrs.docker_image ||
    Object.values(attrs.docker_images ?? {})[0] ||
    "ghcr.io/pterodactyl/yolks:java_17";
  const startup = attrs.startup || "java -jar server.jar";
  const environment: Record<string, string> = {};
  for (const variable of attrs.relationships?.variables?.data ?? []) {
    const envKey = variable.attributes?.env_variable;
    if (!envKey) continue;
    environment[envKey] = String(variable.attributes?.default_value ?? "");
  }
  return { dockerImage, startup, environment };
}

async function listNodeAllocations(
  credentials: PteroCredentials,
  nodeId: number,
) {
  const items: AllocationRow[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const json = (await pteroFetch(
      credentials,
      `/api/application/nodes/${nodeId}/allocations?per_page=100&page=${page}`,
    )) as {
      data?: AllocationRow[];
      meta?: { pagination?: { total_pages?: number } };
    };
    items.push(...(json.data ?? []));
    totalPages = Number(json.meta?.pagination?.total_pages ?? 1);
    page += 1;
    if (page > 50) break;
  }
  return items;
}

function pickAllocations(
  rows: AllocationRow[],
  count: number,
  preferredPorts: number[],
): number[] {
  const free = rows.filter((row) => !row.attributes?.assigned);
  const preferred = new Set(preferredPorts);
  const matched = free
    .filter((row) => preferred.has(Number(row.attributes?.port)))
    .map((row) => Number(row.attributes?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const remaining = free
    .filter((row) => !preferred.has(Number(row.attributes?.port)))
    .map((row) => Number(row.attributes?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const picked = [...matched, ...remaining].slice(0, Math.max(1, count));
  if (picked.length < 1) {
    throw new AppError(
      "No free allocations available on the selected Pterodactyl node",
      400,
      "PTERO_NO_ALLOCATIONS",
    );
  }
  return picked;
}

async function bindPortArrayEnv(
  credentials: PteroCredentials,
  serverId: string,
  eggId: number,
  dockerImage: string,
  startup: string,
  environment: Record<string, string>,
  portArray: PortArray,
  allocationPorts: number[],
) {
  const env = { ...environment };
  let cursor = 0;
  for (const [key, value] of Object.entries(portArray)) {
    if (key === "NONE") {
      const needed = Array.isArray(value) ? value.length : 1;
      cursor += needed;
      continue;
    }
    const portsNeeded = Array.isArray(value) ? value.length : 1;
    const assigned = allocationPorts.slice(cursor, cursor + portsNeeded);
    cursor += portsNeeded;
    if (assigned.length) {
      env[key] = String(assigned[0]);
    }
  }

  await pteroFetch(credentials, `/api/application/servers/${serverId}/startup`, {
    method: "PATCH",
    body: JSON.stringify({
      startup,
      environment: env,
      egg: eggId,
      image: dockerImage,
      skip_scripts: false,
    }),
  });
}

export function createPterodactylProvider(): ProvisioningProvider {
  return {
    id: "pterodactyl",
    name: "Pterodactyl",

    async provision(service: ServiceContext): Promise<ProvisionResult> {
      const credentials = await loadCredentials();
      const config = asProductConfig(service.provisionConfig);

      const nestId = Number(config.nestId ?? 1);
      const eggId = Number(config.eggId ?? 1);
      const locationIds =
        Array.isArray(config.locationIds) && config.locationIds.length
          ? config.locationIds.map(Number).filter((n) => n > 0)
          : config.locationId
            ? [Number(config.locationId)]
            : [];
      const nodeId =
        config.nodeId != null && Number(config.nodeId) > 0
          ? Number(config.nodeId)
          : null;
      const portArray = config.portArray ?? null;
      const hasPortArray = Boolean(
        portArray && Object.keys(portArray).length > 0,
      );
      const preferredPorts = flattenPortArray(portArray);
      const additionalAllocations = Number(
        config.featureLimits?.allocations ?? 0,
      );
      const allocationCount = 1 + Math.max(0, additionalAllocations);

      const eggDefaults = await loadEggDefaults(credentials, nestId, eggId);
      const dockerImage =
        config.dockerImage || eggDefaults.dockerImage;
      const startup = config.startup || eggDefaults.startup;
      const environment = {
        ...eggDefaults.environment,
        ...(config.environment ?? {}),
      };

      const name = service.hostname || `svc-${service.serviceId.slice(0, 8)}`;
      const limits: Record<string, unknown> = {
        memory: config.limits?.memory ?? 1024,
        swap: config.limits?.swap ?? 0,
        disk: config.limits?.disk ?? 5120,
        io: config.limits?.io ?? 500,
        cpu: config.limits?.cpu ?? 100,
      };
      if (config.limits?.threads?.trim()) {
        limits.threads = config.limits.threads.trim();
      }

      const body: Record<string, unknown> = {
        name,
        user: Number(config.userId ?? service.provisionConfig?.userId ?? 1),
        egg: eggId,
        docker_image: dockerImage,
        startup,
        environment,
        skip_scripts: Boolean(config.skipScripts),
        start_on_completion:
          config.startOnCompletion == null
            ? true
            : Boolean(config.startOnCompletion),
        oom_disabled: !Boolean(config.oomKiller),
        limits,
        feature_limits: {
          databases: config.featureLimits?.databases ?? 0,
          backups: config.featureLimits?.backups ?? 0,
          allocations: Math.max(1, allocationCount),
        },
      };

      let usedAllocationPorts: number[] = [];

      if (nodeId) {
        const rows = await listNodeAllocations(credentials, nodeId);
        const pickedIds = pickAllocations(
          rows,
          allocationCount,
          preferredPorts,
        );
        usedAllocationPorts = pickedIds.map((id) => {
          const row = rows.find((r) => Number(r.attributes?.id) === id);
          return Number(row?.attributes?.port ?? 0);
        });
        body.allocation = {
          default: pickedIds[0],
          additional: pickedIds.slice(1),
        };
      } else {
        let deployLocations = locationIds;
        if (!deployLocations.length) {
          const locs = (await pteroFetch(
            credentials,
            "/api/application/locations?per_page=1",
          )) as { data?: Array<{ attributes?: { id?: number } }> };
          const first = Number(locs.data?.[0]?.attributes?.id ?? 0);
          if (!first) {
            throw new AppError(
              "No Pterodactyl locations available for deploy",
              400,
              "PTERO_NO_LOCATIONS",
            );
          }
          deployLocations = [first];
        }
        body.deploy = {
          locations: deployLocations,
          dedicated_ip: hasPortArray ? false : Boolean(config.dedicatedIp),
          port_range: portRangeFromArray(portArray),
        };
      }

      const result = await pteroFetch(credentials, "/api/application/servers", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const externalId = String(
        result?.attributes?.id ?? result?.attributes?.uuid ?? "",
      );
      const identifier = result?.attributes?.identifier as string | undefined;

      if (externalId && hasPortArray && portArray) {
        try {
          if (!usedAllocationPorts.length) {
            const details = (await pteroFetch(
              credentials,
              `/api/application/servers/${externalId}?include=allocations`,
            )) as {
              attributes?: {
                relationships?: {
                  allocations?: {
                    data?: Array<{ attributes?: { port?: number } }>;
                  };
                };
              };
            };
            usedAllocationPorts = (
              details.attributes?.relationships?.allocations?.data ?? []
            )
              .map((row) => Number(row.attributes?.port ?? 0))
              .filter((p) => p > 0);
          }
          if (usedAllocationPorts.length > 0) {
            await bindPortArrayEnv(
              credentials,
              externalId,
              eggId,
              dockerImage,
              startup,
              environment,
              portArray,
              usedAllocationPorts,
            );
          }
        } catch (err) {
          logger.warn(
            { err, externalId },
            "Failed to bind Port Array environment variables",
          );
        }
      }

      return {
        externalId,
        hostname: identifier || name,
      };
    },

    async suspend(service: ServiceContext) {
      const credentials = await loadCredentials();
      if (!service.externalId) {
        throw new AppError("Service has no externalId", 400);
      }
      await pteroFetch(
        credentials,
        `/api/application/servers/${service.externalId}/suspend`,
        { method: "POST" },
      );
    },

    async unsuspend(service: ServiceContext) {
      const credentials = await loadCredentials();
      if (!service.externalId) {
        throw new AppError("Service has no externalId", 400);
      }
      await pteroFetch(
        credentials,
        `/api/application/servers/${service.externalId}/unsuspend`,
        { method: "POST" },
      );
    },

    async terminate(service: ServiceContext) {
      const credentials = await loadCredentials();
      if (!service.externalId) {
        throw new AppError("Service has no externalId", 400);
      }
      await pteroFetch(
        credentials,
        `/api/application/servers/${service.externalId}?force=1`,
        { method: "DELETE" },
      );
    },
  };
}
