import {
  readThemeManifest,
  resolveDiscoveredAddonPath,
} from "@/src/addons/scan";
import { getSetting } from "@/src/domains/settings/service";
import { pathToFileURL } from "url";
import path from "path";
import { access } from "fs/promises";
import { constants } from "fs";
import type {
  AddonHookName,
  ThemeApi,
  ThemeComponent,
  ThemeViewId,
} from "@/src/addons/sdk";

const viewRegistry = new Map<string, ThemeComponent>();
let runtimeTokens: {
  light?: Record<string, string>;
  dark?: Record<string, string>;
} = {};
let loadedThemeId: string | null = null;
let activeCssHrefs: string[] = [];

export function getThemeView(id: ThemeViewId): ThemeComponent | null {
  return viewRegistry.get(id) ?? null;
}

export function listRegisteredThemeViews() {
  return Array.from(viewRegistry.keys());
}

export function getRuntimeThemeTokens() {
  return runtimeTokens;
}

export function getActiveThemeCssHrefs() {
  return activeCssHrefs;
}

export function getLoadedThemeId() {
  return loadedThemeId;
}

function createThemeApi(themeId: string): ThemeApi {
  return {
    themeId,
    registerView(id, component) {
      viewRegistry.set(id, component);
    },
    setTokens(tokens) {
      runtimeTokens = {
        light: { ...(runtimeTokens.light ?? {}), ...(tokens.light ?? {}) },
        dark: { ...(runtimeTokens.dark ?? {}), ...(tokens.dark ?? {}) },
      };
    },
  };
}

async function exists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

let loadPromise: Promise<void> | null = null;

export async function ensureThemeLoaded() {
  const themeId = String(
    (await getSetting("theme.activeId", "default")) || "default",
  );
  if (loadedThemeId === themeId) return;
  if (!loadPromise) {
    loadPromise = reloadActiveTheme().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
  // Another request may have switched themes while we were loading.
  const latest = String(
    (await getSetting("theme.activeId", "default")) || "default",
  );
  if (loadedThemeId !== latest) {
    await reloadActiveTheme();
  }
}

export async function reloadActiveTheme() {
  viewRegistry.clear();
  runtimeTokens = {};
  activeCssHrefs = [];
  loadedThemeId = null;

  const themeId = String(
    (await getSetting("theme.activeId", "default")) || "default",
  );
  const manifest = await readThemeManifest(themeId);
  if (!manifest) {
    // Fall back to default tokens from disk if present
    const fallback = await readThemeManifest("default");
    if (fallback?.tokens) {
      runtimeTokens = {
        light: fallback.tokens.light,
        dark: fallback.tokens.dark,
      };
    }
    loadedThemeId = "default";
    return;
  }

  if (manifest.tokens) {
    runtimeTokens = {
      light: manifest.tokens.light,
      dark: manifest.tokens.dark,
    };
  }

  for (const css of manifest.assets?.css ?? []) {
    activeCssHrefs.push(
      `/addons/themes/${encodeURIComponent(themeId)}/${css.replace(/^\//, "")}`,
    );
  }

  if (manifest.entry) {
    const baseDir = await resolveDiscoveredAddonPath("theme", themeId);
    const entryPath = baseDir
      ? path.join(baseDir, manifest.entry)
      : null;
    if (entryPath && (await exists(entryPath))) {
      try {
        const mod = await import(/* webpackIgnore: true */ pathToFileURL(entryPath).href);
        const register = mod.register ?? mod.default?.register;
        if (typeof register === "function") {
          await register(createThemeApi(themeId));
        }
      } catch (err) {
        const { prisma } = await import("@/src/db/client");
        await prisma.addonInstall.updateMany({
          where: { kind: "theme", addonId: themeId },
          data: {
            loadError:
              err instanceof Error ? err.message : "Failed to load theme entry",
          },
        });
      }
    }
  }

  loadedThemeId = themeId;
}

/** Hook bus for plugins (shared module). */
const hookHandlers = new Map<
  AddonHookName,
  Array<(payload: Record<string, unknown>) => void | Promise<void>>
>();

export function registerAddonHook(
  hook: AddonHookName,
  handler: (payload: Record<string, unknown>) => void | Promise<void>,
) {
  const list = hookHandlers.get(hook) ?? [];
  list.push(handler);
  hookHandlers.set(hook, list);
}

export function clearAddonHooks() {
  hookHandlers.clear();
}

export async function runAddonHooks(
  hook: AddonHookName,
  payload: Record<string, unknown>,
) {
  const list = hookHandlers.get(hook) ?? [];
  for (const handler of list) {
    try {
      await Promise.resolve(handler(payload));
    } catch {
      /* ignore addon hook errors */
    }
  }
}
