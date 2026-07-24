import { prisma } from "@/src/db/client";
import { getSetting, updateSettings } from "@/src/domains/settings/service";
import {
  scanPlugins,
  scanThemes,
  ensureDefaultThemeOnDisk,
  type DiscoveredPlugin,
  type DiscoveredTheme,
} from "@/src/addons/scan";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

export type AddonListItem = {
  kind: "plugin" | "theme";
  addonId: string;
  name: string;
  version: string;
  description?: string;
  path: string;
  enabled: boolean;
  active?: boolean;
  config: Record<string, unknown>;
  loadError: string | null;
  discoveryError?: string;
  provides?: string[];
  overrides?: string[];
  assetsCss?: string[];
};

async function syncInstallRows(
  kind: "plugin" | "theme",
  discovered: Array<DiscoveredPlugin | DiscoveredTheme>,
) {
  for (const item of discovered) {
    await prisma.addonInstall.upsert({
      where: {
        kind_addonId: { kind, addonId: item.addonId },
      },
      create: {
        kind,
        addonId: item.addonId,
        enabled: kind === "theme" ? item.addonId === "default" : false,
        version: item.manifest.version,
        discoveredPath: item.path,
        loadError: item.error ?? null,
      },
      update: {
        version: item.manifest.version,
        discoveredPath: item.path,
        loadError: item.error ?? null,
      },
    });
  }
}

export async function listAddons(kind: "plugin" | "theme") {
  await ensureDefaultThemeOnDisk();
  const discovered =
    kind === "plugin" ? await scanPlugins() : await scanThemes();
  await syncInstallRows(kind, discovered);

  const installs = await prisma.addonInstall.findMany({
    where: { kind },
  });
  const byId = new Map(installs.map((row) => [row.addonId, row]));
  const activeThemeId = String(
    (await getSetting("theme.activeId", "default")) || "default",
  );

  return discovered.map((item): AddonListItem => {
    const install = byId.get(item.addonId);
    const config =
      install?.config && typeof install.config === "object"
        ? (install.config as Record<string, unknown>)
        : {};
    const enabled =
      kind === "theme"
        ? item.addonId === activeThemeId
        : Boolean(install?.enabled);

    return {
      kind,
      addonId: item.addonId,
      name: item.manifest.name,
      version: item.manifest.version,
      description: item.manifest.description,
      path: item.path,
      enabled,
      active: kind === "theme" ? item.addonId === activeThemeId : undefined,
      config,
      loadError: install?.loadError ?? item.error ?? null,
      discoveryError: item.error,
      provides:
        item.kind === "plugin" ? item.manifest.provides : undefined,
      overrides:
        item.kind === "theme" ? item.manifest.overrides : undefined,
      assetsCss:
        item.kind === "theme" ? item.manifest.assets?.css : undefined,
    };
  });
}

export async function setPluginEnabled(
  addonId: string,
  enabled: boolean,
  actorId?: string,
) {
  const plugins = await scanPlugins();
  const found = plugins.find((p) => p.addonId === addonId);
  if (!found) throw new NotFoundError("Plugin not found on disk");
  if (found.error) throw new ValidationError(found.error);

  const row = await prisma.addonInstall.upsert({
    where: { kind_addonId: { kind: "plugin", addonId } },
    create: {
      kind: "plugin",
      addonId,
      enabled,
      version: found.manifest.version,
      discoveredPath: found.path,
    },
    update: { enabled },
  });

  await writeAuditLog({
    actorId,
    action: enabled ? "addon.plugin.enable" : "addon.plugin.disable",
    entityType: "addon",
    entityId: addonId,
  });

  // Best-effort hot reload
  const { reloadEnabledPlugins } = await import("@/src/addons/plugin-loader");
  await reloadEnabledPlugins().catch(() => undefined);

  return row;
}

export async function updatePluginConfig(
  addonId: string,
  config: Record<string, unknown>,
  actorId?: string,
) {
  const plugins = await scanPlugins();
  const found = plugins.find((p) => p.addonId === addonId);
  if (!found) throw new NotFoundError("Plugin not found on disk");

  const row = await prisma.addonInstall.upsert({
    where: { kind_addonId: { kind: "plugin", addonId } },
    create: {
      kind: "plugin",
      addonId,
      enabled: false,
      config: config as object,
      version: found.manifest.version,
      discoveredPath: found.path,
    },
    update: { config: config as object },
  });

  await writeAuditLog({
    actorId,
    action: "addon.plugin.config",
    entityType: "addon",
    entityId: addonId,
  });

  return row;
}

export async function activateTheme(addonId: string, actorId?: string) {
  const themes = await scanThemes();
  const found = themes.find((t) => t.addonId === addonId);
  if (!found) throw new NotFoundError("Theme not found on disk");
  if (found.error) throw new ValidationError(found.error);

  await prisma.addonInstall.upsert({
    where: { kind_addonId: { kind: "theme", addonId } },
    create: {
      kind: "theme",
      addonId,
      enabled: true,
      version: found.manifest.version,
      discoveredPath: found.path,
    },
    update: { enabled: true },
  });

  // Only one theme "enabled" at a time in install rows
  await prisma.addonInstall.updateMany({
    where: { kind: "theme", addonId: { not: addonId } },
    data: { enabled: false },
  });

  await updateSettings({
    "theme.activeId": addonId,
    "theme.id": addonId,
  });

  await writeAuditLog({
    actorId,
    action: "addon.theme.activate",
    entityType: "addon",
    entityId: addonId,
  });

  const { reloadActiveTheme } = await import("@/src/addons/theme-runtime");
  await reloadActiveTheme().catch(() => undefined);

  return { ok: true, activeId: addonId };
}

export async function reloadAllAddons(actorId?: string) {
  const { reloadEnabledPlugins } = await import("@/src/addons/plugin-loader");
  const { reloadActiveTheme } = await import("@/src/addons/theme-runtime");
  await reloadEnabledPlugins();
  await reloadActiveTheme();
  await writeAuditLog({
    actorId,
    action: "addon.reload",
    entityType: "addon",
  });
  return { ok: true };
}

export async function getActiveThemeId() {
  return String((await getSetting("theme.activeId", "default")) || "default");
}
