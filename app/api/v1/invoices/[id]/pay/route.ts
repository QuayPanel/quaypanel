import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  createCheckoutForInvoice,
  payInvoiceSchema,
} from "@/src/domains/payments/service";
import { getInvoice, canPayInvoiceAsClient } from "@/src/domains/invoices/service";
import { ForbiddenError } from "@/src/core/errors";
import { requireCaptcha } from "@/src/core/captcha";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const invoice = await getInvoice(id);
    const json = (await request.json()) as Record<string, unknown>;

    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) throw new ForbiddenError();
      const allowed = await canPayInvoiceAsClient(ctx.clientId, invoice);
      if (!allowed) throw new ForbiddenError();
      await requireCaptcha(
        typeof json.captchaToken === "string" ? json.captchaToken : undefined,
        request,
      );
    } else {
      requireStaff(auth);
    }

    const body = payInvoiceSchema.parse(json);
    const payment = await createCheckoutForInvoice(
      id,
      body.gatewayId,
      ctx.userId,
    );
    return jsonOk(payment);
  });
}
