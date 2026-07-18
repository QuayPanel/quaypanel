import { withApi, jsonOk } from "@/src/core/api";
import { prisma } from "@/src/db/client";
import { requireAuth } from "@/src/auth/session";
import {
  clientUpdateSchema,
  updateClient,
} from "@/src/domains/clients/service";
import { ValidationError } from "@/src/core/errors";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    if (!auth) return jsonOk(null);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: { client: true },
    });
    return jsonOk(user);
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (!ctx.clientId) {
      throw new ValidationError("No client profile linked to this account");
    }
    const body = clientUpdateSchema.parse(await request.json());
    if (body.firstName || body.lastName) {
      const first = body.firstName ?? "";
      const last = body.lastName ?? "";
      if (!body.name && (first || last)) {
        body.name = `${first} ${last}`.trim();
      }
    }
    const client = await updateClient(ctx.clientId, body, ctx.userId);
    return jsonOk(client);
  });
}
