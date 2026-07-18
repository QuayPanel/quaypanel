import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { listAuditLogs } from "@/src/domains/audit/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    requireStaff(auth);
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
    return jsonOk(await listAuditLogs(Math.min(limit, 200)));
  });
}
