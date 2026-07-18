import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  couponCreateSchema,
  createCoupon,
  deleteCoupons,
  listCoupons,
} from "@/src/domains/coupons/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listCoupons());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = couponCreateSchema.parse(await request.json());
    return jsonOk(await createCoupon(body, ctx.userId), { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = z
      .object({ ids: z.array(z.union([z.string(), z.number()])).min(1) })
      .parse(await request.json());
    return jsonOk(await deleteCoupons(body.ids, ctx.userId));
  });
}
