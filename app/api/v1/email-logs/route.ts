import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { listEmailLogs } from "@/src/domains/email/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    requireStaff(auth);
    const url = new URL(req.url);
    return jsonOk(
      await listEmailLogs({
        status: url.searchParams.get("status") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 25),
      }),
    );
  });
}
