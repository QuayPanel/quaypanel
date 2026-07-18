import type { Job } from "bullmq";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";
import { getProvisioningProvider } from "@/src/plugins/registry";
import { markServiceProvisioned, updateServiceStatus } from "@/src/domains/services/service";

export type ProvisionJobData = {
  action: "provision" | "suspend" | "unsuspend" | "terminate";
  serviceId: string;
  orderId?: string;
  providerId?: string;
};

export async function processProvisionJob(job: Job<ProvisionJobData>) {
  const service = await prisma.service.findUnique({
    where: { id: job.data.serviceId },
    include: {
      client: true,
      plan: { include: { product: true } },
    },
  });
  if (!service) {
    logger.warn({ serviceId: job.data.serviceId }, "Service not found for provision job");
    return;
  }

  const providerId = job.data.providerId ?? service.providerId ?? "noop";
  const provider = getProvisioningProvider(providerId);
  const ctx = {
    serviceId: service.id,
    orderId: job.data.orderId,
    externalId: service.externalId ?? undefined,
    hostname: service.hostname ?? undefined,
    provisionConfig: (service.config ?? {}) as Record<string, unknown>,
    client: { email: service.client.email, name: service.client.name },
    metadata: {},
  };

  logger.info(
    { action: job.data.action, serviceId: service.id, providerId },
    "Processing provision job",
  );

  switch (job.data.action) {
    case "provision": {
      const result = await provider.provision(ctx);
      await markServiceProvisioned({
        serviceId: service.id,
        externalId: result?.externalId,
        hostname: result?.hostname,
      });
      break;
    }
    case "suspend":
      await provider.suspend(ctx);
      await updateServiceStatus(service.id, "SUSPENDED");
      break;
    case "unsuspend":
      await provider.unsuspend(ctx);
      await updateServiceStatus(service.id, "ACTIVE");
      break;
    case "terminate":
      await provider.terminate(ctx);
      await updateServiceStatus(service.id, "TERMINATED");
      break;
  }
}
