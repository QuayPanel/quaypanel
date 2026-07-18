import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  createPlan,
  deleteProducts,
  getProduct,
  planCreateSchema,
  productSaveSchema,
  saveProduct,
} from "@/src/domains/products/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const { id } = await params;
    return jsonOk(await getProduct(id));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = productSaveSchema.partial().parse(await request.json());
    return jsonOk(await saveProduct(id, body, ctx.userId));
  });
}

export async function POST(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = planCreateSchema
      .omit({ productId: true })
      .parse(await request.json());
    return jsonOk(
      await createPlan({ ...body, productId: id }, ctx.userId),
      { status: 201 },
    );
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteProducts([id], ctx.userId));
  });
}
