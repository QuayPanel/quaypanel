import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  deleteEmailCampaign,
  duplicateEmailCampaign,
  emailCampaignUpdateSchema,
  getEmailCampaign,
  sendEmailCampaign,
  updateEmailCampaign,
} from "@/src/domains/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await getEmailCampaign(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = emailCampaignUpdateSchema.parse(await request.json());
    return jsonOk(await updateEmailCampaign(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteEmailCampaign(id, ctx.userId));
  });
}

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const action = String((json as { action?: string }).action ?? "send");

    if (action === "duplicate") {
      return jsonOk(await duplicateEmailCampaign(id, ctx.userId), {
        status: 201,
      });
    }
    if (action === "send") {
      return jsonOk(await sendEmailCampaign(id, ctx.userId));
    }

    return jsonOk(await sendEmailCampaign(id, ctx.userId));
  });
}
