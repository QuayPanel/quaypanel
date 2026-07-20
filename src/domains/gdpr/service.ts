import { z } from "zod";
import { prisma } from "@/src/db/client";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

export const gdprRequestCreateSchema = z.object({
  type: z.enum(["EXPORT", "DELETE"]),
});

export async function listGdprRequests(status?: string) {
  const where =
    status && status !== "all"
      ? { status: status as "PENDING" | "COMPLETED" | "REJECTED" }
      : undefined;
  return prisma.gdprRequest.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, email: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listClientGdprRequests(clientId: string) {
  return prisma.gdprRequest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createGdprRequest(
  clientId: string,
  data: z.infer<typeof gdprRequestCreateSchema>,
) {
  const parsed = gdprRequestCreateSchema.parse(data);
  const pending = await prisma.gdprRequest.findFirst({
    where: { clientId, status: "PENDING" },
  });
  if (pending) {
    throw new ConflictError("You already have a pending privacy request");
  }

  return prisma.gdprRequest.create({
    data: {
      clientId,
      type: parsed.type,
      status: "PENDING",
    },
  });
}

async function buildClientExportPayload(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      users: { select: { id: true, email: true, name: true, role: true } },
      orders: {
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
      invoices: {
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { items: true, payments: true },
      },
      services: {
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { plan: { include: { product: true } } },
      },
      tickets: {
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { messages: true },
      },
      creditLedger: { take: 100, orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function completeGdprRequest(
  id: string,
  actorId?: string,
  note?: string,
) {
  const request = await prisma.gdprRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("GDPR request not found");
  if (request.status !== "PENDING") {
    throw new ValidationError("Request is not pending");
  }

  if (request.type === "EXPORT") {
    const payload = await buildClientExportPayload(request.clientId);
    const updated = await prisma.gdprRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        note: note ?? null,
        payload: payload as object,
      },
    });
    await writeAuditLog({
      actorId,
      action: "gdpr.complete",
      entityType: "gdpr_request",
      entityId: id,
      metadata: { type: "EXPORT" },
    });
    return updated;
  }

  const updated = await prisma.gdprRequest.update({
    where: { id },
    data: {
      status: "COMPLETED",
      note: note ?? null,
    },
  });

  await writeAuditLog({
    actorId,
    action: "gdpr.complete",
    entityType: "gdpr_request",
    entityId: id,
    metadata: { type: "DELETE" },
  });

  return updated;
}

export async function rejectGdprRequest(
  id: string,
  actorId?: string,
  note?: string,
) {
  const request = await prisma.gdprRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("GDPR request not found");
  if (request.status !== "PENDING") {
    throw new ValidationError("Request is not pending");
  }

  const updated = await prisma.gdprRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      note: note ?? null,
    },
  });

  await writeAuditLog({
    actorId,
    action: "gdpr.reject",
    entityType: "gdpr_request",
    entityId: id,
  });

  return updated;
}

export async function assertClientOwnsRequest(
  requestId: string,
  clientId: string,
) {
  const request = await prisma.gdprRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("GDPR request not found");
  if (request.clientId !== clientId) throw new ForbiddenError();
  return request;
}
