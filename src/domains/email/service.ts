import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  getEmailTemplateDefault,
} from "@/src/email/defaults";
import { ensureEmailTemplatesSeeded } from "@/src/email/render-template";

export const emailTemplateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  subject: z.string().min(1).optional(),
  bodyFormat: z.enum(["markdown", "html"]).optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

export async function listEmailTemplates() {
  await ensureEmailTemplatesSeeded();
  const rows = await prisma.emailTemplate.findMany({
    orderBy: { key: "asc" },
  });
  return rows.map((row) => {
    const def = getEmailTemplateDefault(row.key);
    return {
      ...row,
      placeholders: def?.placeholders ?? [],
    };
  });
}

export async function getEmailTemplate(idOrKey: string) {
  await ensureEmailTemplatesSeeded();
  const row =
    (await prisma.emailTemplate.findUnique({ where: { key: idOrKey } })) ??
    (await prisma.emailTemplate.findUnique({ where: { id: idOrKey } }));
  if (!row) throw new NotFoundError("Email template not found");
  const def = getEmailTemplateDefault(row.key);
  return {
    ...row,
    placeholders: def?.placeholders ?? [],
  };
}

export async function updateEmailTemplate(
  idOrKey: string,
  data: z.infer<typeof emailTemplateUpdateSchema>,
) {
  const existing = await getEmailTemplate(idOrKey);
  const parsed = emailTemplateUpdateSchema.parse(data);
  return prisma.emailTemplate.update({
    where: { id: existing.id },
    data: {
      name: parsed.name,
      description: parsed.description,
      subject: parsed.subject,
      bodyFormat: parsed.bodyFormat,
      body: parsed.body,
      enabled: parsed.enabled,
    },
  });
}

export async function resetEmailTemplate(idOrKey: string) {
  const existing = await getEmailTemplate(idOrKey);
  const def = getEmailTemplateDefault(existing.key);
  if (!def) throw new ValidationError("No default exists for this template");
  return prisma.emailTemplate.update({
    where: { id: existing.id },
    data: {
      name: def.name,
      description: def.description,
      subject: def.subject,
      bodyFormat: def.bodyFormat,
      body: def.body,
      enabled: true,
    },
  });
}

export async function sendTestEmailTemplate(
  idOrKey: string,
  to: string,
) {
  const template = await getEmailTemplate(idOrKey);
  const recipient = to.trim();
  if (!recipient) throw new ValidationError("Recipient email is required");

  const sample: Record<string, unknown> = {
    name: "Admin",
    clientName: "Client",
    invoiceNumber: "INV-TEST-001",
    total: "$10.00",
    currency: "USD",
    ticketNumber: "TKT-1001",
    ticketSubject: "Sample ticket",
    message: "This is a sample staff reply for testing the email template.",
    error: "Sample cron error message for testing.",
  };

  const { sendTemplatedEmail } = await import("@/src/email/send");
  await sendTemplatedEmail({
    to: recipient,
    subject: template.subject,
    template: template.key as
      | "welcome"
      | "invoice"
      | "receipt"
      | "ticket_reply"
      | "cron_failure",
    payload: sample,
  });

  return { to: recipient, templateKey: template.key };
}

export async function listEmailLogs(params: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const where: {
    status?: string;
    OR?: Array<
      | { to: { contains: string; mode: "insensitive" } }
      | { subject: { contains: string; mode: "insensitive" } }
      | { from: { contains: string; mode: "insensitive" } }
    >;
  } = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { to: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { from: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        to: true,
        from: true,
        subject: true,
        status: true,
        templateKey: true,
        error: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEmailLog(id: string) {
  const row = await prisma.emailLog.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Email log not found");
  return row;
}

export async function seedEmailTemplates() {
  for (const def of EMAIL_TEMPLATE_DEFAULTS) {
    await prisma.emailTemplate.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        subject: def.subject,
        bodyFormat: def.bodyFormat,
        body: def.body,
        enabled: true,
      },
      update: {},
    });
  }
}
