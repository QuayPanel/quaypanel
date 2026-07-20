import { z } from "zod";
import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { rejectOrderReview } from "@/src/domains/fraud/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = z
      .object({ note: z.string().optional() })
      .parse(await request.json().catch(() => ({})));
    return jsonOk(await rejectOrderReview(id, ctx.userId, body.note));
  });
}
