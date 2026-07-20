import { withApi, jsonOk } from "@/src/core/api";
import { requireAuth, isStaffRole } from "@/src/auth/session";
import { clearImpersonateCookie } from "@/src/auth/impersonate";
import { writeAuditLog } from "@/src/domains/audit/service";
import { ForbiddenError } from "@/src/core/errors";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (!isStaffRole(ctx.role)) throw new ForbiddenError();
    await clearImpersonateCookie();
    await writeAuditLog({
      actorId: ctx.userId,
      action: "client.impersonate_stop",
      entityType: "user",
      entityId: ctx.userId,
    });
    return jsonOk({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return POST(request);
}
