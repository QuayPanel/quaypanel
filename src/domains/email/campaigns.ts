import { z } from "zod";
import { prisma } from "@/src/db/client";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import {
  massMailSchema,
  sendMassMail,
} from "@/src/domains/email/service";

export const audienceFilterSchema = z.enum([
  "all",
  "productId",
  "overdue",
  "activeServices",
]);

export const emailCampaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  filter: audienceFilterSchema.default("all"),
  productId: z.string().optional().nullable(),
});

export const emailCampaignUpdateSchema = emailCampaignCreateSchema.partial();

export async function listEmailCampaigns() {
  return prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmailCampaign(id: string) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function createEmailCampaign(
  data: z.infer<typeof emailCampaignCreateSchema>,
  actorId?: string,
) {
  const parsed = emailCampaignCreateSchema.parse(data);
  if (parsed.filter === "productId" && !parsed.productId?.trim()) {
    throw new ValidationError("Product ID is required for that audience");
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: parsed.name.trim(),
      subject: parsed.subject.trim(),
      body: parsed.body,
      filter: parsed.filter,
      productId:
        parsed.filter === "productId" ? parsed.productId?.trim() || null : null,
      status: "DRAFT",
    },
  });

  await writeAuditLog({
    actorId,
    action: "email_campaign.create",
    entityType: "email_campaign",
    entityId: campaign.id,
  });

  return campaign;
}

export async function updateEmailCampaign(
  id: string,
  data: z.infer<typeof emailCampaignUpdateSchema>,
  actorId?: string,
) {
  const existing = await getEmailCampaign(id);
  if (existing.status === "SENDING") {
    throw new ConflictError("Campaign is currently sending");
  }
  if (existing.status === "SENT") {
    throw new ConflictError("Sent campaigns cannot be edited — duplicate instead");
  }

  const parsed = emailCampaignUpdateSchema.parse(data);
  const filter = parsed.filter ?? existing.filter;
  const productId =
    filter === "productId"
      ? (parsed.productId !== undefined
          ? parsed.productId?.trim() || null
          : existing.productId)
      : null;

  if (filter === "productId" && !productId) {
    throw new ValidationError("Product ID is required for that audience");
  }

  const campaign = await prisma.emailCampaign.update({
    where: { id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
      ...(parsed.subject !== undefined
        ? { subject: parsed.subject.trim() }
        : {}),
      ...(parsed.body !== undefined ? { body: parsed.body } : {}),
      ...(parsed.filter !== undefined ? { filter: parsed.filter } : {}),
      productId,
      status: "DRAFT",
      failedCount: 0,
      sentCount: 0,
      recipientCount: 0,
      sentAt: null,
    },
  });

  await writeAuditLog({
    actorId,
    action: "email_campaign.update",
    entityType: "email_campaign",
    entityId: campaign.id,
  });

  return campaign;
}

export async function deleteEmailCampaign(id: string, actorId?: string) {
  const existing = await getEmailCampaign(id);
  if (existing.status === "SENDING") {
    throw new ConflictError("Cannot delete a campaign while it is sending");
  }
  await prisma.emailCampaign.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "email_campaign.delete",
    entityType: "email_campaign",
    entityId: id,
  });
  return { ok: true };
}

export async function duplicateEmailCampaign(id: string, actorId?: string) {
  const existing = await getEmailCampaign(id);
  return createEmailCampaign(
    {
      name: `${existing.name} (copy)`,
      subject: existing.subject,
      body: existing.body,
      filter: audienceFilterSchema.parse(existing.filter),
      productId: existing.productId,
    },
    actorId,
  );
}

export async function sendEmailCampaign(id: string, actorId?: string) {
  const campaign = await getEmailCampaign(id);
  if (campaign.status === "SENDING") {
    throw new ConflictError("Campaign is already sending");
  }
  if (campaign.status === "SENT") {
    throw new ConflictError("Campaign was already sent — duplicate to send again");
  }

  const payload = massMailSchema.parse({
    filter: campaign.filter,
    productId: campaign.productId ?? undefined,
    subject: campaign.subject,
    body: campaign.body,
  });

  await prisma.emailCampaign.update({
    where: { id },
    data: { status: "SENDING" },
  });

  try {
    const result = await sendMassMail(payload, actorId);
    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: result.failed > 0 && result.sent === 0 ? "FAILED" : "SENT",
        recipientCount: result.recipients,
        sentCount: result.sent,
        failedCount: result.failed,
        sentAt: new Date(),
      },
    });

    await writeAuditLog({
      actorId,
      action: "email_campaign.send",
      entityType: "email_campaign",
      entityId: id,
      metadata: result,
    });

    return updated;
  } catch (err) {
    await prisma.emailCampaign
      .update({
        where: { id },
        data: { status: "FAILED" },
      })
      .catch(() => undefined);
    throw err;
  }
}
