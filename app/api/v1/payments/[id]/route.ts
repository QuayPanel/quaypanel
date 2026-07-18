import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  deletePayment,
  getPayment,
  paymentUpdateSchema,
  updatePayment,
} from "@/src/domains/payments/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await getPayment(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = paymentUpdateSchema.parse(await request.json());
    return jsonOk(await updatePayment(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deletePayment(id, ctx.userId));
  });
}
