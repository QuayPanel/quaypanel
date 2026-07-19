import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { sendSmtpTestEmail } from "@/src/email/send";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await sendSmtpTestEmail());
  });
}
