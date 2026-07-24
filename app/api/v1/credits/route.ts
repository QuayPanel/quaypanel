import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  creditDepositSchema,
  depositCredits,
  getCreditBalance,
  listCreditLedger,
  createCreditDepositCheckout,
} from "@/src/domains/credits/service";
import { ForbiddenError } from "@/src/core/errors";
import { minorToDollars } from "@/src/core/utils";
import { z } from "zod";
import { requireCaptcha } from "@/src/core/captcha";

const clientDepositSchema = z.object({
  amount: z.number().positive(),
  gatewayId: z.string().min(1).optional(),
  captchaToken: z.string().optional(),
});

function creditBalancePayload(balanceMinor: number, ledger: unknown) {
  return {
    balanceMinor,
    balance: Number(minorToDollars(balanceMinor)),
    ledger,
  };
}

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) throw new ForbiddenError();
      const [balance, ledger] = await Promise.all([
        getCreditBalance(ctx.clientId),
        listCreditLedger(ctx.clientId),
      ]);
      return jsonOk(creditBalancePayload(balance, ledger));
    }
    requireStaff(auth);
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) throw new ForbiddenError();
    const [balance, ledger] = await Promise.all([
      getCreditBalance(clientId),
      listCreditLedger(clientId),
    ]);
    return jsonOk(creditBalancePayload(balance, ledger));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) throw new ForbiddenError();
      const body = clientDepositSchema.parse(await request.json());
      await requireCaptcha(body.captchaToken, request);
      const result = await createCreditDepositCheckout(
        ctx.clientId,
        body.amount,
        body.gatewayId ?? "stripe",
        ctx.userId,
      );
      return jsonOk(
        {
          invoice: result.invoice,
          checkoutUrl: result.payment.checkoutUrl,
        },
        { status: 201 },
      );
    }

    requireStaff(auth);
    const body = creditDepositSchema.parse(await request.json());
    return jsonOk(await depositCredits(body, ctx.userId), { status: 201 });
  });
}
