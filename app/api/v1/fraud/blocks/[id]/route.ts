import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { deleteFraudBlock } from "@/src/domains/fraud/service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteFraudBlock(id, ctx.userId));
  });
}
