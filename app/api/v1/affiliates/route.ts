import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  affiliateEnrollSchema,
  enrollAffiliate,
  getAffiliateByClientId,
  listAffiliates,
} from "@/src/domains/affiliates/service";
import { ForbiddenError } from "@/src/core/errors";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk(null);
      return jsonOk(await getAffiliateByClientId(ctx.clientId));
    }
    requireStaff(auth);
    return jsonOk(await listAffiliates());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const body = affiliateEnrollSchema.parse(await request.json());
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId || body.clientId !== ctx.clientId) {
        throw new ForbiddenError();
      }
    } else {
      requireStaff(auth);
    }
    return jsonOk(await enrollAffiliate(body, ctx.userId), { status: 201 });
  });
}
