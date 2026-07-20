import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  affiliateReferralCreateSchema,
  createAffiliateReferral,
} from "@/src/domains/affiliates/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = affiliateReferralCreateSchema.parse(await request.json());
    return jsonOk(await createAffiliateReferral(id, body, ctx.userId), {
      status: 201,
    });
  });
}
