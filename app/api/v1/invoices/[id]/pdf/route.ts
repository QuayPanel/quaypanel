import { withApi } from "@/src/core/api";
import {
  requireAuth,
  requireStaff,
  useOwnClientScope,
} from "@/src/auth/session";
import { getInvoice } from "@/src/domains/invoices/service";
import { buildInvoicePdf } from "@/src/domains/invoices/pdf";
import { ForbiddenError } from "@/src/core/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireAuth(auth);
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (useOwnClientScope(ctx, request)) {
      if (invoice.clientId !== ctx.clientId) throw new ForbiddenError();
    } else {
      requireStaff(auth);
    }

    const pdf = await buildInvoicePdf(invoice);
    const filename = `invoice-${invoice.number.replace(/[^\w.-]+/g, "_")}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
