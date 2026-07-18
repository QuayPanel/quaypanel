import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import { listPayments } from "@/src/domains/payments/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const ctx = requireAuth(auth);
    const invoiceId =
      new URL(req.url).searchParams.get("invoiceId") ?? undefined;

    if (useOwnClientScope(ctx, request)) {
      const payments = await listPayments(invoiceId);
      const filtered = payments.filter(
        (p) => p.invoice.clientId === ctx.clientId,
      );
      return jsonOk(filtered);
    }

    requireStaff(auth);
    return jsonOk(await listPayments(invoiceId));
  });
}
