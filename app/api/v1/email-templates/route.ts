import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { ValidationError } from "@/src/core/errors";
import {
  emailTemplateUpdateSchema,
  listEmailTemplates,
  resetEmailTemplate,
  sendTestEmailTemplate,
  updateEmailTemplate,
} from "@/src/domains/email/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listEmailTemplates());
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = z
      .object({
        id: z.string().optional(),
        key: z.string().optional(),
        reset: z.boolean().optional(),
        test: z.boolean().optional(),
        testTo: z.string().email().optional(),
      })
      .and(emailTemplateUpdateSchema.partial())
      .parse(await request.json());

    const idOrKey = body.id || body.key;
    if (!idOrKey) {
      throw new ValidationError("id or key is required");
    }

    if (body.reset) {
      return jsonOk(await resetEmailTemplate(idOrKey));
    }
    if (body.test) {
      const to = body.testTo || ctx.email;
      return jsonOk(await sendTestEmailTemplate(idOrKey, to));
    }

    const updated = await updateEmailTemplate(idOrKey, body);
    return jsonOk(updated);
  });
}
