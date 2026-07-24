import path from "path";

export type AddonKind = "plugin" | "theme";

/** Extra roots from ADDON_DEV_PATH (path.delimiter-separated). */
export function addonDevPaths(): string[] {
  const raw = process.env.ADDON_DEV_PATH?.trim();
  if (!raw) return [];
  return raw
    .split(path.delimiter)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.resolve(/* turbopackIgnore: true */ p));
}

/**
 * Addon install roots under the project.
 * `turbopackIgnore` prevents NFT from treating cwd as the whole project graph.
 */
export function addonsRoot(kind: AddonKind) {
  if (kind === "plugin") {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "plugins");
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "themes");
}

export function addonDir(kind: AddonKind, addonId: string) {
  return path.join(addonsRoot(kind), addonId);
}

/** Resolve an addon directory, preferring cwd install then ADDON_DEV_PATH matches. */
export function resolveAddonDir(kind: AddonKind, addonId: string) {
  return addonDir(kind, addonId);
}

/** Safe join under an addon root; rejects path traversal. */
export function resolveAddonAsset(
  kind: AddonKind,
  addonId: string,
  relativePath: string,
) {
  const root = path.resolve(/* turbopackIgnore: true */ addonDir(kind, addonId));
  const target = path.resolve(/* turbopackIgnore: true */ root, relativePath);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return null;
  }
  return target;
}
