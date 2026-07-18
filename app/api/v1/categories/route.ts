import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  categoryCreateSchema,
  createCategory,
  deleteCategories,
  listCategories,
} from "@/src/domains/categories/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listCategories());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = categoryCreateSchema.parse(await request.json());
    return jsonOk(await createCategory(body, ctx.userId), { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = z
      .object({ ids: z.array(z.union([z.string(), z.number()])).min(1) })
      .parse(await request.json());
    return jsonOk(await deleteCategories(body.ids, ctx.userId));
  });
}
