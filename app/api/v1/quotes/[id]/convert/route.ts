import { withApi, jsonOk } from "@/src/core/api";
import { requirePermission } from "@/src/auth/session";
import { convertQuoteToInvoice } from "@/src/domains/quotes/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "billing");
    const { id } = await params;
    return jsonOk(await convertQuoteToInvoice(id, ctx.userId));
  });
}
