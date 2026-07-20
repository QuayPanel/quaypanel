import { z } from "zod";
import { prisma } from "@/src/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { getSetting } from "@/src/domains/settings/service";
import { enqueueEmail } from "@/src/core/queue";
import { formatMoney } from "@/src/core/utils";
import { nanoid } from "nanoid";

export type AffiliateMilestone = { referrals: number; percent: number };

export const affiliateEnrollSchema = z.object({
  clientId: z.string().min(1),
  code: z.string().min(3).optional(),
  commissionPercent: z.number().int().min(1).max(50).optional(),
});

export const affiliateUpdateCodeSchema = z.object({
  code: z.string().min(3).max(32),
});

const AFFILIATE_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeAffiliateCode(raw: string) {
  return raw.trim().toLowerCase();
}

export function assertValidAffiliateCode(code: string) {
  if (code.length < 3 || code.length > 32) {
    throw new ValidationError("Code must be 3–32 characters");
  }
  if (!AFFILIATE_CODE_RE.test(code)) {
    throw new ValidationError(
      "Code may only use lowercase letters, numbers, and hyphens",
    );
  }
  if (code.includes("--") || code.startsWith("-") || code.endsWith("-")) {
    throw new ValidationError("Code cannot start/end with or repeat hyphens");
  }
}

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

  const code = normalizeAffiliateCode(data.code || `aff-${nanoid(8)}`);
  if (data.code) assertValidAffiliateCode(code);
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

export async function updateAffiliateCode(
  clientId: string,
  rawCode: string,
  actorId?: string,
) {
  if (!(await isAffiliatesEnabled())) {
    throw new ValidationError("Affiliate system is disabled");
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { clientId } });
  if (!affiliate) throw new NotFoundError("Affiliate not found");
  if (affiliate.status !== "ACTIVE") {
    throw new ValidationError("Affiliate account is not active");
  }

  const code = normalizeAffiliateCode(rawCode);
  assertValidAffiliateCode(code);

  if (code === affiliate.code) {
    return affiliate;
  }

  const taken = await prisma.affiliate.findUnique({ where: { code } });
  if (taken) throw new ConflictError("Affiliate code already taken");

  const updated = await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { code },
  });

  await writeAuditLog({
    actorId,
    action: "affiliate.code_update",
    entityType: "affiliate",
    entityId: affiliate.id,
    metadata: { from: affiliate.code, to: code },
  });

  return updated;
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

function affiliateEmailDomain(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).toLowerCase();
}

async function flagAffiliateDomainMismatch(
  affiliateId: string,
  referredClientId: string,
) {
  const [affiliate, referred] = await Promise.all([
    prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: { client: true },
    }),
    prisma.client.findUnique({ where: { id: referredClientId } }),
  ]);
  if (!affiliate || !referred) return;

  const affiliateDomain = affiliateEmailDomain(affiliate.client.email);
  const referredDomain = affiliateEmailDomain(referred.email);
  if (!affiliateDomain || affiliateDomain === referredDomain) return;

  const flags = Array.isArray(referred.riskFlags)
    ? [...(referred.riskFlags as string[])]
    : [];
  const flag = `affiliate_domain_mismatch:${affiliateDomain}`;
  if (flags.includes(flag)) return;

  flags.push(flag);
  await prisma.client.update({
    where: { id: referredClientId },
    data: { riskFlags: flags as object },
  });
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

  await flagAffiliateDomainMismatch(
    affiliate.id,
    input.referredClientId,
  ).catch(() => undefined);

  return referral;
}

export const affiliatePayoutRequestSchema = z.object({
  amountMinor: z.number().int().positive(),
});

export async function requestAffiliatePayout(
  clientId: string,
  amountMinor: number,
) {
  const parsed = affiliatePayoutRequestSchema.parse({ amountMinor });
  const affiliate = await getAffiliateByClientId(clientId);
  if (!affiliate) throw new NotFoundError("Affiliate account not found");
  if (affiliate.status !== "ACTIVE") {
    throw new ValidationError("Affiliate account is not active");
  }
  if (parsed.amountMinor > affiliate.balanceMinor) {
    throw new ValidationError("Insufficient affiliate balance");
  }

  const payout = await prisma.$transaction(async (tx) => {
    const updatedAffiliate = await tx.affiliate.update({
      where: { id: affiliate.id },
      data: { balanceMinor: { decrement: parsed.amountMinor } },
    });
    if (updatedAffiliate.balanceMinor < 0) {
      throw new ValidationError("Insufficient affiliate balance");
    }
    return tx.affiliatePayout.create({
      data: {
        affiliateId: affiliate.id,
        clientId,
        amountMinor: parsed.amountMinor,
        status: "PENDING",
      },
      include: { client: true, affiliate: true },
    });
  });

  return payout;
}

export async function listAffiliatePayouts(status?: string) {
  const where =
    status && status !== "all"
      ? { status: status as "PENDING" | "APPROVED" | "PAID" | "REJECTED" }
      : undefined;
  return prisma.affiliatePayout.findMany({
    where,
    include: {
      client: { select: { name: true, email: true } },
      affiliate: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateAffiliatePayoutStatus(
  id: string,
  status: "APPROVED" | "PAID" | "REJECTED",
  actorId?: string,
  note?: string,
) {
  const payout = await prisma.affiliatePayout.findUnique({ where: { id } });
  if (!payout) throw new NotFoundError("Payout not found");

  if (status === "REJECTED") {
    if (payout.status !== "PENDING") {
      throw new ValidationError("Only pending payouts can be rejected");
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.affiliate.update({
        where: { id: payout.affiliateId },
        data: { balanceMinor: { increment: payout.amountMinor } },
      });
      return tx.affiliatePayout.update({
        where: { id },
        data: { status: "REJECTED", note: note ?? null },
      });
    });
    await writeAuditLog({
      actorId,
      action: "affiliate.payout.reject",
      entityType: "affiliate_payout",
      entityId: id,
    });
    return updated;
  }

  if (status === "APPROVED") {
    if (payout.status !== "PENDING") {
      throw new ValidationError("Only pending payouts can be approved");
    }
    const updated = await prisma.affiliatePayout.update({
      where: { id },
      data: { status: "APPROVED", note: note ?? payout.note },
    });
    await writeAuditLog({
      actorId,
      action: "affiliate.payout.approve",
      entityType: "affiliate_payout",
      entityId: id,
    });
    return updated;
  }

  if (payout.status !== "APPROVED" && payout.status !== "PENDING") {
    throw new ValidationError("Invalid payout state for payment");
  }
  const updated = await prisma.affiliatePayout.update({
    where: { id },
    data: { status: "PAID", note: note ?? payout.note },
    include: { client: true },
  });
  await writeAuditLog({
    actorId,
    action: "affiliate.payout.paid",
    entityType: "affiliate_payout",
    entityId: id,
  });
  await notifyAffiliatePayout({
    clientEmail: updated.client.email,
    clientName: updated.client.name,
    amountMinor: updated.amountMinor,
    status: "PAID",
    note: updated.note,
  }).catch(() => undefined);
  return updated;
}

export async function notifyAffiliatePayout(input: {
  clientEmail: string;
  clientName: string;
  amountMinor: number;
  currency?: string;
  status: string;
  note?: string | null;
}) {
  const currency = input.currency ?? String(await getSetting("currency", "USD"));
  await enqueueEmail({
    to: input.clientEmail,
    subject: "Affiliate payout processed",
    template: "affiliate_payout",
    payload: {
      clientName: input.clientName,
      amount: formatMoney(input.amountMinor, currency),
      status: input.status,
      note: input.note ? String(input.note) : "",
    },
  }).catch(() => undefined);
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
