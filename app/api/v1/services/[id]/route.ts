import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  deleteService,
  getService,
  requestServiceAction,
  serviceActionSchema,
  serviceUpdateSchema,
  serviceUpgradeSchema,
  updateService,
  upgradeService,
} from "@/src/domains/services/service";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const service = await getService(id);
    if (useOwnClientScope(ctx, request)) {
      if (service.clientId !== ctx.clientId) throw new ForbiddenError();
    } else {
      requireStaff(auth);
    }
    return jsonOk(service);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = serviceUpdateSchema.parse(await request.json());
    return jsonOk(await updateService(id, body, ctx.userId));
  });
}

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const json = await request.json();

    if (json?.action === "upgrade") {
      const body = serviceUpgradeSchema.parse(json);
      const service = await getService(id);
      if (useOwnClientScope(ctx, request)) {
        if (service.clientId !== ctx.clientId) throw new ForbiddenError();
      } else {
        requireStaff(auth);
      }
      return jsonOk(await upgradeService(id, body, ctx.userId));
    }

    requireStaff(auth);
    const body = serviceActionSchema.parse(json);
    return jsonOk(
      await requestServiceAction(
        id,
        body.action,
        ctx.userId,
        body.creditAmountMinor ?? 0,
      ),
    );
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteService(id, ctx.userId));
  });
}
