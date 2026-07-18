import { withApi, jsonOk } from "@/src/core/api";
import { requireAdmin } from "@/src/auth/session";
import {
  apiKeyCreateSchema,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/src/domains/api-keys/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAdmin(auth);
    return jsonOk(await listApiKeys(ctx.userId));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAdmin(auth);
    const body = apiKeyCreateSchema.parse(await request.json());
    return jsonOk(await createApiKey(ctx.userId, body, ctx.userId), {
      status: 201,
    });
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAdmin(auth);
    const body = z.object({ id: z.string() }).parse(await request.json());
    await revokeApiKey(body.id, ctx.userId, ctx.userId);
    return jsonOk({ ok: true });
  });
}
