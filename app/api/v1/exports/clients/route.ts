import { withApi } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { exportClientsCsv } from "@/src/domains/reports/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const csv = await exportClientsCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="clients.csv"',
      },
    });
  });
}
