import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import { listServices } from "@/src/domains/services/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk([]);
      return jsonOk(await listServices(ctx.clientId));
    }
    requireStaff(auth);
    return jsonOk(await listServices());
  });
}
