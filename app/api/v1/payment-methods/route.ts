import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireOwnClientId,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import { ForbiddenError } from "@/src/core/errors";
import { listClientPaymentMethods } from "@/src/domains/billing/payment-methods";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      return jsonOk(await listClientPaymentMethods(requireOwnClientId(ctx)));
    }
    requireStaff(auth);
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) throw new ForbiddenError();
    return jsonOk(await listClientPaymentMethods(clientId));
  });
}
