import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
  requirePermission,
} from "@/src/auth/session";
import { listInvoices, createCustomInvoice, createCustomInvoiceSchema } from "@/src/domains/invoices/service";
import { dollarsToMinor } from "@/src/core/utils";
import { z } from "zod";

const customInvoiceBodySchema = createCustomInvoiceSchema.extend({
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive().default(1),
      unitPrice: z.number(),
      total: z.number().optional(),
    }),
  ),
});

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) return jsonOk([]);
      return jsonOk(await listInvoices(ctx.clientId));
    }
    requireStaff(auth);
    return jsonOk(await listInvoices());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = await requirePermission(auth, "billing");
    const body = customInvoiceBodySchema.parse(await request.json());
    const invoice = await createCustomInvoice({
      clientId: body.clientId,
      currency: body.currency,
      note: body.note,
      dueDays: body.dueDays,
      items: body.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: dollarsToMinor(item.unitPrice),
        total: item.total != null ? dollarsToMinor(item.total) : undefined,
      })),
      actorId: ctx.userId,
    });
    return jsonOk(invoice, { status: 201 });
  });
}
