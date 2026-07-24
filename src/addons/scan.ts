import { readdir, readFile, access } from "fs/promises";
import path from "path";
import { constants } from "fs";
import {
  pluginManifestSchema,
  themeManifestSchema,
  type PluginManifest,
  type ThemeManifest,
} from "@/src/addons/manifests";
import {
  addonDevPaths,
  addonDir,
  addonsRoot,
  type AddonKind,
} from "@/src/addons/paths";

export type DiscoveredPlugin = {
  kind: "plugin";
  addonId: string;
  path: string;
  manifest: PluginManifest;
  error?: string;
};

export type DiscoveredTheme = {
  kind: "theme";
  addonId: string;
  path: string;
  manifest: ThemeManifest;
  error?: string;
};

async function exists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function scanPluginDir(
  dir: string,
  folderName: string,
): Promise<DiscoveredPlugin> {
  const manifestPath = path.join(dir, "addon.json");
  try {
    const raw = JSON.parse(await readFile(manifestPath, "utf8"));
    const manifest = pluginManifestSchema.parse(raw);
    if (manifest.id !== folderName) {
      return {
        kind: "plugin",
        addonId: folderName,
        path: dir,
        manifest: { ...manifest, id: folderName },
        error: `Manifest id "${manifest.id}" does not match folder "${folderName}"`,
      };
    }
    return { kind: "plugin", addonId: manifest.id, path: dir, manifest };
  } catch (err) {
    return {
      kind: "plugin",
      addonId: folderName,
      path: dir,
      manifest: {
        id: folderName,
        name: folderName,
        version: "0.0.0",
        type: "plugin",
        entry: "dist/index.js",
        provides: [],
      },
      error: err instanceof Error ? err.message : "Invalid addon.json",
    };
  }
}

async function scanThemeDir(
  dir: string,
  folderName: string,
): Promise<DiscoveredTheme> {
  const manifestPath = path.join(dir, "theme.json");
  try {
    const raw = JSON.parse(await readFile(manifestPath, "utf8"));
    const manifest = themeManifestSchema.parse(raw);
    if (manifest.id !== folderName) {
      return {
        kind: "theme",
        addonId: folderName,
        path: dir,
        manifest: { ...manifest, id: folderName },
        error: `Manifest id "${manifest.id}" does not match folder "${folderName}"`,
      };
    }
    return { kind: "theme", addonId: manifest.id, path: dir, manifest };
  } catch (err) {
    return {
      kind: "theme",
      addonId: folderName,
      path: dir,
      manifest: {
        id: folderName,
        name: folderName,
        version: "0.0.0",
        type: "theme",
      },
      error: err instanceof Error ? err.message : "Invalid theme.json",
    };
  }
}

async function scanPluginRoot(root: string): Promise<DiscoveredPlugin[]> {
  if (!(await exists(root))) return [];
  const out: DiscoveredPlugin[] = [];

  // Single plugin package pointed at by ADDON_DEV_PATH
  if (await exists(path.join(root, "addon.json"))) {
    const folderName = path.basename(root);
    out.push(await scanPluginDir(root, folderName));
    return out;
  }

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (!(await exists(path.join(dir, "addon.json")))) continue;
    out.push(await scanPluginDir(dir, entry.name));
  }
  return out;
}

async function scanThemeRoot(root: string): Promise<DiscoveredTheme[]> {
  if (!(await exists(root))) return [];
  const out: DiscoveredTheme[] = [];

  if (await exists(path.join(root, "theme.json"))) {
    const folderName = path.basename(root);
    out.push(await scanThemeDir(root, folderName));
    return out;
  }

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (!(await exists(path.join(dir, "theme.json")))) continue;
    out.push(await scanThemeDir(dir, entry.name));
  }
  return out;
}

function mergeById<T extends { addonId: string; path: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    // Later roots (dev paths) override earlier (shipped) for same id
    map.set(item.addonId, item);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.addonId.localeCompare(b.addonId),
  );
}

export async function scanPlugins(): Promise<DiscoveredPlugin[]> {
  const roots = [addonsRoot("plugin"), ...addonDevPaths()];
  const all: DiscoveredPlugin[] = [];
  for (const root of roots) {
    all.push(...(await scanPluginRoot(root)));
  }
  // Prefer packages that live under cwd/plugins for the same id
  const primary = await scanPluginRoot(addonsRoot("plugin"));
  const primaryIds = new Set(primary.map((p) => p.addonId));
  const merged = mergeById([
    ...all.filter((p) => !primaryIds.has(p.addonId)),
    ...primary,
  ]);
  return merged;
}

export async function scanThemes(): Promise<DiscoveredTheme[]> {
  const roots = [addonsRoot("theme"), ...addonDevPaths()];
  const all: DiscoveredTheme[] = [];
  for (const root of roots) {
    all.push(...(await scanThemeRoot(root)));
  }
  const primary = await scanThemeRoot(addonsRoot("theme"));
  const primaryIds = new Set(primary.map((t) => t.addonId));
  return mergeById([
    ...all.filter((t) => !primaryIds.has(t.addonId)),
    ...primary,
  ]);
}

export async function readThemeManifest(addonId: string) {
  const candidates = [
    path.join(addonDir("theme", addonId), "theme.json"),
    ...addonDevPaths().flatMap((root) => [
      path.join(root, "theme.json"),
      path.join(root, addonId, "theme.json"),
    ]),
  ];
  for (const file of candidates) {
    if (!(await exists(file))) continue;
    const raw = JSON.parse(await readFile(file, "utf8"));
    const manifest = themeManifestSchema.parse(raw);
    if (manifest.id === addonId || path.basename(path.dirname(file)) === addonId) {
      return manifest;
    }
  }
  return null;
}

export async function readPluginManifest(addonId: string) {
  const candidates = [
    path.join(addonDir("plugin", addonId), "addon.json"),
    ...addonDevPaths().flatMap((root) => [
      path.join(root, "addon.json"),
      path.join(root, addonId, "addon.json"),
    ]),
  ];
  for (const file of candidates) {
    if (!(await exists(file))) continue;
    const raw = JSON.parse(await readFile(file, "utf8"));
    const manifest = pluginManifestSchema.parse(raw);
    if (manifest.id === addonId || path.basename(path.dirname(file)) === addonId) {
      return manifest;
    }
  }
  return null;
}

/** Resolve on-disk directory for an addon (cwd first, then ADDON_DEV_PATH). */
export async function resolveDiscoveredAddonPath(
  kind: AddonKind,
  addonId: string,
): Promise<string | null> {
  const primary = addonDir(kind, addonId);
  const manifestName = kind === "plugin" ? "addon.json" : "theme.json";
  if (await exists(path.join(primary, manifestName))) return primary;

  for (const root of addonDevPaths()) {
    if (
      path.basename(root) === addonId &&
      (await exists(path.join(root, manifestName)))
    ) {
      return root;
    }
    const nested = path.join(root, addonId);
    if (await exists(path.join(nested, manifestName))) return nested;
  }
  return null;
}

export async function ensureDefaultThemeOnDisk() {
  return exists(path.join(addonsRoot("theme"), "default", "theme.json"));
}

export type { AddonKind };
