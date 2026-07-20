import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  createEmailCampaign,
  emailCampaignCreateSchema,
  listEmailCampaigns,
} from "@/src/domains/email/campaigns";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listEmailCampaigns());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = emailCampaignCreateSchema.parse(await request.json());
    return jsonOk(await createEmailCampaign(body, ctx.userId), {
      status: 201,
    });
  });
}
