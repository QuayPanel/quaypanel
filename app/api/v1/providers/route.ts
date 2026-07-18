import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  listProviders,
  providerUpdateSchema,
  updatePterodactylProvider,
  updateProxmoxProvider,
} from "@/src/domains/providers/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listProviders());
  });
}

const patchSchema = z.object({
  providerId: z.enum(["pterodactyl", "proxmox"]),
  enabled: z.boolean().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  node: z.string().optional(),
});

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const body = patchSchema.parse(await request.json());
    const { providerId, ...fields } = body;
    providerUpdateSchema.parse(fields);
    if (providerId === "proxmox") {
      return jsonOk(await updateProxmoxProvider(fields));
    }
    return jsonOk(await updatePterodactylProvider(fields));
  });
}
