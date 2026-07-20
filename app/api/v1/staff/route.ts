import { withApi, jsonOk } from "@/src/core/api";
import { requireAdmin } from "@/src/auth/session";
import {
  listStaffUsers,
  staffUserPayload,
} from "@/src/domains/users/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireAdmin(auth);
    const users = await listStaffUsers();
    return jsonOk(users.map(staffUserPayload));
  });
}
