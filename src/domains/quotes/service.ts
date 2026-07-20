import { z } from "zod";
import { prisma } from "@/src/db/client";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";
import { dollarsToMinor, formatMoney } from "@/src/core/utils";
import { writeAuditLog } from "@/src/domains/audit/service";
import { enqueueEmail } from "@/src/core/queue";
import { createCustomInvoice } from "@/src/domains/invoices/service";
import { getSetting } from "@/src/domains/settings/service";

const quoteItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().optional(),
});

export const quoteCreateSchema = z.object({
  clientId: z.string().min(1),
  currency: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  validUntil: z.string().nullable().optional(),
  items: z.array(quoteItemSchema).min(1),
});

export const quoteUpdateSchema = quoteCreateSchema.partial();

export async function resolveQuoteId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (/^\d+$/.test(raw)) {
    const quote = await prisma.quote.findUnique({
      where: { number: Number(raw) },
    });
    if (!quote) throw new NotFoundError("Quote not found");
    return quote.id;
  }
  return raw;
}

function computeQuoteTotals(
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total?: number;
  }>,
) {
  const normalized = items.map((item) => {
    const total = item.total ?? item.quantity * item.unitPrice;
    return { ...item, total };
  });
  const subtotal = normalized.reduce((sum, item) => sum + item.total, 0);
  return { normalized, subtotal, total: subtotal };
}

export async function listQuotes(clientId?: string) {
  return prisma.quote.findMany({
    where: clientId ? { clientId } : undefined,
    include: { client: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuote(idOrNumber: string | number) {
  const id = await resolveQuoteId(idOrNumber);
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true, items: true },
  });
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
}

export async function createQuote(
  data: z.infer<typeof quoteCreateSchema>,
  actorId?: string,
) {
  const parsed = quoteCreateSchema.parse(data);
  const client = await prisma.client.findUnique({
    where: { id: parsed.clientId },
  });
  if (!client) throw new NotFoundError("Client not found");

  const currency =
    parsed.currency ?? String(await getSetting("currency", "USD"));
  const { normalized, subtotal, total } = computeQuoteTotals(parsed.items);

  const quote = await prisma.quote.create({
    data: {
      clientId: parsed.clientId,
      currency,
      subtotal,
      taxMinor: 0,
      total,
      note: parsed.note ?? null,
      validUntil: parsed.validUntil ? new Date(parsed.validUntil) : null,
      status: "DRAFT",
      items: {
        create: normalized.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    },
    include: { client: true, items: true },
  });

  await writeAuditLog({
    actorId,
    action: "quote.create",
    entityType: "quote",
    entityId: quote.id,
  });
  return quote;
}

export async function updateQuote(
  idOrNumber: string | number,
  data: z.infer<typeof quoteUpdateSchema>,
  actorId?: string,
) {
  const quote = await getQuote(idOrNumber);
  if (quote.status === "CONVERTED" || quote.status === "CANCELLED") {
    throw new ConflictError("Cannot edit a converted or cancelled quote");
  }

  let subtotal = quote.subtotal;
  let total = quote.total;
  if (data.items) {
    const computed = computeQuoteTotals(data.items);
    subtotal = computed.subtotal;
    total = computed.total;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
      await tx.quoteItem.createMany({
        data: computeQuoteTotals(data.items).normalized.map((item) => ({
          quoteId: quote.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      });
    }
    return tx.quote.update({
      where: { id: quote.id },
      data: {
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.validUntil !== undefined
          ? { validUntil: data.validUntil ? new Date(data.validUntil) : null }
          : {}),
        ...(data.items ? { subtotal, total } : {}),
      },
      include: { client: true, items: true },
    });
  });

  await writeAuditLog({
    actorId,
    action: "quote.update",
    entityType: "quote",
    entityId: quote.id,
  });
  return updated;
}

export async function deleteQuote(idOrNumber: string | number, actorId?: string) {
  const quote = await getQuote(idOrNumber);
  if (quote.status === "CONVERTED") {
    throw new ConflictError("Cannot delete a converted quote");
  }
  await prisma.quote.delete({ where: { id: quote.id } });
  await writeAuditLog({
    actorId,
    action: "quote.delete",
    entityType: "quote",
    entityId: quote.id,
  });
  return { ok: true };
}

export async function sendQuote(idOrNumber: string | number, actorId?: string) {
  const quote = await getQuote(idOrNumber);
  if (quote.status !== "DRAFT" && quote.status !== "SENT") {
    throw new ConflictError("Quote cannot be sent in its current state");
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "SENT" },
    include: { client: true, items: true },
  });

  await enqueueEmail({
    to: updated.client.email,
    subject: `Quote #${updated.number} from us`,
    template: "invoice",
    payload: {
      invoiceNumber: `Q-${updated.number}`,
      clientName: updated.client.name,
      total: formatMoney(updated.total, updated.currency),
      currency: updated.currency,
    },
  }).catch(() => undefined);

  await writeAuditLog({
    actorId,
    action: "quote.send",
    entityType: "quote",
    entityId: quote.id,
  });
  return updated;
}

export async function acceptQuote(
  idOrNumber: string | number,
  clientId: string,
  actorId?: string,
) {
  const quote = await getQuote(idOrNumber);
  if (quote.clientId !== clientId) {
    throw new ValidationError("Quote does not belong to this client");
  }
  if (quote.status !== "SENT") {
    throw new ConflictError("Only sent quotes can be accepted");
  }
  if (quote.validUntil && quote.validUntil < new Date()) {
    throw new ConflictError("Quote has expired");
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED" },
    include: { client: true, items: true },
  });

  await writeAuditLog({
    actorId,
    action: "quote.accept",
    entityType: "quote",
    entityId: quote.id,
  });
  return updated;
}

export async function declineQuote(
  idOrNumber: string | number,
  clientId: string,
  actorId?: string,
) {
  const quote = await getQuote(idOrNumber);
  if (quote.clientId !== clientId) {
    throw new ValidationError("Quote does not belong to this client");
  }
  if (quote.status !== "SENT" && quote.status !== "ACCEPTED") {
    throw new ConflictError("Quote cannot be declined in its current state");
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "DECLINED" },
    include: { client: true, items: true },
  });

  await writeAuditLog({
    actorId,
    action: "quote.decline",
    entityType: "quote",
    entityId: quote.id,
  });
  return updated;
}

export async function convertQuoteToInvoice(
  idOrNumber: string | number,
  actorId?: string,
) {
  const quote = await getQuote(idOrNumber);
  if (quote.status !== "ACCEPTED" && quote.status !== "SENT") {
    throw new ConflictError("Quote must be sent or accepted before conversion");
  }
  if (quote.invoiceId) {
    throw new ConflictError("Quote already converted");
  }

  const invoice = await createCustomInvoice({
    clientId: quote.clientId,
    currency: quote.currency,
    note: quote.note ?? undefined,
    items: quote.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    actorId,
  });

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "CONVERTED", invoiceId: invoice.id },
    include: { client: true, items: true },
  });

  await writeAuditLog({
    actorId,
    action: "quote.convert",
    entityType: "quote",
    entityId: quote.id,
    metadata: { invoiceId: invoice.id },
  });

  return { quote: updated, invoice };
}

/** Accept dollar amounts in API payloads for quote line items. */
export const quoteCreateFromDollarsSchema = z.object({
  clientId: z.string().min(1),
  currency: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  validUntil: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unitPrice: z.number().positive(),
        total: z.number().positive().optional(),
      }),
    )
    .min(1),
});

export function quoteItemsFromDollars(
  items: z.infer<typeof quoteCreateFromDollarsSchema>["items"],
) {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: dollarsToMinor(item.unitPrice),
    total: item.total != null ? dollarsToMinor(item.total) : undefined,
  }));
}
