import { z } from "zod";
import { prisma } from "@/src/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

export const couponCreateSchema = z.object({
  code: z.string().min(2).transform((v) => v.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  maxUses: z.number().int().positive().optional().nullable(),
  maxUsesPerClient: z.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  active: z.boolean().optional(),
});

/** Resolve coupon by public number (`1`) or internal cuid. */
export async function resolveCouponId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (/^\d+$/.test(raw)) {
    const coupon = await prisma.coupon.findUnique({
      where: { number: Number(raw) },
    });
    if (!coupon) throw new NotFoundError("Coupon not found");
    return coupon.id;
  }
  return raw;
}

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: [{ number: "asc" }] });
}

export async function getCoupon(idOrNumber: string | number) {
  const id = await resolveCouponId(idOrNumber);
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new NotFoundError("Coupon not found");
  return coupon;
}

export async function getCouponByCode(code: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!coupon) throw new NotFoundError("Coupon not found");
  return coupon;
}

export async function validateCoupon(code: string, clientId?: string) {
  const coupon = await getCouponByCode(code);
  if (!coupon.active) throw new ValidationError("Coupon is inactive");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new ValidationError("Coupon has expired");
  }
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) {
    throw new ValidationError("Coupon global usage limit reached");
  }
  if (coupon.maxUsesPerClient != null) {
    if (!clientId) {
      throw new ValidationError("Client required to validate coupon");
    }
    const clientUses = await prisma.order.count({
      where: {
        clientId,
        couponId: coupon.id,
        status: { in: ["PENDING", "COMPLETED"] },
      },
    });
    if (clientUses >= coupon.maxUsesPerClient) {
      throw new ValidationError("Coupon per-client usage limit reached");
    }
  }
  if (coupon.type === "PERCENT" && coupon.value > 100) {
    throw new ValidationError("Invalid percent coupon");
  }
  return coupon;
}

export async function createCoupon(
  data: z.infer<typeof couponCreateSchema>,
  actorId?: string,
) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (existing) throw new ConflictError("Coupon code already exists");
  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      type: data.type,
      value: data.value,
      maxUses: data.maxUses ?? null,
      maxUsesPerClient: data.maxUsesPerClient ?? null,
      expiresAt: data.expiresAt ?? null,
      active: data.active ?? true,
    },
  });
  await writeAuditLog({
    actorId,
    action: "coupon.create",
    entityType: "coupon",
    entityId: coupon.id,
    metadata: { number: coupon.number },
  });
  return coupon;
}

export async function updateCoupon(
  idOrNumber: string | number,
  data: Partial<z.infer<typeof couponCreateSchema>>,
  actorId?: string,
) {
  const id = await resolveCouponId(idOrNumber);
  await getCoupon(id);
  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code: data.code,
      type: data.type,
      value: data.value,
      maxUses: data.maxUses === undefined ? undefined : data.maxUses,
      maxUsesPerClient:
        data.maxUsesPerClient === undefined
          ? undefined
          : data.maxUsesPerClient,
      expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt,
      active: data.active,
    },
  });
  await writeAuditLog({
    actorId,
    action: "coupon.update",
    entityType: "coupon",
    entityId: coupon.id,
  });
  return coupon;
}

export async function incrementCouponUses(id: string) {
  await prisma.coupon.update({
    where: { id },
    data: { uses: { increment: 1 } },
  });
}

export async function deleteCoupons(
  idsOrNumbers: Array<string | number>,
  actorId?: string,
) {
  const ids: string[] = [];
  for (const value of idsOrNumbers) {
    ids.push(await resolveCouponId(value));
  }
  if (ids.length === 0) return { count: 0 };
  await prisma.order.updateMany({
    where: { couponId: { in: ids } },
    data: { couponId: null },
  });
  await prisma.invoice.updateMany({
    where: { couponId: { in: ids } },
    data: { couponId: null },
  });
  const result = await prisma.coupon.deleteMany({
    where: { id: { in: ids } },
  });
  await writeAuditLog({
    actorId,
    action: "coupon.delete",
    entityType: "coupon",
    metadata: { ids },
  });
  return result;
}
