import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireOwnClientId,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import { ForbiddenError } from "@/src/core/errors";
import {
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/src/domains/billing/payment-methods";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;

    if (useOwnClientScope(ctx, request)) {
      return jsonOk(
        await setDefaultPaymentMethod(requireOwnClientId(ctx), id),
      );
    }

    requireStaff(auth);
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) throw new ForbiddenError();
    return jsonOk(await setDefaultPaymentMethod(clientId, id));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;

    if (useOwnClientScope(ctx, request)) {
      return jsonOk(await removePaymentMethod(requireOwnClientId(ctx), id));
    }

    requireStaff(auth);
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) throw new ForbiddenError();
    return jsonOk(await removePaymentMethod(clientId, id));
  });
}
