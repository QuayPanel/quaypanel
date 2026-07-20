import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { massMailSchema, sendMassMail } from "@/src/domains/email/service";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = massMailSchema.parse(await request.json());
    return jsonOk(await sendMassMail(body, ctx.userId));
  });
}
