import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  requireOwnClientId,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  completeGdprRequest,
  createGdprRequest,
  gdprRequestCreateSchema,
  listClientGdprRequests,
  listGdprRequests,
  rejectGdprRequest,
} from "@/src/domains/gdpr/service";
import { ForbiddenError } from "@/src/core/errors";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;

    if (useOwnClientScope(ctx, request)) {
      const clientId = requireOwnClientId(ctx);
      return jsonOk(await listClientGdprRequests(clientId));
    }

    requireStaff(auth);
    return jsonOk(await listGdprRequests(status));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (!useOwnClientScope(ctx, request)) {
      throw new ForbiddenError();
    }
    const clientId = requireOwnClientId(ctx);
    const body = gdprRequestCreateSchema.parse(await request.json());
    return jsonOk(await createGdprRequest(clientId, body), { status: 201 });
  });
}

const gdprActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["complete", "reject"]),
  note: z.string().optional(),
});

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const ctx = requireStaff(auth);
    const body = gdprActionSchema.parse(await req.json());
    if (body.action === "complete") {
      return jsonOk(
        await completeGdprRequest(body.id, ctx.userId, body.note),
      );
    }
    return jsonOk(await rejectGdprRequest(body.id, ctx.userId, body.note));
  });
}
