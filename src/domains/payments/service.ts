import { z } from "zod";
import { prisma } from "@/src/db/client";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";
import { isPublicNumberId } from "@/src/core/public-id";
import { env } from "@/src/core/env";
import {
  getPaymentGateway,
  loadBuiltInGateways,
} from "@/src/plugins/registry";
import { getInvoice, markInvoicePaid } from "@/src/domains/invoices/service";
import { writeAuditLog } from "@/src/domains/audit/service";
import { creditOnRefund } from "@/src/domains/credits/service";

export const payInvoiceSchema = z.object({
  gatewayId: z.enum(["stripe", "paypal"]),
});

export async function listPayments(invoiceId?: string) {
  return prisma.payment.findMany({
    where: invoiceId ? { invoiceId } : undefined,
    include: { invoice: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPayment(idOrNumber: string) {
  const raw = String(idOrNumber);
  const payment = isPublicNumberId(raw)
    ? await prisma.payment.findUnique({
        where: { number: Number(raw) },
        include: { invoice: { include: { client: true } } },
      })
    : await prisma.payment.findUnique({
        where: { id: raw },
        include: { invoice: { include: { client: true } } },
      });
  if (!payment) throw new NotFoundError("Payment not found");
  return payment;
}

export const paymentUpdateSchema = z.object({
  status: z.enum(["PENDING", "FAILED", "COMPLETED", "REFUNDED"]).optional(),
  amount: z.number().int().positive().optional(),
  currency: z.string().min(1).optional(),
});

export async function updatePayment(
  idOrNumber: string,
  data: z.infer<typeof paymentUpdateSchema>,
  actorId?: string,
) {
  const payment = await getPayment(idOrNumber);
  const id = payment.id;

  if (payment.status === "COMPLETED") {
    if (data.status && data.status !== "REFUNDED") {
      throw new ConflictError(
        "Completed payments can only be marked as refunded",
      );
    }
    if (data.amount !== undefined || data.currency !== undefined) {
      throw new ConflictError("Cannot edit amount on a completed payment");
    }
  } else if (payment.status === "REFUNDED") {
    throw new ConflictError("Cannot edit a refunded payment");
  } else if (data.status === "COMPLETED") {
    throw new ConflictError(
      "Marking payments completed must go through checkout settlement",
    );
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
    },
    include: { invoice: { include: { client: true } } },
  });

  await writeAuditLog({
    actorId,
    action: "payment.update",
    entityType: "payment",
    entityId: id,
  });
  return updated;
}

export async function deletePayment(idOrNumber: string, actorId?: string) {
  const payment = await getPayment(idOrNumber);
  const id = payment.id;
  if (payment.status === "COMPLETED" || payment.status === "REFUNDED") {
    throw new ConflictError(
      "Cannot delete a completed or refunded payment",
    );
  }
  await prisma.payment.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "payment.delete",
    entityType: "payment",
    entityId: id,
  });
  return { ok: true };
}

export async function createCheckoutForInvoice(
  invoiceId: string,
  gatewayId: string,
  actorId?: string,
) {
  const invoice = await getInvoice(invoiceId);
  if (invoice.status !== "UNPAID") {
    throw new ConflictError("Invoice is not payable");
  }

  await loadBuiltInGateways();
  const gateway = getPaymentGateway(gatewayId);

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      gatewayId,
      amount: invoice.total,
      currency: invoice.currency,
      status: "PENDING",
    },
  });

  const checkout = await gateway.createCheckout({
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amount: invoice.total,
    currency: invoice.currency,
    customerEmail: invoice.client.email,
    customerName: invoice.client.name,
    customerId: invoice.client.stripeCustomerId ?? undefined,
    successUrl: `${env.APP_URL}/client/invoices/${encodeURIComponent(invoice.number)}?paid=1`,
    cancelUrl: `${env.APP_URL}/client/invoices/${encodeURIComponent(invoice.number)}?cancelled=1`,
    metadata: {
      paymentId: payment.id,
      invoiceId: invoice.id,
    },
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      externalId: checkout.externalId,
      checkoutUrl: checkout.checkoutUrl,
    },
  });

  await writeAuditLog({
    actorId,
    action: "payment.checkout",
    entityType: "payment",
    entityId: payment.id,
    metadata: { gatewayId, invoiceId },
  });

  return updated;
}

export async function settleWebhookPayment(input: {
  gatewayId: string;
  externalEventId: string;
  paymentExternalId?: string;
  invoiceId?: string;
  amount?: number;
  customerId?: string;
  paymentMethodId?: string;
  payload?: unknown;
}) {
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      gatewayId_externalId: {
        gatewayId: input.gatewayId,
        externalId: input.externalEventId,
      },
    },
  });
  if (existingEvent) {
    return { duplicate: true as const };
  }

  await prisma.webhookEvent.create({
    data: {
      gatewayId: input.gatewayId,
      externalId: input.externalEventId,
      payload: (input.payload ?? {}) as object,
    },
  });

  let payment = input.paymentExternalId
    ? await prisma.payment.findFirst({
        where: {
          gatewayId: input.gatewayId,
          externalId: input.paymentExternalId,
        },
      })
    : null;

  if (!payment && input.invoiceId) {
    payment = await prisma.payment.findFirst({
      where: {
        invoiceId: input.invoiceId,
        gatewayId: input.gatewayId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!payment) {
    throw new NotFoundError("Payment not found for webhook");
  }

  if (payment.status === "COMPLETED") {
    return { duplicate: true as const, payment };
  }

  if (input.amount && input.amount !== payment.amount) {
    throw new ValidationError("Webhook amount mismatch");
  }

  await markInvoicePaid({
    invoiceId: payment.invoiceId,
    paymentId: payment.id,
  });

  if (input.customerId || input.paymentMethodId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
    });
    if (invoice) {
      await prisma.client.update({
        where: { id: invoice.clientId },
        data: {
          ...(input.customerId
            ? { stripeCustomerId: input.customerId }
            : {}),
          ...(input.paymentMethodId
            ? { defaultPaymentMethodId: input.paymentMethodId }
            : {}),
        },
      });
    }
  }

  return { duplicate: false as const, payment };
}

/** Staff: create a manual payment and mark the invoice paid. */
export async function markInvoicePaidManually(
  invoiceId: string,
  actorId?: string,
) {
  const invoice = await getInvoice(invoiceId);
  if (invoice.status === "PAID") {
    throw new ConflictError("Invoice is already paid");
  }
  if (invoice.status === "VOID") {
    throw new ConflictError("Cannot mark a void invoice as paid");
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      gatewayId: "manual",
      amount: invoice.total,
      currency: invoice.currency,
      status: "PENDING",
      externalId: `manual_${invoice.id}_${Date.now()}`,
    },
  });

  return markInvoicePaid({
    invoiceId: invoice.id,
    paymentId: payment.id,
    actorId,
  });
}

/** Staff: refund via gateway (if possible), mark payment/invoice, credit client. */
export async function refundPayment(paymentId: string, actorId?: string) {
  const payment = await getPayment(paymentId);
  if (payment.status !== "COMPLETED") {
    throw new ConflictError("Only completed payments can be refunded");
  }

  if (payment.gatewayId !== "manual" && payment.externalId) {
    await loadBuiltInGateways();
    try {
      const gateway = getPaymentGateway(payment.gatewayId);
      await gateway.refund(payment.externalId, payment.amount);
    } catch {
      // Manual + paypal stubs: still allow local refund/credit
    }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED" },
  });

  await prisma.invoice.update({
    where: { id: payment.invoiceId },
    data: { status: "REFUNDED" },
  });

  await creditOnRefund(
    payment.invoice.clientId,
    payment.amount,
    payment.id,
    actorId,
  );

  await writeAuditLog({
    actorId,
    action: "payment.refund",
    entityType: "payment",
    entityId: payment.id,
    metadata: { amount: payment.amount },
  });

  return getPayment(payment.id);
}

/** Attempt off-session charge for an unpaid invoice. Returns true if charged. */
export async function tryAutoChargeInvoice(invoiceId: string): Promise<boolean> {
  const invoice = await getInvoice(invoiceId);
  if (invoice.status !== "UNPAID" || invoice.total <= 0) return false;

  const client = invoice.client;
  if (!client.stripeCustomerId || !client.defaultPaymentMethodId) {
    return false;
  }

  await loadBuiltInGateways();
  let gateway;
  try {
    gateway = getPaymentGateway("stripe");
  } catch {
    return false;
  }
  if (!gateway.chargeCustomer) return false;

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      gatewayId: "stripe",
      amount: invoice.total,
      currency: invoice.currency,
      status: "PENDING",
    },
  });

  try {
    const result = await gateway.chargeCustomer({
      customerId: client.stripeCustomerId,
      paymentMethodId: client.defaultPaymentMethodId,
      amount: invoice.total,
      currency: invoice.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { externalId: result.externalId },
    });

    if (result.status !== "completed") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      return false;
    }

    await markInvoicePaid({
      invoiceId: invoice.id,
      paymentId: payment.id,
    });
    return true;
  } catch {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return false;
  }
}
