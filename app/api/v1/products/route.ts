import { withApi, jsonOk } from "@/src/core/api";
import { requireAuth, requireStaff } from "@/src/auth/session";
import {
  createProduct,
  deleteProducts,
  listProducts,
  productSaveSchema,
  saveProduct,
} from "@/src/domains/products/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    requireAuth(auth);
    const activeOnly =
      new URL(req.url).searchParams.get("active") === "1" ||
      auth?.role === "CLIENT" ||
      req.headers.get("x-quay-portal") === "client";
    return jsonOk(await listProducts(activeOnly));
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = productSaveSchema.parse(await request.json());
    const created = await createProduct(body, ctx.userId);
    if (body.plans || body.upgradeProductIds) {
      return jsonOk(
        await saveProduct(
          created.number,
          {
            plans: body.plans,
            upgradeProductIds: body.upgradeProductIds,
          },
          ctx.userId,
        ),
        { status: 201 },
      );
    }
    return jsonOk(created, { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = z
      .object({ ids: z.array(z.union([z.string(), z.number()])).min(1) })
      .parse(await request.json());
    return jsonOk(await deleteProducts(body.ids, ctx.userId));
  });
}
