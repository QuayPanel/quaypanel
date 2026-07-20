import { withApi, jsonOk } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import {
  deleteInvoice,
  getInvoice,
  canAccessInvoiceAsClient,
  canPayInvoiceAsClient,
  invoiceUpdateSchema,
  updateInvoice,
  voidInvoice,
} from "@/src/domains/invoices/service";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (useOwnClientScope(ctx, request)) {
      if (!ctx.clientId) throw new ForbiddenError();
      const allowed = await canAccessInvoiceAsClient(ctx.clientId, invoice);
      if (!allowed) throw new ForbiddenError();
    } else {
      requireStaff(auth);
    }
    return jsonOk(invoice);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = invoiceUpdateSchema.parse(await request.json());
    return jsonOk(await updateInvoice(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (invoice.status === "VOID") {
      return jsonOk(await deleteInvoice(id, ctx.userId));
    }
    return jsonOk(await voidInvoice(id, ctx.userId));
  });
}
