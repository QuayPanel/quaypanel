import { withApi, jsonOk } from "@/src/core/api";
import { requirePermission } from "@/src/auth/session";
import { getClient } from "@/src/domains/clients/service";
import { writeAuditLog } from "@/src/domains/audit/service";
import { setImpersonateCookie } from "@/src/auth/impersonate";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "clients.impersonate");
    const { id } = await params;
    const client = await getClient(id);
    await setImpersonateCookie(client.id, ctx.userId);
    await writeAuditLog({
      actorId: ctx.userId,
      action: "client.impersonate",
      entityType: "client",
      entityId: client.id,
    });
    return jsonOk({ clientId: client.id, redirect: "/client" });
  });
}
