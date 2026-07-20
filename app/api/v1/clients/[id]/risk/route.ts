import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  clientRiskUpdateSchema,
  updateClientRisk,
} from "@/src/domains/fraud/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = clientRiskUpdateSchema.parse(await request.json());
    return jsonOk(await updateClientRisk(id, body, ctx.userId));
  });
}
