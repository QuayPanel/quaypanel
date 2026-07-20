import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  useOwnClientScope,
  requirePermission,
} from "@/src/auth/session";
import { ForbiddenError } from "@/src/core/errors";
import {
  deleteQuote,
  getQuote,
  quoteCreateFromDollarsSchema,
  quoteItemsFromDollars,
  quoteUpdateSchema,
  updateQuote,
} from "@/src/domains/quotes/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const quote = await getQuote(id);
    if (useOwnClientScope(ctx, request)) {
      if (quote.clientId !== ctx.clientId) throw new ForbiddenError();
    } else {
      await requirePermission(ctx, "billing");
    }
    return jsonOk(quote);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    await requirePermission(ctx, "billing");
    const { id } = await params;
    const raw = await request.json();
    const body = quoteUpdateSchema
      .extend({
        items: quoteCreateFromDollarsSchema.shape.items.optional(),
      })
      .parse(raw);
    const data = {
      ...body,
      ...(body.items
        ? { items: quoteItemsFromDollars(body.items) }
        : {}),
    };
    return jsonOk(await updateQuote(id, data, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    await requirePermission(ctx, "billing");
    const { id } = await params;
    return jsonOk(await deleteQuote(id, ctx.userId));
  });
}
