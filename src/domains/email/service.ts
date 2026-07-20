import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  getEmailTemplateDefault,
} from "@/src/email/defaults";
import { ensureEmailTemplatesSeeded } from "@/src/email/render-template";
import { writeAuditLog } from "@/src/domains/audit/service";

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
      | "cron_failure"
      | "announcement",
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

export const massMailSchema = z.object({
  filter: z.enum(["all", "productId", "overdue", "activeServices"]),
  productId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

async function resolveMassMailRecipients(
  filter: z.infer<typeof massMailSchema>["filter"],
  productId?: string,
) {
  if (filter === "all") {
    const clients = await prisma.client.findMany({
      select: { email: true },
    });
    return [...new Set(clients.map((c) => c.email))];
  }

  if (filter === "productId") {
    if (!productId) {
      throw new ValidationError("productId is required for productId filter");
    }
    const services = await prisma.service.findMany({
      where: {
        status: { in: ["ACTIVE", "PENDING", "SUSPENDED"] },
        plan: { productId },
      },
      include: { client: true },
    });
    return [...new Set(services.map((s) => s.client.email))];
  }

  if (filter === "overdue") {
    const now = new Date();
    const invoices = await prisma.invoice.findMany({
      where: {
        status: "UNPAID",
        dueAt: { lt: now },
      },
      include: { client: true },
    });
    return [...new Set(invoices.map((i) => i.client.email))];
  }

  const services = await prisma.service.findMany({
    where: { status: "ACTIVE" },
    include: { client: true },
  });
  return [...new Set(services.map((s) => s.client.email))];
}

export async function sendMassMail(
  data: z.infer<typeof massMailSchema>,
  actorId?: string,
) {
  const parsed = massMailSchema.parse(data);
  const recipients = await resolveMassMailRecipients(
    parsed.filter,
    parsed.productId,
  );

  if (recipients.length === 0) {
    throw new ValidationError("No recipients matched the selected filter");
  }

  const { sendBroadcastEmail } = await import("@/src/email/send");
  const { markdownToHtml } = await import("@/src/email/render-template");
  const html = await markdownToHtml(parsed.body);
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    try {
      await sendBroadcastEmail({
        to,
        subject: parsed.subject,
        html,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  await writeAuditLog({
    actorId,
    action: "mail.mass",
    entityType: "email",
    metadata: {
      filter: parsed.filter,
      productId: parsed.productId,
      recipients: recipients.length,
      sent,
      failed,
    },
  });

  return { recipients: recipients.length, sent, failed };
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
