import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { ValidationError } from "@/src/core/errors";
import {
  legalPageUpdateSchema,
  listLegalPages,
  updateLegalPage,
} from "@/src/domains/legal/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listLegalPages(true));
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const ctx = requireStaff(auth);
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) throw new ValidationError("Missing slug");
    const body = legalPageUpdateSchema.parse(await req.json());
    return jsonOk(await updateLegalPage(slug, body, ctx.userId));
  });
}
