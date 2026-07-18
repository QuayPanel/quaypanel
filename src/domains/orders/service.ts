import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError, ConflictError } from "@/src/core/errors";
import { isPublicNumberId } from "@/src/core/public-id";
import { assertCanOrderPlan } from "@/src/domains/products/service";
import { writeAuditLog } from "@/src/domains/audit/service";
import { createInvoiceFromOrder } from "@/src/domains/invoices/service";
import { enqueueEmail } from "@/src/core/queue";
import { getSetting } from "@/src/domains/settings/service";
import { validateCoupon } from "@/src/domains/coupons/service";
import { priceOrder } from "@/src/domains/billing/pricing";
import {
  planPriceMinor,
  resolveServerPriceVars,
} from "@/src/domains/billing/price-formula";
import { formatMoney } from "@/src/core/utils";
import { applyCreditsToAmount } from "@/src/domains/credits/service";

const orderItemConfigSchema = z.object({
  configOptionId: z.string().min(1),
  type: z.string().min(1),
  name: z.string().optional(),
  value: z.string().optional(),
  choiceIds: z.array(z.string()).optional(),
  choiceLabels: z.array(z.string()).optional(),
  extraMinor: z.number().int().nonnegative().optional(),
});

export const orderCreateSchema = z.object({
  clientId: z.string().min(1),
  couponCode: z.string().optional(),
  affiliateCode: z.string().optional(),
  items: z
    .array(
      z.object({
        planId: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        config: z.array(orderItemConfigSchema).optional(),
      }),
    )
    .min(1),
});

/** Resolve order by public number (`1`) or internal cuid. */
export async function resolveOrderId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (isPublicNumberId(raw)) {
    const order = await prisma.order.findUnique({
      where: { number: Number(raw) },
    });
    if (!order) throw new NotFoundError("Order not found");
    return order.id;
  }
  return raw;
}

export async function listOrders(clientId?: string) {
  return prisma.order.findMany({
    where: clientId ? { clientId } : undefined,
    include: {
      client: true,
      items: { include: { plan: { include: { product: true } } } },
      invoices: true,
      coupon: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(idOrNumber: string) {
  const id = await resolveOrderId(idOrNumber);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { plan: { include: { product: true } } } },
      invoices: true,
      coupon: true,
    },
  });
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

async function resolveConfigExtra(
  productId: string,
  selections: z.infer<typeof orderItemConfigSchema>[] | undefined,
) {
  if (!selections || selections.length === 0) {
    return { extraMinor: 0, snapshot: [] as unknown[] };
  }

  const linked = await prisma.configOptionProduct.findMany({
    where: { productId },
    include: {
      configOption: {
        include: { choices: true },
      },
    },
  });
  const byOptionId = new Map(
    linked.map((row) => [row.configOptionId, row.configOption]),
  );

  let extraMinor = 0;
  const snapshot: Array<Record<string, unknown>> = [];

  for (const sel of selections) {
    const option = byOptionId.get(sel.configOptionId);
    if (!option || option.hidden) {
      throw new ValidationError(
        `Invalid config option for this product: ${sel.configOptionId}`,
      );
    }

    const choiceIds = sel.choiceIds ?? [];
    const choices = option.choices.filter((c) => choiceIds.includes(c.id));
    if (choiceIds.length > 0 && choices.length !== choiceIds.length) {
      throw new ValidationError("Invalid config option choice selected");
    }

    const pricedTypes = new Set(["SELECT", "RADIO", "CHECKBOX", "SLIDER"]);
    let selectionExtra = 0;
    if (pricedTypes.has(option.type)) {
      for (const choice of choices) {
        if (choice.pricingType !== "FREE") {
          selectionExtra += choice.price;
        }
      }
    }

    extraMinor += selectionExtra;
    snapshot.push({
      configOptionId: option.id,
      type: option.type,
      name: option.name,
      envKey: option.envKey,
      value: sel.value ?? null,
      choiceIds,
      choiceLabels: choices.map((c) => c.name),
      choices: choices.map((c) => ({
        id: c.id,
        name: c.name,
        envKey: c.envKey,
        price: c.price,
        pricingType: c.pricingType,
      })),
      extraMinor: selectionExtra,
    });
  }

  return { extraMinor, snapshot };
}

export async function createOrder(
  data: z.infer<typeof orderCreateSchema>,
  actorId?: string,
) {
  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
  });
  if (!client) throw new NotFoundError("Client not found");

  const requireVerified = Boolean(
    await getSetting("mail.requireVerifiedEmail", false),
  );
  if (requireVerified) {
    const user = await prisma.user.findFirst({
      where: { clientId: data.clientId },
    });
    if (user && !user.emailVerified) {
      throw new ValidationError("Verify your email before placing an order");
    }
  }

  const currency = (await getSetting<string>("currency", "USD")) ?? "USD";
  const lineItems: Array<{
    planId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    config: object;
  }> = [];

  for (const item of data.items) {
    const { plan, quantity } = await assertCanOrderPlan({
      planId: item.planId,
      clientId: data.clientId,
      quantity: item.quantity ?? 1,
    });

    const { extraMinor, snapshot } = await resolveConfigExtra(
      plan.productId,
      item.config,
    );

    const vars = resolveServerPriceVars(
      (plan.product.provisionConfig ?? {}) as Record<string, unknown>,
      snapshot as Array<{
        envKey?: string | null;
        type?: string | null;
        value?: string | null;
        choices?: Array<{ envKey?: string | null }>;
      }>,
    );
    const basePlanPrice = planPriceMinor({
      price: plan.price,
      priceFormula: plan.priceFormula,
      vars,
    });

    const setupMultiplier =
      plan.product.allowQuantity === "COMBINED" ? 1 : quantity;
    const setupTotal = (plan.setupFee ?? 0) * setupMultiplier;
    const unitPrice = basePlanPrice + extraMinor;

    lineItems.push({
      planId: plan.id,
      quantity,
      unitPrice,
      total: unitPrice * quantity + setupTotal,
      config: { selections: snapshot },
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const coupon = data.couponCode
    ? await validateCoupon(data.couponCode, data.clientId)
    : null;
  const priced = await priceOrder({
    subtotal,
    coupon: coupon ? { type: coupon.type, value: coupon.value } : null,
  });

  const { remaining, used } = await applyCreditsToAmount(
    data.clientId,
    priced.total,
  );

  const order = await prisma.order.create({
    data: {
      clientId: data.clientId,
      currency,
      subtotal: priced.subtotal,
      discountMinor: priced.discountMinor + used,
      taxMinor: priced.taxMinor,
      total: remaining,
      couponId: coupon?.id,
      affiliateCode: data.affiliateCode?.toLowerCase(),
      status: "PENDING",
      items: { create: lineItems },
    },
    include: {
      client: true,
      items: { include: { plan: { include: { product: true } } } },
    },
  });

  const invoice = await createInvoiceFromOrder(order.id, actorId);

  await enqueueEmail({
    to: client.email,
    subject: `Invoice ${invoice.number} created`,
    template: "invoice",
    payload: {
      invoiceNumber: invoice.number,
      clientName: client.name,
      total: formatMoney(invoice.total, invoice.currency),
      currency: invoice.currency,
    },
  }).catch(() => undefined);

  await writeAuditLog({
    actorId,
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    metadata: { invoiceId: invoice.id, creditsUsed: used },
  });

  return getOrder(order.id);
}

export const orderUpdateSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
});

export async function updateOrder(
  idOrNumber: string,
  data: z.infer<typeof orderUpdateSchema>,
  actorId?: string,
) {
  const id = await resolveOrderId(idOrNumber);
  await getOrder(id);
  const order = await prisma.order.update({
    where: { id },
    data: { status: data.status },
  });
  await writeAuditLog({
    actorId,
    action: "order.update",
    entityType: "order",
    entityId: id,
    metadata: { status: data.status },
  });
  return getOrder(order.id);
}

export async function deleteOrder(idOrNumber: string, actorId?: string) {
  const id = await resolveOrderId(idOrNumber);
  const order = await getOrder(id);
  if (order.invoices.some((inv) => inv.status === "PAID")) {
    throw new ConflictError("Cannot delete an order with paid invoices");
  }
  if (order.status === "COMPLETED") {
    throw new ConflictError("Cannot delete a completed order");
  }
  await prisma.order.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "order.delete",
    entityType: "order",
    entityId: id,
  });
  return { ok: true };
}
