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
} from "@/src/domains/credits/service";
import { ForbiddenError } from "@/src/core/errors";
import { minorToDollars } from "@/src/core/utils";

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
    const body = creditDepositSchema.parse(await request.json());
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId || body.clientId !== ctx.clientId) {
        throw new ForbiddenError();
      }
    } else {
      requireStaff(auth);
    }
    return jsonOk(await depositCredits(body, ctx.userId), { status: 201 });
  });
}
