import { withApi, jsonOk } from "@/src/core/api";
import { requirePermission } from "@/src/auth/session";
import {
  automationRuleSchema,
  createAutomationRule,
  listAutomationRules,
} from "@/src/domains/automation/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    await requirePermission(auth, "automation");
    return jsonOk(await listAutomationRules());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "automation");
    const body = automationRuleSchema.parse(await request.json());
    return jsonOk(await createAutomationRule(body, ctx.userId), { status: 201 });
  });
}
