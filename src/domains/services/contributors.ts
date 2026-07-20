import { z } from "zod";
import { prisma } from "@/src/db/client";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { createClient } from "@/src/domains/clients/service";
import { getService } from "@/src/domains/services/service";

export const inviteContributorSchema = z.object({
  email: z.string().email(),
  canPay: z.boolean().optional().default(true),
});

export async function listServiceContributors(serviceId: string) {
  return prisma.serviceContributor.findMany({
    where: { serviceId },
    include: {
      client: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function assertServiceOwner(serviceId: string, clientId: string) {
  const service = await getService(serviceId);
  if (service.clientId !== clientId) {
    throw new ForbiddenError("Only the service owner can manage contributors");
  }
  return service;
}

export async function inviteServiceContributor(
  serviceId: string,
  data: z.infer<typeof inviteContributorSchema>,
  actorClientId: string,
  actorUserId?: string,
) {
  const service = await assertServiceOwner(serviceId, actorClientId);
  const parsed = inviteContributorSchema.parse(data);
  const email = parsed.email.trim().toLowerCase();

  if (email === service.client.email.toLowerCase()) {
    throw new ValidationError("The service owner cannot be added as a contributor");
  }

  let contributorClient = await prisma.client.findUnique({ where: { email } });
  if (!contributorClient) {
    contributorClient = await createClient({
      name: email.split("@")[0] || email,
      email,
    });
  }

  if (contributorClient.id === service.clientId) {
    throw new ValidationError("The service owner cannot be added as a contributor");
  }

  const existing = await prisma.serviceContributor.findUnique({
    where: {
      serviceId_clientId: { serviceId, clientId: contributorClient.id },
    },
  });
  if (existing) {
    throw new ConflictError("This contributor is already invited");
  }

  const contributor = await prisma.serviceContributor.create({
    data: {
      serviceId,
      clientId: contributorClient.id,
      email,
      canPay: parsed.canPay ?? true,
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAuditLog({
    actorId: actorUserId,
    action: "service.contributor.invite",
    entityType: "service",
    entityId: serviceId,
    metadata: { email, canPay: contributor.canPay },
  });

  return contributor;
}

export async function revokeServiceContributor(
  serviceId: string,
  contributorId: string,
  actorClientId: string,
  actorUserId?: string,
) {
  await assertServiceOwner(serviceId, actorClientId);

  const contributor = await prisma.serviceContributor.findFirst({
    where: { id: contributorId, serviceId },
  });
  if (!contributor) throw new NotFoundError("Contributor not found");

  await prisma.serviceContributor.delete({ where: { id: contributor.id } });

  await writeAuditLog({
    actorId: actorUserId,
    action: "service.contributor.revoke",
    entityType: "service",
    entityId: serviceId,
    metadata: { contributorId, clientId: contributor.clientId },
  });

  return { ok: true };
}

export async function getContributorServiceIds(clientId: string) {
  const rows = await prisma.serviceContributor.findMany({
    where: { clientId },
    select: { serviceId: true, canPay: true },
  });
  return rows;
}
