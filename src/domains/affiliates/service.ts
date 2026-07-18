import { z } from "zod";
import { prisma } from "@/src/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { nanoid } from "nanoid";

export const affiliateEnrollSchema = z.object({
  clientId: z.string().min(1),
  code: z.string().min(3).optional(),
  commissionPercent: z.number().int().min(1).max(50).optional(),
});

export async function listAffiliates() {
  return prisma.affiliate.findMany({
    include: {
      client: true,
      referrals: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAffiliateByClientId(clientId: string) {
  return prisma.affiliate.findUnique({
    where: { clientId },
    include: {
      referrals: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getAffiliateByCode(code: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: code.toLowerCase() },
  });
  if (!affiliate || affiliate.status !== "ACTIVE") {
    throw new NotFoundError("Affiliate not found");
  }
  return affiliate;
}

export async function enrollAffiliate(
  data: z.infer<typeof affiliateEnrollSchema>,
  actorId?: string,
) {
  const existing = await prisma.affiliate.findUnique({
    where: { clientId: data.clientId },
  });
  if (existing) throw new ConflictError("Client is already an affiliate");

  const code = (data.code || `aff-${nanoid(8)}`).toLowerCase();
  const taken = await prisma.affiliate.findUnique({ where: { code } });
  if (taken) throw new ConflictError("Affiliate code already taken");

  const affiliate = await prisma.affiliate.create({
    data: {
      clientId: data.clientId,
      code,
      commissionPercent: data.commissionPercent ?? 10,
      status: "ACTIVE",
    },
  });
  await writeAuditLog({
    actorId,
    action: "affiliate.enroll",
    entityType: "affiliate",
    entityId: affiliate.id,
  });
  return affiliate;
}

export async function recordAffiliateCommission(input: {
  affiliateCode?: string | null;
  orderId: string;
  referredClientId: string;
  orderTotal: number;
}) {
  if (!input.affiliateCode) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: input.affiliateCode.toLowerCase() },
  });
  if (!affiliate || affiliate.status !== "ACTIVE") return null;
  if (affiliate.clientId === input.referredClientId) return null;

  const existing = await prisma.affiliateReferral.findFirst({
    where: { orderId: input.orderId },
  });
  if (existing) return existing;

  const commissionMinor = Math.round(
    (input.orderTotal * affiliate.commissionPercent) / 100,
  );

  const referral = await prisma.affiliateReferral.create({
    data: {
      affiliateId: affiliate.id,
      referredClientId: input.referredClientId,
      orderId: input.orderId,
      commissionMinor,
      status: "PENDING",
    },
  });

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { balanceMinor: { increment: commissionMinor } },
  });

  return referral;
}

export async function updateReferralStatus(
  id: string,
  status: "APPROVED" | "PAID" | "PENDING",
  actorId?: string,
) {
  const referral = await prisma.affiliateReferral.findUnique({ where: { id } });
  if (!referral) throw new NotFoundError("Referral not found");
  if (status === "PAID" && referral.status !== "APPROVED" && referral.status !== "PENDING") {
    throw new ValidationError("Invalid referral state for payment");
  }
  const updated = await prisma.affiliateReferral.update({
    where: { id },
    data: { status },
  });
  if (status === "PAID") {
    await prisma.affiliate.update({
      where: { id: referral.affiliateId },
      data: { balanceMinor: { decrement: referral.commissionMinor } },
    });
  }
  await writeAuditLog({
    actorId,
    action: "affiliate.referral_status",
    entityType: "affiliate_referral",
    entityId: id,
    metadata: { status },
  });
  return updated;
}
