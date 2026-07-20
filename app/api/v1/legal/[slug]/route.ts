import { withApi, jsonOk } from "@/src/core/api";
import { getLegalPageBySlug } from "@/src/domains/legal/service";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withApi(_request, async () => {
    const { slug } = await params;
    return jsonOk(await getLegalPageBySlug(slug));
  });
}
