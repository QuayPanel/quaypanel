import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireOwnClientId,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  inviteContributorSchema,
  inviteServiceContributor,
  listServiceContributors,
} from "@/src/domains/services/contributors";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    if (!useOwnClientScope(ctx, request)) {
      throw new ForbiddenError();
    }
    const clientId = requireOwnClientId(ctx);
    const { assertServiceOwner } = await import(
      "@/src/domains/services/contributors"
    );
    await assertServiceOwner(id, clientId);
    return jsonOk(await listServiceContributors(id));
  });
}

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    if (!useOwnClientScope(ctx, request)) {
      throw new ForbiddenError();
    }
    const clientId = requireOwnClientId(ctx);
    const body = inviteContributorSchema.parse(await request.json());
    return jsonOk(
      await inviteServiceContributor(id, body, clientId, ctx.userId),
      { status: 201 },
    );
  });
}
