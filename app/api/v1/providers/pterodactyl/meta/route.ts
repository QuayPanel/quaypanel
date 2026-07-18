import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { getPterodactylMeta } from "@/src/domains/providers/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    requireStaff(auth);
    const url = new URL(req.url);
    const includeRaw = url.searchParams.get("include") ?? "";
    const include = includeRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const nestIdRaw = url.searchParams.get("nestId");
    const nestId = nestIdRaw ? Number(nestIdRaw) : undefined;
    return jsonOk(
      await getPterodactylMeta({
        include: include.length ? include : undefined,
        nestId:
          nestId != null && Number.isFinite(nestId) && nestId > 0
            ? nestId
            : undefined,
      }),
    );
  });
}
