import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { listPendingReviewOrders } from "@/src/domains/fraud/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listPendingReviewOrders());
  });
}
