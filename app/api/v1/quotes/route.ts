import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  useOwnClientScope,
  requirePermission,
} from "@/src/auth/session";
import {
  createQuote,
  listQuotes,
  quoteCreateFromDollarsSchema,
  quoteItemsFromDollars,
} from "@/src/domains/quotes/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk([]);
      return jsonOk(await listQuotes(ctx.clientId));
    }
    await requirePermission(ctx, "billing");
    return jsonOk(await listQuotes());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    await requirePermission(ctx, "billing");
    const body = quoteCreateFromDollarsSchema.parse(await request.json());
    const quote = await createQuote(
      {
        clientId: body.clientId,
        currency: body.currency,
        note: body.note,
        validUntil: body.validUntil,
        items: quoteItemsFromDollars(body.items),
      },
      ctx.userId,
    );
    return jsonOk(quote, { status: 201 });
  });
}
