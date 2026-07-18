import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  deleteOrder,
  getOrder,
  orderUpdateSchema,
  updateOrder,
} from "@/src/domains/orders/service";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const order = await getOrder(id);

    if (useOwnClientScope(ctx, request)) {
      if (order.clientId !== ctx.clientId) throw new ForbiddenError();
    } else {
      requireStaff(auth);
    }

    return jsonOk(order);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = orderUpdateSchema.parse(await request.json());
    return jsonOk(await updateOrder(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteOrder(id, ctx.userId));
  });
}
