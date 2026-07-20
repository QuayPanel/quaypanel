import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { listLoginEvents } from "@/src/domains/fraud/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await listLoginEvents(id));
  });
}
