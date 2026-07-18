import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  categoryCreateSchema,
  deleteCategories,
  getCategory,
  updateCategory,
} from "@/src/domains/categories/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await getCategory(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = categoryCreateSchema.partial().parse(await request.json());
    return jsonOk(await updateCategory(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteCategories([id], ctx.userId));
  });
}
