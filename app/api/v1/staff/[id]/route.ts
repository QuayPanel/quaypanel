import { withApi, jsonOk } from "@/src/core/api";
import { requireAdmin } from "@/src/auth/session";
import {
  staffPermissionsUpdateSchema,
  updateStaffPermissions,
} from "@/src/domains/users/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAdmin(auth);
    const { id } = await params;
    const body = staffPermissionsUpdateSchema.parse(await request.json());
    return jsonOk(
      await updateStaffPermissions(id, body.permissions, ctx.userId),
    );
  });
}
