import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ConflictError, ValidationError } from "@/src/core/errors";
import { isPublicNumberId } from "@/src/core/public-id";
import { writeAuditLog } from "@/src/domains/audit/service";
import { addInterval } from "@/src/domains/billing/pricing";
import { enqueueProvision } from "@/src/core/queue";
import { creditOnDowngrade } from "@/src/domains/credits/service";
import { mergeProvisionConfigFromSelections } from "@/src/domains/services/provision-config";

export const serviceActionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "terminate", "downgrade"]),
  creditAmountMinor: z.number().int().nonnegative().optional(),
});

export const serviceCancelSchema = z.object({
  action: z.literal("cancel"),
  mode: z.enum(["end_of_term", "immediate"]),
  reason: z.string().max(2000).optional().nullable(),
});

export const serviceCancelUndoSchema = z.object({
  action: z.literal("cancel_undo"),
});

/** Resolve service by public number (`1`) or internal cuid. */
export async function resolveServiceId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (isPublicNumberId(raw)) {
    const service = await prisma.service.findUnique({
      where: { number: Number(raw) },
    });
    if (!service) throw new NotFoundError("Service not found");
    return service.id;
  }
  return raw;
}

export async function listServices(clientId?: string) {
  return prisma.service.findMany({
    where: clientId ? { clientId } : undefined,
    include: {
      client: true,
      plan: { include: { product: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getService(idOrNumber: string) {
  const id = await resolveServiceId(idOrNumber);
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      client: true,
      plan: { include: { product: true } },
      invoices: { orderBy: { createdAt: "desc" } },
      orderItem: true,
    },
  });
  if (!service) throw new NotFoundError("Service not found");
  return service;
}

export async function createServicesFromPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          plan: { include: { product: true } },
          services: true,
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  const created = [];
  for (const item of order.items) {
    if (item.services.length > 0) continue;
    const mode = item.plan.product.allowQuantity;
    const isRecurring = item.plan.type === "RECURRING";
    const nextDueAt = isRecurring
      ? addInterval(
          new Date(),
          item.plan.billingPeriod,
          item.plan.intervalCount,
        )
      : null;
    const billingCycle = item.plan.interval;
    const providerId = item.plan.product.provisionProvider || "noop";
    const config = mergeProvisionConfigFromSelections(
      (item.plan.product.provisionConfig ?? {}) as Record<string, unknown>,
      item.config,
    ) as object;

    if (mode === "COMBINED") {
      const service = await prisma.service.create({
        data: {
          clientId: order.clientId,
          orderItemId: item.id,
          planId: item.planId,
          status: "PENDING",
          providerId,
          billingCycle,
          nextDueAt,
          quantity: item.quantity,
          config,
        },
      });
      created.push(service);
      await enqueueProvision({
        action: "provision",
        serviceId: service.id,
        orderId: order.id,
        providerId,
      }).catch(() => undefined);
      continue;
    }

    for (let i = 0; i < item.quantity; i++) {
      const service = await prisma.service.create({
        data: {
          clientId: order.clientId,
          orderItemId: item.id,
          planId: item.planId,
          status: "PENDING",
          providerId,
          billingCycle,
          nextDueAt,
          quantity: 1,
          config,
        },
      });
      created.push(service);
      await enqueueProvision({
        action: "provision",
        serviceId: service.id,
        orderId: order.id,
        providerId,
      }).catch(() => undefined);
    }
  }
  return created;
}

export async function markServiceProvisioned(input: {
  serviceId: string;
  externalId?: string;
  hostname?: string;
}) {
  return prisma.service.update({
    where: { id: input.serviceId },
    data: {
      status: "ACTIVE",
      externalId: input.externalId,
      hostname: input.hostname,
    },
  });
}

export async function updateServiceStatus(
  idOrNumber: string,
  status: "ACTIVE" | "SUSPENDED" | "TERMINATED",
  actorId?: string,
) {
  const service = await getService(idOrNumber);
  if (service.status === "TERMINATED") {
    throw new ConflictError("Service already terminated");
  }
  const updated = await prisma.service.update({
    where: { id: service.id },
    data: { status },
  });
  await writeAuditLog({
    actorId,
    action: `service.${status.toLowerCase()}`,
    entityType: "service",
    entityId: service.id,
  });
  return updated;
}

export async function requestServiceAction(
  idOrNumber: string,
  action: "suspend" | "unsuspend" | "terminate" | "downgrade",
  actorId?: string,
  creditAmountMinor = 0,
) {
  const service = await getService(idOrNumber);
  const id = service.id;
  if (action === "downgrade") {
    await creditOnDowngrade(
      service.clientId,
      creditAmountMinor,
      service.id,
      actorId,
    );
    await writeAuditLog({
      actorId,
      action: "service.downgrade_credited",
      entityType: "service",
      entityId: id,
      metadata: { creditAmountMinor },
    });
    return service;
  }
  await enqueueProvision({
    action,
    serviceId: service.id,
    orderId: service.orderItemId ?? undefined,
    providerId: service.providerId,
  });
  await writeAuditLog({
    actorId,
    action: `service.${action}_requested`,
    entityType: "service",
    entityId: id,
  });
  return service;
}

export async function requestServiceCancellation(
  idOrNumber: string,
  data: Omit<z.infer<typeof serviceCancelSchema>, "action">,
  actorId?: string,
) {
  const service = await getService(idOrNumber);
  if (service.status === "TERMINATED") {
    throw new ConflictError("Service is already terminated");
  }
  if (service.cancelAt) {
    throw new ConflictError(
      "A cancellation is already scheduled. Remove it first to change it.",
    );
  }

  const reason = data.reason?.trim() ? data.reason.trim() : null;
  const now = new Date();

  if (data.mode === "immediate") {
    const updated = await prisma.service.update({
      where: { id: service.id },
      data: {
        cancelAt: now,
        cancelRequestedAt: now,
        cancelReason: reason,
      },
    });
    await enqueueProvision({
      action: "terminate",
      serviceId: service.id,
      orderId: service.orderItemId ?? undefined,
      providerId: service.providerId,
    });
    await writeAuditLog({
      actorId,
      action: "service.cancel_immediate",
      entityType: "service",
      entityId: service.id,
      metadata: { reason },
    });
    return updated;
  }

  if (!service.nextDueAt) {
    throw new ValidationError(
      "This service has no end date. Choose cancel immediately instead.",
    );
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: {
      cancelAt: service.nextDueAt,
      cancelRequestedAt: now,
      cancelReason: reason,
    },
  });
  await writeAuditLog({
    actorId,
    action: "service.cancel_end_of_term",
    entityType: "service",
    entityId: service.id,
    metadata: { reason, cancelAt: service.nextDueAt.toISOString() },
  });
  return updated;
}

export async function clearServiceCancellation(
  idOrNumber: string,
  actorId?: string,
) {
  const service = await getService(idOrNumber);
  if (!service.cancelAt && !service.cancelRequestedAt) {
    throw new ValidationError("No cancellation to remove");
  }
  if (service.status === "TERMINATED") {
    throw new ConflictError("Cannot remove cancellation from a terminated service");
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: {
      cancelAt: null,
      cancelRequestedAt: null,
      cancelReason: null,
    },
  });
  await writeAuditLog({
    actorId,
    action: "service.cancel_undo",
    entityType: "service",
    entityId: service.id,
  });
  return updated;
}

/** Terminate services whose scheduled cancelAt has passed. */
export async function processDueCancellations(now = new Date()) {
  const due = await prisma.service.findMany({
    where: {
      cancelAt: { lte: now },
      status: { in: ["PENDING", "ACTIVE", "SUSPENDED"] },
    },
    take: 200,
  });

  let terminated = 0;
  for (const service of due) {
    await enqueueProvision({
      action: "terminate",
      serviceId: service.id,
      orderId: service.orderItemId ?? undefined,
      providerId: service.providerId,
    });
    terminated += 1;
  }
  return terminated;
}

export const serviceUpdateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
  hostname: z.string().nullable().optional(),
  nextDueAt: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  billingCycle: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  externalId: z.string().nullable().optional(),
});

export async function updateService(
  idOrNumber: string,
  data: z.infer<typeof serviceUpdateSchema>,
  actorId?: string,
) {
  const id = await resolveServiceId(idOrNumber);
  await getService(id);
  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.hostname !== undefined ? { hostname: data.hostname } : {}),
      ...(data.nextDueAt !== undefined
        ? { nextDueAt: data.nextDueAt ? new Date(data.nextDueAt) : null }
        : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.billingCycle !== undefined
        ? { billingCycle: data.billingCycle }
        : {}),
      ...(data.providerId !== undefined ? { providerId: data.providerId } : {}),
      ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
    },
  });
  await writeAuditLog({
    actorId,
    action: "service.update",
    entityType: "service",
    entityId: id,
  });
  return getService(updated.id);
}

export async function deleteService(idOrNumber: string, actorId?: string) {
  const id = await resolveServiceId(idOrNumber);
  await getService(id);
  await prisma.service.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "service.delete",
    entityType: "service",
    entityId: id,
  });
  return { ok: true };
}

export const serviceUpgradeSchema = z.object({
  targetProductId: z.string().min(1),
  targetPlanId: z.string().min(1),
});

/** Upgrade a service to a target product/plan with simple remaining-period credit. */
export async function upgradeService(
  id: string,
  data: z.infer<typeof serviceUpgradeSchema>,
  actorId?: string,
) {
  const service = await getService(id);
  if (service.status === "TERMINATED") {
    throw new ConflictError("Cannot upgrade a terminated service");
  }

  const allowed = await prisma.productUpgrade.findFirst({
    where: {
      productId: service.plan.productId,
      targetProductId: data.targetProductId,
    },
  });
  if (!allowed) {
    throw new ConflictError("Target product is not an allowed upgrade");
  }

  const targetPlan = await prisma.productPlan.findFirst({
    where: {
      id: data.targetPlanId,
      productId: data.targetProductId,
      active: true,
    },
    include: { product: true },
  });
  if (!targetPlan) throw new NotFoundError("Target plan not found");

  // Proration: remaining fraction of billing period
  let remaining = 1;
  if (service.nextDueAt) {
    const now = Date.now();
    const due = service.nextDueAt.getTime();
    const periodMs =
      1000 *
      60 *
      60 *
      24 *
      30 *
      Math.max(1, service.plan.intervalCount || 1);
    remaining = Math.max(0, Math.min(1, (due - now) / periodMs));
  }

  const creditAmountMinor = Math.floor(service.plan.price * remaining);
  const targetProrated = Math.floor(targetPlan.price * remaining);
  const chargeMinor = Math.max(0, targetProrated - creditAmountMinor);

  if (creditAmountMinor > targetProrated) {
    await creditOnDowngrade(
      service.clientId,
      creditAmountMinor - targetProrated,
      service.id,
      actorId,
    );
  }

  let upgradeInvoiceId: string | null = null;
  if (chargeMinor > 0) {
    const { formatNextInvoiceNumber } = await import(
      "@/src/domains/invoices/service"
    );
    const number = await formatNextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        number,
        clientId: service.clientId,
        serviceId: service.id,
        status: "UNPAID",
        currency: targetPlan.currency,
        subtotal: chargeMinor,
        discountMinor: 0,
        taxMinor: 0,
        total: chargeMinor,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              description: `Upgrade to ${targetPlan.product.name} — ${targetPlan.name} (prorated)`,
              quantity: 1,
              unitPrice: chargeMinor,
              total: chargeMinor,
            },
          ],
        },
      },
    });
    upgradeInvoiceId = invoice.id;
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: {
      planId: targetPlan.id,
      billingCycle: targetPlan.interval,
      providerId: targetPlan.product.provisionProvider || service.providerId,
      config: mergeProvisionConfigFromSelections(
        (targetPlan.product.provisionConfig ??
          (service.config as Record<string, unknown>) ??
          {}) as Record<string, unknown>,
        service.orderItem?.config,
      ) as object,
    },
  });

  await writeAuditLog({
    actorId,
    action: "service.upgraded",
    entityType: "service",
    entityId: service.id,
    metadata: {
      fromPlanId: service.planId,
      toPlanId: targetPlan.id,
      creditAmountMinor,
      chargeMinor,
      upgradeInvoiceId,
    },
  });

  return {
    ...(await getService(updated.id)),
    upgradeInvoiceId,
    chargeMinor,
    creditAmountMinor,
  };
}
