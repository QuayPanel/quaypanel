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

import { requireCaptcha } from "@/src/core/captcha";

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
    const json = (await request.json()) as Record<string, unknown>;

    if (useOwnClientScope(ctx, request)) {
      await requireCaptcha(
        typeof json.captchaToken === "string" ? json.captchaToken : undefined,
        request,
      );
      const body = orderCreateSchema.parse(json);
      if (!ctx.clientId || body.clientId !== ctx.clientId) {
        throw new ForbiddenError("Cannot create orders for another client");
      }
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null;
      return jsonOk(await createOrder(body, ctx.userId, { ip }), {
        status: 201,
      });
    }

    requireStaff(auth);
    const body = orderCreateSchema.parse(json);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    return jsonOk(await createOrder(body, ctx.userId, { ip }), {
      status: 201,
    });
  });
}
