import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { updateReferralStatus } from "@/src/domains/affiliates/service";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = z
      .object({ status: z.enum(["PENDING", "APPROVED", "PAID"]) })
      .parse(await request.json());
    return jsonOk(await updateReferralStatus(id, body.status, ctx.userId));
  });
}
