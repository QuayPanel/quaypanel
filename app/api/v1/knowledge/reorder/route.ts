import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  knowledgeReorderSchema,
  reorderKnowledgeItems,
} from "@/src/domains/knowledge/service";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = knowledgeReorderSchema.parse(await request.json());
    return jsonOk(await reorderKnowledgeItems(body, ctx.userId));
  });
}
