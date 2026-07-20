import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  requireOwnClientId,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  affiliatePayoutRequestSchema,
  listAffiliatePayouts,
  requestAffiliatePayout,
  updateAffiliatePayoutStatus,
} from "@/src/domains/affiliates/service";
import { ForbiddenError } from "@/src/core/errors";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;

    if (useOwnClientScope(ctx, request)) {
      const clientId = requireOwnClientId(ctx);
      const payouts = await listAffiliatePayouts(status);
      return jsonOk(payouts.filter((p) => p.clientId === clientId));
    }

    requireStaff(auth);
    return jsonOk(await listAffiliatePayouts(status));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (!useOwnClientScope(ctx, request)) {
      throw new ForbiddenError();
    }
    const clientId = requireOwnClientId(ctx);
    const body = affiliatePayoutRequestSchema.parse(await request.json());
    return jsonOk(await requestAffiliatePayout(clientId, body.amountMinor), {
      status: 201,
    });
  });
}

const payoutUpdateSchema = z.object({
  status: z.enum(["APPROVED", "PAID", "REJECTED"]),
  note: z.string().optional(),
});

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const ctx = requireStaff(auth);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ForbiddenError("Missing payout id");
    const body = payoutUpdateSchema.parse(await req.json());
    return jsonOk(
      await updateAffiliatePayoutStatus(
        id,
        body.status,
        ctx.userId,
        body.note,
      ),
    );
  });
}
