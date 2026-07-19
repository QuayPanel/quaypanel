import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { getEmailLog } from "@/src/domains/email/service";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await ctx.params;
    return jsonOk(await getEmailLog(id));
  });
}
