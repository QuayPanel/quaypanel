import type { Job } from "bullmq";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";
import { getSetting } from "@/src/domains/settings/service";
import { enqueueEmail, enqueueProvision } from "@/src/core/queue";
import { formatMoney } from "@/src/core/utils";
import { computeTax } from "@/src/domains/billing/pricing";
import { formatNextInvoiceNumber } from "@/src/domains/invoices/service";
import { addInterval } from "@/src/domains/billing/pricing";

type CronMetrics = {
  invoicesCreated: number;
  servicesSuspended: number;
  servicesTerminated: number;
  ticketsClosed: number;
  invoicesCharged: number;
};

const emptyMetrics = (): CronMetrics => ({
  invoicesCreated: 0,
  servicesSuspended: 0,
  servicesTerminated: 0,
  ticketsClosed: 0,
  invoicesCharged: 0,
});

async function persistCronRun(input: {
  kind: "DAILY" | "SWEEP";
  startedAt: Date;
  status: "SUCCESS" | "FAILED";
  metrics: CronMetrics;
  error?: string;
}) {
  await prisma.cronRun.create({
    data: {
      kind: input.kind,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: new Date(),
      invoicesCreated: input.metrics.invoicesCreated,
      servicesSuspended: input.metrics.servicesSuspended,
      servicesTerminated: input.metrics.servicesTerminated,
      ticketsClosed: input.metrics.ticketsClosed,
      invoicesCharged: input.metrics.invoicesCharged,
      error: input.error,
    },
  });
}

async function runRenewalsSweep(): Promise<CronMetrics> {
  const metrics = emptyMetrics();
  const now = new Date();
  const suspendDays = Number(
    await getSetting(
      "cron.suspendOverdueDays",
      await getSetting("billing.suspendDays", 2),
    ),
  );
  const invoiceDueDays = Number(await getSetting("cron.invoiceDueDays", 7));
  const dueHorizon = new Date(now);
  dueHorizon.setDate(dueHorizon.getDate() + Math.max(0, invoiceDueDays));

  const dueServices = await prisma.service.findMany({
    where: {
      status: { in: ["ACTIVE", "SUSPENDED"] },
      nextDueAt: { lte: dueHorizon },
    },
    include: {
      client: true,
      plan: { include: { product: true } },
      invoices: {
        where: { status: "UNPAID" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  logger.info({ count: dueServices.length }, "Renewals sweep");

  const { tryAutoChargeInvoice } = await import(
    "@/src/domains/payments/service"
  );

  for (const service of dueServices) {
    const openRenewal = service.invoices[0];
    if (!openRenewal) {
      const subtotal = service.plan.price * (service.quantity || 1);
      const priced = await computeTax(subtotal);
      const taxType = String(await getSetting("tax.type", "exclusive"));
      const total =
        taxType === "inclusive" ? subtotal : subtotal + priced.taxMinor;
      const number = await formatNextInvoiceNumber();

      const invoice = await prisma.invoice.create({
        data: {
          number,
          clientId: service.clientId,
          serviceId: service.id,
          status: "UNPAID",
          currency: service.plan.currency,
          subtotal,
          discountMinor: 0,
          taxMinor: priced.taxMinor,
          total,
          dueAt: service.nextDueAt ?? now,
          items: {
            create: [
              {
                description: `Renewal — ${service.plan.product.name} / ${service.plan.name}`,
                quantity: service.quantity || 1,
                unitPrice: service.plan.price,
                total: subtotal,
              },
            ],
          },
        },
      });

      metrics.invoicesCreated += 1;

      await enqueueEmail({
        to: service.client.email,
        subject: `Renewal invoice ${invoice.number}`,
        template: "invoice",
        payload: {
          invoiceNumber: invoice.number,
          clientName: service.client.name,
          total: formatMoney(invoice.total, invoice.currency),
          currency: invoice.currency,
        },
      }).catch(() => undefined);

      const charged = await tryAutoChargeInvoice(invoice.id).catch(() => false);
      if (charged) metrics.invoicesCharged += 1;

      continue;
    }

    // Try auto-charge existing unpaid renewal
    const charged = await tryAutoChargeInvoice(openRenewal.id).catch(
      () => false,
    );
    if (charged) {
      metrics.invoicesCharged += 1;
      continue;
    }

    const dueAt = openRenewal.dueAt ?? openRenewal.createdAt;
    const graceEnd = new Date(dueAt);
    graceEnd.setDate(graceEnd.getDate() + suspendDays);

    if (service.status === "ACTIVE" && now > graceEnd) {
      await enqueueProvision({
        action: "suspend",
        serviceId: service.id,
        providerId: service.providerId,
      });
      metrics.servicesSuspended += 1;
      logger.info({ serviceId: service.id }, "Suspended service past grace");
    }
  }

  return metrics;
}

export async function processRenewalsSweep(_job: Job) {
  const startedAt = new Date();
  try {
    const metrics = await runRenewalsSweep();
    await persistCronRun({
      kind: "SWEEP",
      startedAt,
      status: "SUCCESS",
      metrics,
    });
    return metrics;
  } catch (err) {
    await persistCronRun({
      kind: "SWEEP",
      startedAt,
      status: "FAILED",
      metrics: emptyMetrics(),
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => undefined);
    throw err;
  }
}

/** Daily maintenance cron driven by settings. */
export async function processDailyCron(_job: Job) {
  const startedAt = new Date();
  const metrics = emptyMetrics();
  const now = new Date();
  const systemEmail = String(await getSetting("system.email", ""));
  try {
    const invoiceDueDays = Number(await getSetting("cron.invoiceDueDays", 7));
    const reminderDays = Number(await getSetting("cron.invoiceReminderDays", 3));
    const cancelDays = Number(
      await getSetting("cron.cancelPendingOrderDays", 7),
    );
    const deleteOverdueDays = Number(
      await getSetting("cron.deleteOverdueDays", 14),
    );
    const emailLogDays = Number(
      await getSetting("cron.deleteEmailLogsDays", 90),
    );
    const closeTicketDays = Number(await getSetting("cron.closeTicketDays", 7));

    // Invoice reminders
    const reminderBefore = new Date(now);
    reminderBefore.setDate(reminderBefore.getDate() + reminderDays);
    const dueSoon = await prisma.invoice.findMany({
      where: {
        status: "UNPAID",
        dueAt: { lte: reminderBefore, gte: now },
      },
      include: { client: true },
      take: 200,
    });
    for (const inv of dueSoon) {
      await enqueueEmail({
        to: inv.client.email,
        subject: `Reminder: invoice ${inv.number} due soon`,
        template: "invoice",
        payload: {
          invoiceNumber: inv.number,
          clientName: inv.client.name,
          total: formatMoney(inv.total, inv.currency),
          currency: inv.currency,
        },
      }).catch(() => undefined);
    }

    // invoiceDueDays is applied in renewals sweep (create invoices X days before nextDueAt)
    void invoiceDueDays;

    const cancelBefore = new Date(now);
    cancelBefore.setDate(cancelBefore.getDate() - cancelDays);
    await prisma.order.updateMany({
      where: { status: "PENDING", createdAt: { lte: cancelBefore } },
      data: { status: "CANCELLED" },
    });

    const deleteBefore = new Date(now);
    deleteBefore.setDate(deleteBefore.getDate() - deleteOverdueDays);
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: "UNPAID",
        dueAt: { lte: deleteBefore },
        serviceId: { not: null },
      },
      include: { service: true },
      take: 100,
    });
    for (const inv of overdueInvoices) {
      if (inv.serviceId) {
        await enqueueProvision({
          action: "terminate",
          serviceId: inv.serviceId,
          providerId: inv.service?.providerId,
        }).catch(() => undefined);
        await prisma.service.update({
          where: { id: inv.serviceId },
          data: { status: "TERMINATED", nextDueAt: null },
        });
        metrics.servicesTerminated += 1;
      }
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: "VOID" },
      });
    }

    const logBefore = new Date(now);
    logBefore.setDate(logBefore.getDate() - emailLogDays);
    await prisma.emailLog.deleteMany({
      where: { createdAt: { lte: logBefore } },
    });

    const ticketBefore = new Date(now);
    ticketBefore.setDate(ticketBefore.getDate() - closeTicketDays);
    const openTickets = await prisma.ticket.findMany({
      where: {
        status: { not: "CLOSED" },
        updatedAt: { lte: ticketBefore },
      },
      take: 200,
    });
    for (const ticket of openTickets) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "CLOSED" },
      });
      metrics.ticketsClosed += 1;
    }

    // Keep services nextDue advancing after paid renewals handled elsewhere
    void addInterval;

    // Nested sweep persists its own SWEEP CronRun with invoice/suspend counts
    await processRenewalsSweep(_job);

    await persistCronRun({
      kind: "DAILY",
      startedAt,
      status: "SUCCESS",
      metrics,
    });

    logger.info("Daily cron completed");
  } catch (err) {
    logger.error({ err }, "Daily cron failed");
    await persistCronRun({
      kind: "DAILY",
      startedAt,
      status: "FAILED",
      metrics,
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => undefined);
    if (systemEmail) {
      await enqueueEmail({
        to: systemEmail,
        subject: "Cron job failure",
        template: "welcome",
        payload: { name: "Admin", error: String(err) },
      }).catch(() => undefined);
    }
    throw err;
  }
}
