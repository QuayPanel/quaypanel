import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireOwnClientId,
  useOwnClientScope,
} from "@/src/auth/session";
import { revokeServiceContributor } from "@/src/domains/services/contributors";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string; contributorId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id, contributorId } = await params;
    if (!useOwnClientScope(ctx, request)) {
      throw new ForbiddenError();
    }
    const clientId = requireOwnClientId(ctx);
    return jsonOk(
      await revokeServiceContributor(id, contributorId, clientId, ctx.userId),
    );
  });
}
