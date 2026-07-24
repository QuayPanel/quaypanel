import path from "path";
import { pathToFileURL } from "url";
import { access } from "fs/promises";
import { constants } from "fs";
import { prisma } from "@/src/db/client";
import {
  resolveDiscoveredAddonPath,
  scanPlugins,
} from "@/src/addons/scan";
import type { PluginApi, AddonHookName } from "@/src/addons/sdk";
import {
  registerPaymentGateway,
  registerProvisioningProvider,
  clearExternalPaymentGateways,
  clearExternalProvisioningProviders,
} from "@/src/plugins/registry";
import {
  clearAddonHooks,
  registerAddonHook,
} from "@/src/addons/theme-runtime";

async function exists(filePath: string) {
  try {
    await access(/* turbopackIgnore: true */ filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function createPluginApi(
  addonId: string,
  config: Record<string, unknown>,
): PluginApi {
  return {
    addonId,
    registerPaymentGateway(gateway) {
      registerPaymentGateway(gateway, { external: true, addonId });
    },
    registerProvisioningProvider(provider) {
      registerProvisioningProvider(provider, { external: true, addonId });
    },
    on(hook: AddonHookName, handler) {
      registerAddonHook(hook, handler);
    },
    getConfig() {
      return config as never;
    },
  };
}

export async function reloadEnabledPlugins() {
  clearExternalPaymentGateways();
  clearExternalProvisioningProviders();
  clearAddonHooks();

  const discovered = await scanPlugins();
  const enabled = await prisma.addonInstall.findMany({
    where: { kind: "plugin", enabled: true },
  });
  const enabledIds = new Set(enabled.map((r) => r.addonId));

  for (const plugin of discovered) {
    if (!enabledIds.has(plugin.addonId) || plugin.error) continue;
    const install = enabled.find((r) => r.addonId === plugin.addonId);
    const config =
      install?.config && typeof install.config === "object"
        ? (install.config as Record<string, unknown>)
        : {};

    const entryRel = plugin.manifest.entry || "dist/index.js";
    const baseDir =
      plugin.path ||
      (await resolveDiscoveredAddonPath("plugin", plugin.addonId));
    if (!baseDir) {
      await prisma.addonInstall.updateMany({
        where: { kind: "plugin", addonId: plugin.addonId },
        data: { loadError: "Addon directory not found" },
      });
      continue;
    }
    const entryPath = path.join(
      /* turbopackIgnore: true */ baseDir,
      entryRel,
    );
    if (!(await exists(entryPath))) {
      await prisma.addonInstall.updateMany({
        where: { kind: "plugin", addonId: plugin.addonId },
        data: { loadError: `Missing entry ${entryRel}` },
      });
      continue;
    }

    try {
      // Runtime zip-drop entries — keep out of Turbopack NFT graph.
      const href = pathToFileURL(entryPath).href;
      const load = new Function(
        "u",
        "return import(u)",
      ) as (u: string) => Promise<{
        register?: (api: PluginApi) => void | Promise<void>;
        default?: { register?: (api: PluginApi) => void | Promise<void> };
      }>;
      const mod = await load(href);
      const register = mod.register ?? mod.default?.register;
      if (typeof register !== "function") {
        throw new Error("Plugin entry must export register(api)");
      }
      await register(createPluginApi(plugin.addonId, config));
      await prisma.addonInstall.updateMany({
        where: { kind: "plugin", addonId: plugin.addonId },
        data: { loadError: null },
      });
    } catch (err) {
      await prisma.addonInstall.updateMany({
        where: { kind: "plugin", addonId: plugin.addonId },
        data: {
          loadError:
            err instanceof Error ? err.message : "Failed to load plugin",
        },
      });
    }
  }
}
