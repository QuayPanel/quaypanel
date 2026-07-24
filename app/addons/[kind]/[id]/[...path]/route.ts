import type { AddonKind } from "@/src/addons/paths";

type Params = { params: Promise<{ kind: string; id: string; path: string[] }> };

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(_request: Request, { params }: Params) {
  const { kind, id, path: parts } = await params;
  if (kind !== "themes" && kind !== "plugins") {
    return new Response("Not found", { status: 404 });
  }
  const addonKind: AddonKind = kind === "themes" ? "theme" : "plugin";
  const relative = parts.map(decodeURIComponent).join("/");
  if (!relative || relative.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const { resolveDiscoveredAddonPath } = await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    "@/src/addons/scan"
  );
  const path = await import("path");
  const { readFile, stat } = await import("fs/promises");

  const base = await resolveDiscoveredAddonPath(addonKind, id);
  if (!base) return new Response("Not found", { status: 404 });

  const root = path.resolve(/* turbopackIgnore: true */ base);
  const filePath = path.resolve(/* turbopackIgnore: true */ root, relative);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(/* turbopackIgnore: true */ filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const bytes = await readFile(/* turbopackIgnore: true */ filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
