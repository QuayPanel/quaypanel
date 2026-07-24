import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  activateTheme,
  listAddons,
  reloadAllAddons,
  setPluginEnabled,
  updatePluginConfig,
} from "@/src/addons/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind === "plugin" || kind === "theme") {
      return jsonOk(await listAddons(kind));
    }
    const [plugins, themes] = await Promise.all([
      listAddons("plugin"),
      listAddons("theme"),
    ]);
    return jsonOk({ plugins, themes });
  });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enable_plugin"),
    addonId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("plugin_config"),
    addonId: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("activate_theme"),
    addonId: z.string().min(1),
  }),
  z.object({
    action: z.literal("reload"),
  }),
]);

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = patchSchema.parse(await request.json());

    switch (body.action) {
      case "enable_plugin":
        return jsonOk(
          await setPluginEnabled(body.addonId, body.enabled, ctx.userId),
        );
      case "plugin_config":
        return jsonOk(
          await updatePluginConfig(body.addonId, body.config, ctx.userId),
        );
      case "activate_theme":
        return jsonOk(await activateTheme(body.addonId, ctx.userId));
      case "reload":
        return jsonOk(await reloadAllAddons(ctx.userId));
      default:
        return jsonOk({ ok: false });
    }
  });
}
