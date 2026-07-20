import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  affiliateEnrollSchema,
  affiliateUpdateCodeSchema,
  enrollAffiliate,
  getAffiliateByClientId,
  listAffiliates,
  updateAffiliateCode,
} from "@/src/domains/affiliates/service";
import { ForbiddenError, ValidationError } from "@/src/core/errors";

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

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const body = affiliateUpdateCodeSchema.parse(await request.json());
    const url = new URL(request.url);
    const staffClientId = url.searchParams.get("clientId");

    let clientId: string;
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) throw new ForbiddenError();
      clientId = ctx.clientId;
    } else {
      requireStaff(auth);
      if (!staffClientId) {
        throw new ValidationError("clientId is required for staff updates");
      }
      clientId = staffClientId;
    }

    return jsonOk(await updateAffiliateCode(clientId, body.code, ctx.userId));
  });
}
