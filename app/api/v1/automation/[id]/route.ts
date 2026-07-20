import { withApi, jsonOk } from "@/src/core/api";
import { requirePermission } from "@/src/auth/session";
import {
  automationRuleSchema,
  deleteAutomationRule,
  getAutomationRule,
  updateAutomationRule,
} from "@/src/domains/automation/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    await requirePermission(auth, "automation");
    const { id } = await params;
    return jsonOk(await getAutomationRule(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "automation");
    const { id } = await params;
    const body = automationRuleSchema.partial().parse(await request.json());
    return jsonOk(await updateAutomationRule(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "automation");
    const { id } = await params;
    return jsonOk(await deleteAutomationRule(id, ctx.userId));
  });
}
