import { prisma } from "@/src/db/client";
import type { AuthContext } from "@/src/auth/session";
import type { Prisma } from "@/src/generated/prisma/client";

export async function writeAuditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      ipAddress: input.ipAddress,
    },
  });
}

export async function listAuditLogs(limit = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });
}

export function actorMeta(ctx: AuthContext) {
  return { actorId: ctx.userId };
}
