import { withApi, jsonOk } from "@/src/core/api";
import { requireAuth } from "@/src/auth/session";
import {
  listPaymentGateways,
  loadBuiltInGateways,
} from "@/src/plugins/registry";

/** Enabled checkout gateways (id + display name) for client pay UI. */
export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireAuth(auth);
    await loadBuiltInGateways();
    return jsonOk(
      listPaymentGateways().map((g) => ({ id: g.id, name: g.name })),
    );
  });
}
