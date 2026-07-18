import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  createOrder,
  listOrders,
  orderCreateSchema,
} from "@/src/domains/orders/service";
import { ForbiddenError } from "@/src/core/errors";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk([]);
      return jsonOk(await listOrders(ctx.clientId));
    }
    requireStaff(auth);
    return jsonOk(await listOrders());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const body = orderCreateSchema.parse(await request.json());

    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId || body.clientId !== ctx.clientId) {
        throw new ForbiddenError("Cannot create orders for another client");
      }
    } else {
      requireStaff(auth);
    }

    return jsonOk(await createOrder(body, ctx.userId), { status: 201 });
  });
}
