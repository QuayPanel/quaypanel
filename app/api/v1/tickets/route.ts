import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  createTicket,
  listTickets,
  ticketCreateSchema,
} from "@/src/domains/tickets/service";
import { ForbiddenError } from "@/src/core/errors";
import { getSetting } from "@/src/domains/settings/service";

async function assertTicketsEnabled() {
  const enabled = Boolean(await getSetting("tickets.enabled", true));
  if (!enabled) throw new ForbiddenError("Tickets are disabled");
}

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    await assertTicketsEnabled();
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk([]);
      return jsonOk(await listTickets(ctx.clientId));
    }
    requireStaff(auth);
    return jsonOk(await listTickets());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    await assertTicketsEnabled();
    const ctx = requireAuth(auth);
    const body = ticketCreateSchema.parse(await request.json());
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId || body.clientId !== ctx.clientId) {
        throw new ForbiddenError();
      }
    } else {
      requireStaff(auth);
    }
    return jsonOk(await createTicket(body, ctx.userId), { status: 201 });
  });
}
