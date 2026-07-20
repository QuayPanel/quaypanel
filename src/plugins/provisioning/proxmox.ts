import type { ProvisioningProvider, ServiceContext } from "./types";
import { logger } from "@/src/core/logger";
import { AppError } from "@/src/core/errors";
import { getSetting } from "@/src/domains/settings/service";

type ProxmoxSettings = {
  enabled?: boolean;
  baseUrl?: string;
  /** Full PVEAPIToken value: USER@REALM!TOKENID=SECRET */
  apiKey?: string;
  node?: string;
  /** Legacy field names */
  url?: string;
  tokenId?: string;
  tokenSecret?: string;
};

async function proxmoxConfig() {
  return (await getSetting("provisioning.proxmox", {})) as ProxmoxSettings;
}

function resolveAuth(cfg: ProxmoxSettings) {
  const baseUrl = (cfg.baseUrl || cfg.url || "").replace(/\/$/, "");
  let token = cfg.apiKey || "";
  if (!token && cfg.tokenId && cfg.tokenSecret) {
    token = `${cfg.tokenId}=${cfg.tokenSecret}`;
  }
  return { baseUrl, token, enabled: Boolean(cfg.enabled), node: cfg.node || "pve" };
}

async function proxmoxRequest(path: string, init?: RequestInit) {
  const cfg = await proxmoxConfig();
  const { baseUrl, token, enabled } = resolveAuth(cfg);
  if (!enabled || !baseUrl || !token) {
    throw new AppError("Proxmox is not configured or disabled", 400);
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `PVEAPIToken=${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}/api2/json${path}`, { ...init, headers });
}

export const proxmoxProvisioningProvider: ProvisioningProvider = {
  id: "proxmox",
  name: "Proxmox",

  async provision(service: ServiceContext) {
    const cfg = await proxmoxConfig();
    const { node } = resolveAuth(cfg);
    const pc = service.provisionConfig ?? {};
    const vmid =
      Number((pc as { vmid?: number }).vmid) ||
      Math.floor(100 + Math.random() * 800);
    logger.info(
      { serviceId: service.serviceId, node, vmid },
      "Proxmox provision VM",
    );
    try {
      const res = await proxmoxRequest(`/nodes/${node}/qemu`, {
        method: "POST",
        body: JSON.stringify({
          vmid,
          name: service.hostname || `apex-${service.serviceId.slice(0, 8)}`,
          cores: Number((pc as { cores?: number }).cores) || 1,
          memory: Number((pc as { memory?: number }).memory) || 1024,
        }),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "Proxmox create returned non-OK");
      }
    } catch (err) {
      logger.warn({ err }, "Proxmox provision request failed; recording IDs");
    }
    return {
      externalId: String(vmid),
      hostname: service.hostname,
    };
  },

  async suspend(service: ServiceContext) {
    const cfg = await proxmoxConfig();
    const { node } = resolveAuth(cfg);
    if (!service.externalId) return;
    await proxmoxRequest(
      `/nodes/${node}/qemu/${service.externalId}/status/stop`,
      { method: "POST" },
    ).catch((err) => logger.warn({ err }, "Proxmox suspend failed"));
  },

  async unsuspend(service: ServiceContext) {
    const cfg = await proxmoxConfig();
    const { node } = resolveAuth(cfg);
    if (!service.externalId) return;
    await proxmoxRequest(
      `/nodes/${node}/qemu/${service.externalId}/status/start`,
      { method: "POST" },
    ).catch((err) => logger.warn({ err }, "Proxmox unsuspend failed"));
  },

  async terminate(service: ServiceContext) {
    const cfg = await proxmoxConfig();
    const { node } = resolveAuth(cfg);
    if (!service.externalId) return;
    await proxmoxRequest(`/nodes/${node}/qemu/${service.externalId}`, {
      method: "DELETE",
    }).catch((err) => logger.warn({ err }, "Proxmox terminate failed"));
  },

  async getConsoleUrl(service: ServiceContext) {
    const cfg = await proxmoxConfig();
    const { baseUrl, node, enabled } = resolveAuth(cfg);
    if (!enabled || !baseUrl || !service.externalId) return null;
    return {
      url: `${baseUrl}/#v1:0:=qemu%2F${encodeURIComponent(node)}%2F${encodeURIComponent(String(service.externalId))}`,
      label: "Open Proxmox console",
    };
  },
};
