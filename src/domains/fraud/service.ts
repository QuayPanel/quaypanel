import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { getSetting } from "@/src/domains/settings/service";
import { getOrder, resolveOrderId } from "@/src/domains/orders/service";
import { createServicesFromPaidOrder } from "@/src/domains/services/service";
import { recordAffiliateCommission } from "@/src/domains/affiliates/service";
import { isDisposableEmailDomain } from "@/src/domains/fraud/disposable-domains";

export const FRAUD_BLOCK_TYPES = ["ip", "country", "email_domain"] as const;
export type FraudBlockType = (typeof FRAUD_BLOCK_TYPES)[number];

export const fraudBlockCreateSchema = z.object({
  type: z.enum(FRAUD_BLOCK_TYPES),
  value: z.string().min(1),
  note: z.string().optional(),
});

export const clientRiskUpdateSchema = z.object({
  notes: z.string().nullable().optional(),
  riskFlags: z.array(z.string()).optional(),
  requireApproval: z.boolean().optional(),
});

export async function listFraudBlocks() {
  return prisma.fraudBlock.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createFraudBlock(
  data: z.infer<typeof fraudBlockCreateSchema>,
  actorId?: string,
) {
  const parsed = fraudBlockCreateSchema.parse(data);
  const value = normalizeBlockValue(parsed.type, parsed.value);

  const block = await prisma.fraudBlock.upsert({
    where: {
      type_value: { type: parsed.type, value },
    },
    create: {
      type: parsed.type,
      value,
      note: parsed.note,
      active: true,
    },
    update: {
      note: parsed.note,
      active: true,
    },
  });

  await writeAuditLog({
    actorId,
    action: "fraud.block.create",
    entityType: "fraud_block",
    entityId: block.id,
    metadata: { type: block.type, value: block.value },
  });

  return block;
}

export async function deleteFraudBlock(id: string, actorId?: string) {
  const existing = await prisma.fraudBlock.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Fraud block not found");

  await prisma.fraudBlock.update({
    where: { id },
    data: { active: false },
  });

  await writeAuditLog({
    actorId,
    action: "fraud.block.delete",
    entityType: "fraud_block",
    entityId: id,
  });

  return { ok: true };
}

function normalizeBlockValue(type: FraudBlockType, value: string) {
  const trimmed = value.trim();
  if (type === "email_domain") {
    return trimmed.replace(/^@/, "").toLowerCase();
  }
  if (type === "country") {
    // Match profile country names (case-insensitive compare uses uppercase).
    return trimmed;
  }
  return trimmed;
}

function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).toLowerCase();
}

export type ClientBlockedResult = {
  blocked: boolean;
  reasons: string[];
};

export async function checkClientBlocked(params: {
  email: string;
  ip?: string | null;
  country?: string | null;
}): Promise<ClientBlockedResult> {
  const reasons: string[] = [];
  const domain = emailDomain(params.email);

  const blockDisposable = Boolean(
    await getSetting("fraud.blockDisposableEmails", true),
  );
  if (blockDisposable && domain && isDisposableEmailDomain(domain)) {
    reasons.push(`disposable_email:${domain}`);
  }

  const blocks = await prisma.fraudBlock.findMany({
    where: { active: true },
  });

  for (const block of blocks) {
    if (block.type === "ip" && params.ip && block.value === params.ip.trim()) {
      reasons.push(`ip:${block.value}`);
    }
    if (
      block.type === "country" &&
      params.country &&
      block.value.trim().toLowerCase() === params.country.trim().toLowerCase()
    ) {
      reasons.push(`country:${block.value}`);
    }
    if (
      block.type === "email_domain" &&
      domain &&
      block.value === domain
    ) {
      reasons.push(`email_domain:${block.value}`);
    }
  }

  return { blocked: reasons.length > 0, reasons };
}

export async function shouldRequireOrderReview(params: {
  clientId: string;
  email: string;
  ip?: string | null;
  country?: string | null;
}): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
  });
  if (!client) return false;

  if (client.requireApproval) return true;

  const requireReviewAll = Boolean(
    await getSetting("fraud.requireReviewAll", false),
  );
  if (requireReviewAll) return true;

  const blocked = await checkClientBlocked({
    email: params.email,
    ip: params.ip,
    country: params.country ?? client.country,
  });
  return blocked.blocked;
}

export async function listPendingReviewOrders() {
  return prisma.order.findMany({
    where: { reviewStatus: "PENDING_REVIEW" },
    include: {
      client: true,
      items: { include: { plan: { include: { product: true } } } },
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

async function provisionApprovedOrderIfPaid(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoices: true },
  });
  if (!order || order.status !== "COMPLETED") return;

  const paidInvoice = order.invoices.find(
    (inv) => inv.status === "PAID" && !inv.serviceId,
  );
  if (!paidInvoice) return;

  const existingServices = await prisma.service.count({
    where: { orderItem: { orderId } },
  });
  if (existingServices > 0) return;

  await createServicesFromPaidOrder(orderId);

  if (order.affiliateCode) {
    await recordAffiliateCommission({
      affiliateCode: order.affiliateCode,
      orderId: order.id,
      invoiceId: paidInvoice.id,
      referredClientId: order.clientId,
      orderTotal: paidInvoice.total,
    }).catch(() => undefined);
  }
}

export async function approveOrderReview(
  idOrNumber: string,
  actorId?: string,
  note?: string,
) {
  const id = await resolveOrderId(idOrNumber);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.reviewStatus !== "PENDING_REVIEW") {
    throw new ValidationError("Order is not pending review");
  }

  await prisma.order.update({
    where: { id },
    data: {
      reviewStatus: "APPROVED",
      reviewNote: note ?? order.reviewNote,
    },
  });

  await provisionApprovedOrderIfPaid(id);

  await writeAuditLog({
    actorId,
    action: "fraud.order.approve",
    entityType: "order",
    entityId: id,
    metadata: { note },
  });

  return getOrder(id);
}

export async function rejectOrderReview(
  idOrNumber: string,
  actorId?: string,
  note?: string,
) {
  const id = await resolveOrderId(idOrNumber);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.reviewStatus !== "PENDING_REVIEW") {
    throw new ValidationError("Order is not pending review");
  }

  await prisma.order.update({
    where: { id },
    data: {
      reviewStatus: "REJECTED",
      reviewNote: note ?? order.reviewNote,
    },
  });

  await writeAuditLog({
    actorId,
    action: "fraud.order.reject",
    entityType: "order",
    entityId: id,
    metadata: { note },
  });

  return getOrder(id);
}

export async function updateClientRisk(
  idOrNumber: string,
  data: z.infer<typeof clientRiskUpdateSchema>,
  actorId?: string,
) {
  const { resolveClientId } = await import("@/src/domains/clients/service");
  const id = await resolveClientId(idOrNumber);
  const parsed = clientRiskUpdateSchema.parse(data);

  const client = await prisma.client.update({
    where: { id },
    data: {
      notes: parsed.notes === undefined ? undefined : parsed.notes,
      riskFlags:
        parsed.riskFlags === undefined
          ? undefined
          : (parsed.riskFlags as object),
      requireApproval: parsed.requireApproval,
    },
  });

  await writeAuditLog({
    actorId,
    action: "client.risk.update",
    entityType: "client",
    entityId: id,
    metadata: parsed,
  });

  return client;
}

export async function recordLoginEvent(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
}) {
  return prisma.loginEvent.create({
    data: {
      userId: params.userId,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      success: params.success ?? true,
    },
  });
}

export async function listLoginEvents(userId: string, limit = 50) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  return prisma.loginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function revokeUserSessions(userId: string, actorId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  const result = await prisma.session.deleteMany({ where: { userId } });

  await writeAuditLog({
    actorId,
    action: "user.sessions.revoke",
    entityType: "user",
    entityId: userId,
    metadata: { count: result.count },
  });

  return { revoked: result.count };
}
