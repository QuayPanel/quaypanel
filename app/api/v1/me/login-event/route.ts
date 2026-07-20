import { withApi, jsonOk } from "@/src/core/api";
import { requireAuth } from "@/src/auth/session";
import { recordLoginEvent } from "@/src/domains/fraud/service";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");

    const event = await recordLoginEvent({
      userId: ctx.userId,
      ipAddress: ip,
      userAgent,
      success: true,
    });

    return jsonOk(event, { status: 201 });
  });
}
