import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  deleteKnowledgeCategory,
  knowledgeCategorySchema,
  updateKnowledgeCategory,
} from "@/src/domains/knowledge/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return withApi(request, async ({ auth }) => {
    const staff = requireStaff(auth);
    const { id } = await ctx.params;
    const body = knowledgeCategorySchema.partial().parse(await request.json());
    return jsonOk(await updateKnowledgeCategory(id, body, staff.userId));
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withApi(request, async ({ auth }) => {
    const staff = requireStaff(auth);
    const { id } = await ctx.params;
    return jsonOk(await deleteKnowledgeCategory(id, staff.userId));
  });
}
