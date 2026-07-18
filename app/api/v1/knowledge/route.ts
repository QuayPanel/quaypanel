import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  createKnowledgeArticle,
  knowledgeArticleSchema,
  listKnowledgeArticles,
} from "@/src/domains/knowledge/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const params = new URL(req.url).searchParams;
    const publishedOnly = params.get("public") === "1";
    const q = params.get("q") ?? undefined;
    if (!publishedOnly) requireStaff(auth);
    return jsonOk(await listKnowledgeArticles({ publishedOnly, q }));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = knowledgeArticleSchema.parse(await request.json());
    return jsonOk(await createKnowledgeArticle(body, ctx.userId));
  });
}
