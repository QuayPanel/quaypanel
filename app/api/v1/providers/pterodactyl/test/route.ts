import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { testPterodactylConnection } from "@/src/domains/providers/service";
import { z } from "zod";

const testSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const body = testSchema.parse(await request.json());
    return jsonOk(await testPterodactylConnection(body));
  });
}
