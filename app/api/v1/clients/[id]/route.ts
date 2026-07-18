import { withApi, jsonOk } from "@/src/core/api";
import { requireAdmin, requireStaff } from "@/src/auth/session";
import {
  clientUpdateSchema,
  deleteClient,
  getClient,
  updateClient,
} from "@/src/domains/clients/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await getClient(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const { id } = await params;
    const body = clientUpdateSchema.parse(await request.json());
    const ctx =
      body.isAdmin !== undefined ? requireAdmin(auth) : requireStaff(auth);
    return jsonOk(await updateClient(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteClient(id, ctx.userId));
  });
}
