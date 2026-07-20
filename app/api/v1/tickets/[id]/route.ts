import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  getTicket,
  replyToTicket,
  ticketReplySchema,
  updateTicketStatus,
} from "@/src/domains/tickets/service";
import { ForbiddenError } from "@/src/core/errors";
import { z } from "zod";
import { requireCaptcha } from "@/src/core/captcha";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const ticket = await getTicket(id);
    if (useOwnClientScope(ctx, request)) {
      if (ticket.clientId !== ctx.clientId) throw new ForbiddenError();
    } else {
      requireStaff(auth);
    }
    return jsonOk(ticket);
  });
}

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const ticket = await getTicket(id);
    const asClient = useOwnClientScope(ctx, request);
    const isStaff = !asClient && (ctx.role === "ADMIN" || ctx.role === "STAFF");
    if (asClient) {
      if (ticket.clientId !== ctx.clientId) throw new ForbiddenError();
    } else if (!isStaff) {
      throw new ForbiddenError();
    }
    const json = (await request.json()) as Record<string, unknown>;
    if (asClient) {
      await requireCaptcha(
        typeof json.captchaToken === "string" ? json.captchaToken : undefined,
        request,
      );
    }
    const body = ticketReplySchema.parse(json);
    return jsonOk(await replyToTicket(id, ctx.userId, body.body, isStaff));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = z
      .object({
        status: z.enum(["OPEN", "PENDING", "ANSWERED", "CLOSED"]),
      })
      .parse(await request.json());
    return jsonOk(await updateTicketStatus(id, body.status, ctx.userId));
  });
}
