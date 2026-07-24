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
    .map((p) => path.resolve(p));
}

export function addonsRoot(kind: AddonKind) {
  return path.join(process.cwd(), kind === "plugin" ? "plugins" : "themes");
}

export function addonDir(kind: AddonKind, addonId: string) {
  return path.join(addonsRoot(kind), addonId);
}

/** Resolve an addon directory, preferring cwd install then ADDON_DEV_PATH matches. */
export function resolveAddonDir(kind: AddonKind, addonId: string) {
  const primary = addonDir(kind, addonId);
  return primary;
}

/** Safe join under an addon root; rejects path traversal. */
export function resolveAddonAsset(
  kind: AddonKind,
  addonId: string,
  relativePath: string,
) {
  const root = path.resolve(addonDir(kind, addonId));
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return null;
  }
  return target;
}
