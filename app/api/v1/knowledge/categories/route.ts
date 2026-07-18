import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  createKnowledgeCategory,
  knowledgeCategorySchema,
  listKnowledgeCategories,
} from "@/src/domains/knowledge/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const publishedOnly = new URL(req.url).searchParams.get("public") === "1";
    if (!publishedOnly) requireStaff(auth);
    return jsonOk(await listKnowledgeCategories());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = knowledgeCategorySchema.parse(await request.json());
    return jsonOk(await createKnowledgeCategory(body, ctx.userId));
  });
}
