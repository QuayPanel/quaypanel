import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  listGatewayConfigs,
  updateGatewayConfig,
} from "@/src/domains/settings/service";
import { loadBuiltInGateways } from "@/src/plugins/registry";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listGatewayConfigs());
  });
}

const updateSchema = z.object({
  gatewayId: z.string().min(1),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const body = updateSchema.parse(await request.json());
    const updated = await updateGatewayConfig(body.gatewayId, {
      enabled: body.enabled,
      config: body.config,
    });
    await loadBuiltInGateways();
    return jsonOk(updated);
  });
}
