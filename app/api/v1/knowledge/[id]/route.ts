import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff, isStaffRole } from "@/src/auth/session";
import { NotFoundError } from "@/src/core/errors";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  knowledgeArticleSchema,
  updateKnowledgeArticle,
} from "@/src/domains/knowledge/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return withApi(request, async ({ auth }) => {
    const { id } = await ctx.params;
    const article = await getKnowledgeArticle(id);
    if (!article.published) {
      if (!auth || !isStaffRole(auth.role)) {
        throw new NotFoundError("Article not found");
      }
    }
    return jsonOk(article);
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return withApi(request, async ({ auth }) => {
    const staff = requireStaff(auth);
    const { id } = await ctx.params;
    const body = knowledgeArticleSchema.partial().parse(await request.json());
    return jsonOk(await updateKnowledgeArticle(id, body, staff.userId));
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withApi(request, async ({ auth }) => {
    const staff = requireStaff(auth);
    const { id } = await ctx.params;
    return jsonOk(await deleteKnowledgeArticle(id, staff.userId));
  });
}
