import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { testProxmoxConnection } from "@/src/domains/providers/service";
import { z } from "zod";

const schema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const body = schema.parse(await request.json().catch(() => ({})));
    return jsonOk(await testProxmoxConnection(body));
  });
}
