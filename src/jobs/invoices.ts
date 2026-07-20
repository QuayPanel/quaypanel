import type { Job } from "bullmq";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";
import { enqueueEmail } from "@/src/core/queue";
import { formatMoney } from "@/src/core/utils";
import { createServicesFromPaidOrder } from "@/src/domains/services/service";
import {
  recordAffiliateCommission,
  resolveAffiliateCodeForClient,
  resolveAffiliateCodeForService,
} from "@/src/domains/affiliates/service";
import { getSetting } from "@/src/domains/settings/service";
import { addInterval } from "@/src/domains/billing/pricing";
import { incrementCouponUses } from "@/src/domains/coupons/service";

export type InvoicePaidJobData = {
  invoiceId: string;
  paymentId: string;
};

export async function processInvoicePaidJob(job: Job<InvoicePaidJobData>) {
  const { invoiceId, paymentId } = job.data;
  logger.info({ invoiceId, paymentId }, "Processing invoice paid job");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      items: true,
      order: true,
      service: true,
    },
  });

  if (!invoice) {
    logger.warn({ invoiceId }, "Invoice not found for paid job");
    return;
  }

  await enqueueEmail({
    to: invoice.client.email,
    subject: `Payment received — Invoice ${invoice.number}`,
    template: "receipt",
    payload: {
      invoiceNumber: invoice.number,
      clientName: invoice.client.name,
      total: formatMoney(invoice.total, invoice.currency),
      currency: invoice.currency,
    },
  });

  if (invoice.couponId) {
    await incrementCouponUses(invoice.couponId).catch(() => undefined);
  }

  if (invoice.orderId && !invoice.serviceId) {
    await createServicesFromPaidOrder(invoice.orderId);
    if (invoice.order?.affiliateCode) {
      await recordAffiliateCommission({
        affiliateCode: invoice.order.affiliateCode,
        orderId: invoice.orderId,
        invoiceId: invoice.id,
        referredClientId: invoice.clientId,
        orderTotal: invoice.total,
      });
    }
  }

  if (invoice.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: invoice.serviceId },
    });
    if (service && service.status !== "TERMINATED") {
      await prisma.service.update({
        where: { id: service.id },
        data: {
          status: service.status === "SUSPENDED" ? "ACTIVE" : service.status,
          nextDueAt: addInterval(
            service.nextDueAt ?? new Date(),
            service.billingCycle,
          ),
        },
      });
    }

    const repeatEarnings = Boolean(
      await getSetting("affiliates.repeatEarnings", false),
    );
    if (repeatEarnings) {
      const affiliateCode =
        (await resolveAffiliateCodeForService(invoice.serviceId)) ||
        (await resolveAffiliateCodeForClient(invoice.clientId));
      if (affiliateCode) {
        await recordAffiliateCommission({
          affiliateCode,
          invoiceId: invoice.id,
          referredClientId: invoice.clientId,
          orderTotal: invoice.total,
        });
      }
    }
  }
}
