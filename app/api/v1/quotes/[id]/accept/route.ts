import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  useOwnClientScope,
  requireOwnClientId,
} from "@/src/auth/session";
import { ForbiddenError } from "@/src/core/errors";
import { acceptQuote } from "@/src/domains/quotes/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (!useOwnClientScope(ctx, request)) throw new ForbiddenError();
    const clientId = requireOwnClientId(ctx);
    const { id } = await params;
    return jsonOk(await acceptQuote(id, clientId, ctx.userId));
  });
}
