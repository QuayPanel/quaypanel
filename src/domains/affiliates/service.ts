import { z } from "zod";
import { prisma } from "@/src/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { getSetting } from "@/src/domains/settings/service";
import { nanoid } from "nanoid";

export type AffiliateMilestone = { referrals: number; percent: number };

export const affiliateEnrollSchema = z.object({
  clientId: z.string().min(1),
  code: z.string().min(3).optional(),
  commissionPercent: z.number().int().min(1).max(50).optional(),
});

export async function isAffiliatesEnabled() {
  return Boolean(await getSetting("affiliates.enabled", true));
}

function parseMilestones(raw: unknown): AffiliateMilestone[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      referrals: Number((row as AffiliateMilestone).referrals),
      percent: Number((row as AffiliateMilestone).percent),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.referrals) &&
        row.referrals >= 1 &&
        Number.isFinite(row.percent) &&
        row.percent >= 0 &&
        row.percent <= 100,
    )
    .sort((a, b) => a.referrals - b.referrals);
}

/** Unique referred clients, treating the current client as already counted when new. */
async function countReferralsForScaling(
  affiliateId: string,
  referredClientId: string,
) {
  const rows = await prisma.affiliateReferral.findMany({
    where: { affiliateId, referredClientId: { not: null } },
    select: { referredClientId: true },
    distinct: ["referredClientId"],
  });
  const ids = new Set(
    rows
      .map((r) => r.referredClientId)
      .filter((id): id is string => Boolean(id)),
  );
  ids.add(referredClientId);
  return ids.size;
}

async function resolveCommissionPercent(
  affiliatePercent: number,
  affiliateId: string,
  referredClientId: string,
) {
  const scalingEnabled = Boolean(
    await getSetting("affiliates.scalingEnabled", false),
  );
  if (!scalingEnabled) return affiliatePercent;

  const defaultPercent = Number(
    await getSetting("affiliates.defaultCommission", 10),
  );
  const milestones = parseMilestones(
    await getSetting("affiliates.scalingMilestones", []),
  );
  const count = await countReferralsForScaling(affiliateId, referredClientId);

  let percent = Number.isFinite(defaultPercent)
    ? defaultPercent
    : affiliatePercent;
  for (const milestone of milestones) {
    if (count >= milestone.referrals) percent = milestone.percent;
  }
  return percent;
}

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
  if (!(await isAffiliatesEnabled())) {
    throw new NotFoundError("Affiliate not found");
  }
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
  if (!(await isAffiliatesEnabled())) {
    throw new ValidationError("Affiliate system is disabled");
  }

  const existing = await prisma.affiliate.findUnique({
    where: { clientId: data.clientId },
  });
  if (existing) throw new ConflictError("Client is already an affiliate");

  const code = (data.code || `aff-${nanoid(8)}`).toLowerCase();
  const taken = await prisma.affiliate.findUnique({ where: { code } });
  if (taken) throw new ConflictError("Affiliate code already taken");

  const defaultPercent = Number(
    await getSetting("affiliates.defaultCommission", 10),
  );

  const affiliate = await prisma.affiliate.create({
    data: {
      clientId: data.clientId,
      code,
      commissionPercent: data.commissionPercent ?? defaultPercent,
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

export async function resolveAffiliateCodeForService(serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { orderItem: { include: { order: true } } },
  });
  return service?.orderItem?.order?.affiliateCode ?? null;
}

export async function resolveAffiliateCodeForClient(clientId: string) {
  const referral = await prisma.affiliateReferral.findFirst({
    where: { referredClientId: clientId },
    include: { affiliate: true },
    orderBy: { createdAt: "asc" },
  });
  if (!referral?.affiliate || referral.affiliate.status !== "ACTIVE") {
    return null;
  }
  return referral.affiliate.code;
}

export async function recordAffiliateCommission(input: {
  affiliateCode?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  referredClientId: string;
  orderTotal: number;
}) {
  if (!(await isAffiliatesEnabled())) return null;
  if (!input.affiliateCode) return null;

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: input.affiliateCode.toLowerCase() },
  });
  if (!affiliate || affiliate.status !== "ACTIVE") return null;
  if (affiliate.clientId === input.referredClientId) return null;

  if (input.invoiceId) {
    const byInvoice = await prisma.affiliateReferral.findFirst({
      where: { invoiceId: input.invoiceId },
    });
    if (byInvoice) return byInvoice;
  }
  // Initial orders pass orderId; renewals should omit it so repeats are allowed.
  if (input.orderId) {
    const byOrder = await prisma.affiliateReferral.findFirst({
      where: { orderId: input.orderId },
    });
    if (byOrder) return byOrder;
  }

  const percent = await resolveCommissionPercent(
    affiliate.commissionPercent,
    affiliate.id,
    input.referredClientId,
  );
  const commissionMinor = Math.round((input.orderTotal * percent) / 100);
  if (commissionMinor <= 0) return null;

  const referral = await prisma.affiliateReferral.create({
    data: {
      affiliateId: affiliate.id,
      referredClientId: input.referredClientId,
      orderId: input.orderId ?? undefined,
      invoiceId: input.invoiceId ?? undefined,
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
  if (
    status === "PAID" &&
    referral.status !== "APPROVED" &&
    referral.status !== "PENDING"
  ) {
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
