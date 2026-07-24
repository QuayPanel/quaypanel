import { prisma } from "@/src/db/client";
import { NotFoundError, ConflictError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { enqueueInvoicePaid, enqueueEmail } from "@/src/core/queue";
import { getSetting, updateSettings } from "@/src/domains/settings/service";
import { z } from "zod";
import { formatMoney } from "@/src/core/utils";

export async function formatNextInvoiceNumber() {
  const format = String(
    await getSetting("invoice.numberFormat", "INV-{year}-{number}"),
  );
  const padding = Number(await getSetting("invoice.numberPadding", 5));
  let next = Number(await getSetting("invoice.nextNumber", 1));
  if (!Number.isFinite(next) || next < 1) next = 1;

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const padded = String(next).padStart(Math.max(1, padding), "0");

  const number = format
    .replaceAll("{year}", year)
    .replaceAll("{month}", month)
    .replaceAll("{day}", day)
    .replaceAll("{number}", padded);

  await updateSettings({ "invoice.nextNumber": next + 1 });
  return number;
}

async function nextInvoiceNumber() {
  return formatNextInvoiceNumber();
}

export async function listInvoices(clientId?: string) {
  let where: { OR?: Array<{ clientId: string } | { serviceId: { in: string[] } }> } | undefined;

  if (clientId) {
    const contributorRows = await prisma.serviceContributor.findMany({
      where: { clientId },
      select: { serviceId: true },
    });
    const serviceIds = contributorRows.map((row) => row.serviceId);
    where = {
      OR: [
        { clientId },
        ...(serviceIds.length > 0
          ? [{ serviceId: { in: serviceIds } }]
          : []),
      ],
    };
  }

  return prisma.invoice.findMany({
    where,
    include: {
      client: true,
      items: true,
      payments: true,
      order: true,
      service: true,
      coupon: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function canAccessInvoiceAsClient(
  clientId: string,
  invoice: { clientId: string; serviceId: string | null },
) {
  if (invoice.clientId === clientId) return true;
  if (!invoice.serviceId) return false;
  const contributor = await prisma.serviceContributor.findFirst({
    where: { serviceId: invoice.serviceId, clientId },
  });
  return Boolean(contributor);
}

export async function canPayInvoiceAsClient(
  clientId: string,
  invoice: { clientId: string; serviceId: string | null },
) {
  if (invoice.clientId === clientId) return true;
  if (!invoice.serviceId) return false;
  const contributor = await prisma.serviceContributor.findFirst({
    where: { serviceId: invoice.serviceId, clientId, canPay: true },
  });
  return Boolean(contributor);
}

export async function getInvoice(idOrNumber: string) {
  const decoded = decodeURIComponent(String(idOrNumber));
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id: decoded }, { number: decoded }],
    },
    include: {
      client: true,
      items: true,
      payments: true,
      coupon: true,
      service: true,
      order: {
        include: {
          items: { include: { plan: true } },
        },
      },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice not found");
  return invoice;
}

export async function createInvoiceFromOrder(orderId: string, actorId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { plan: { include: { product: true } } } },
      client: true,
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  const proforma = Boolean(await getSetting("invoice.proforma", false));
  const number = await nextInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: order.clientId,
      orderId: order.id,
      status: "UNPAID",
      isProforma: proforma,
      currency: order.currency,
      subtotal: order.subtotal || order.total,
      discountMinor: order.discountMinor,
      taxMinor: order.taxMinor,
      total: order.total,
      couponId: order.couponId,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          ...order.items.map((item) => ({
            description: `${item.plan.product.name} — ${item.plan.name}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
          ...(order.discountMinor > 0
            ? [
                {
                  description: "Discount",
                  quantity: 1,
                  unitPrice: -order.discountMinor,
                  total: -order.discountMinor,
                },
              ]
            : []),
          ...(order.taxMinor > 0
            ? [
                {
                  description: "Tax",
                  quantity: 1,
                  unitPrice: order.taxMinor,
                  total: order.taxMinor,
                },
              ]
            : []),
        ],
      },
    },
    include: { items: true, client: true },
  });

  await writeAuditLog({
    actorId,
    action: "invoice.create",
    entityType: "invoice",
    entityId: invoice.id,
  });

  const { runAddonHooks } = await import("@/src/addons/theme-runtime");
  await runAddonHooks("invoice.created", {
    invoiceId: invoice.id,
    orderId: order.id,
    clientId: invoice.clientId,
    total: invoice.total,
  }).catch(() => undefined);

  return invoice;
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  paymentId: string;
  actorId?: string;
}) {
  const invoice = await getInvoice(input.invoiceId);
  if (invoice.status === "PAID") {
    return invoice;
  }

  const snapshotOnPay = Boolean(
    await getSetting("invoice.snapshotOnPay", true),
  );
  const client = invoice.client;
  const snapshot = snapshotOnPay
    ? {
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        address1: client.address1,
        address2: client.address2,
        city: client.city,
        state: client.state,
        postalCode: client.postalCode,
        country: client.country,
        taxId: client.taxId,
      }
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: { status: "COMPLETED" },
    });

    const inv = await tx.invoice.update({
      where: { id: input.invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        isProforma: false,
        snapshot: snapshot === undefined ? undefined : (snapshot as object),
      },
      include: { client: true, order: true },
    });

    if (inv.orderId) {
      await tx.order.update({
        where: { id: inv.orderId },
        data: { status: "COMPLETED" },
      });
    }

    return inv;
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "invoice.paid",
    entityType: "invoice",
    entityId: updated.id,
    metadata: { paymentId: input.paymentId },
  });

  await enqueueInvoicePaid({
    invoiceId: updated.id,
    paymentId: input.paymentId,
  }).catch(() => undefined);

  const { runAddonHooks } = await import("@/src/addons/theme-runtime");
  if (updated.orderId) {
    await runAddonHooks("order.paid", {
      orderId: updated.orderId,
      invoiceId: updated.id,
      paymentId: input.paymentId,
      clientId: updated.clientId,
      total: updated.total,
    }).catch(() => undefined);
  }

  return updated;
}

export async function voidInvoice(idOrNumber: string, actorId?: string) {
  const invoice = await getInvoice(idOrNumber);
  if (invoice.status === "PAID") {
    throw new ConflictError("Cannot void a paid invoice");
  }
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "VOID" },
  });
  await writeAuditLog({
    actorId,
    action: "invoice.void",
    entityType: "invoice",
    entityId: invoice.id,
  });
  return updated;
}

export const invoiceUpdateSchema = z.object({
  status: z.enum(["DRAFT", "UNPAID", "VOID"]).optional(),
  dueAt: z.string().nullable().optional(),
  currency: z.string().min(1).optional(),
  subtotal: z.number().int().nonnegative().optional(),
  discountMinor: z.number().int().nonnegative().optional(),
  taxMinor: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
});

export async function updateInvoice(
  idOrNumber: string,
  data: z.infer<typeof invoiceUpdateSchema>,
  actorId?: string,
) {
  const invoice = await getInvoice(idOrNumber);
  if (invoice.status === "PAID" || invoice.status === "REFUNDED") {
    throw new ConflictError("Cannot edit a paid or refunded invoice");
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dueAt !== undefined
        ? { dueAt: data.dueAt ? new Date(data.dueAt) : null }
        : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.subtotal !== undefined ? { subtotal: data.subtotal } : {}),
      ...(data.discountMinor !== undefined
        ? { discountMinor: data.discountMinor }
        : {}),
      ...(data.taxMinor !== undefined ? { taxMinor: data.taxMinor } : {}),
      ...(data.total !== undefined ? { total: data.total } : {}),
    },
  });

  await writeAuditLog({
    actorId,
    action: "invoice.update",
    entityType: "invoice",
    entityId: invoice.id,
  });
  return getInvoice(updated.id);
}

export const customInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int(),
  total: z.number().int().optional(),
});

export const createCustomInvoiceSchema = z.object({
  clientId: z.string().min(1),
  currency: z.string().min(1).optional(),
  note: z.string().optional(),
  dueDays: z.number().int().positive().optional(),
  items: z.array(customInvoiceItemSchema).min(1),
});

export async function createCustomInvoice(input: {
  clientId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total?: number;
  }>;
  currency?: string;
  note?: string;
  dueDays?: number;
  actorId?: string;
}) {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
  });
  if (!client) throw new NotFoundError("Client not found");

  const currency =
    input.currency ?? String(await getSetting("currency", "USD"));
  const lineItems = input.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total ?? item.quantity * item.unitPrice,
  }));
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const number = await nextInvoiceNumber();
  const dueDays = input.dueDays ?? 7;

  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: input.clientId,
      status: "UNPAID",
      currency,
      subtotal,
      discountMinor: 0,
      taxMinor: 0,
      total: subtotal,
      dueAt: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
      items: { create: lineItems },
      snapshot: input.note
        ? ({ customNote: input.note } as object)
        : undefined,
    },
    include: { items: true, client: true },
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "invoice.create_custom",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { note: input.note },
  });

  await enqueueEmail({
    to: client.email,
    subject: `Invoice ${invoice.number}`,
    template: "invoice",
    payload: {
      invoiceNumber: invoice.number,
      clientName: client.name,
      total: formatMoney(invoice.total, invoice.currency),
      currency: invoice.currency,
    },
  }).catch(() => undefined);

  const { runAddonHooks } = await import("@/src/addons/theme-runtime");
  await runAddonHooks("invoice.created", {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    total: invoice.total,
  }).catch(() => undefined);

  return invoice;
}

export function isCreditDepositInvoice(invoice: {
  items: Array<{ description: string }>;
}) {
  return (
    invoice.items.length === 1 &&
    invoice.items[0]?.description === "Credit deposit"
  );
}

export async function deleteInvoice(idOrNumber: string, actorId?: string) {
  const invoice = await getInvoice(idOrNumber);
  if (invoice.status === "PAID") {
    throw new ConflictError("Cannot delete a paid invoice");
  }
  if (invoice.status !== "VOID") {
    throw new ConflictError("Void the invoice before permanently deleting it");
  }
  if (invoice.payments.length > 0) {
    throw new ConflictError("Cannot delete an invoice that has payments");
  }
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await writeAuditLog({
    actorId,
    action: "invoice.delete",
    entityType: "invoice",
    entityId: invoice.id,
  });
  return { ok: true };
}
