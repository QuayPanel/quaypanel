import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.coerce.date().optional(),
});

function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function createApiKey(
  userId: string,
  data: z.infer<typeof apiKeyCreateSchema>,
  actorId?: string,
) {
  const raw = `qp_${randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(raw);
  const keyPrefix = raw.slice(0, 10);

  const apiKey = await prisma.apiKey.create({
    data: {
      name: data.name,
      keyPrefix,
      keyHash,
      scopes: data.scopes ?? [],
      userId,
      expiresAt: data.expiresAt,
    },
  });

  await writeAuditLog({
    actorId: actorId ?? userId,
    action: "api_key.create",
    entityType: "api_key",
    entityId: apiKey.id,
  });

  return {
    ...apiKey,
    key: raw,
  };
}

export async function revokeApiKey(id: string, userId: string, actorId?: string) {
  const existing = await prisma.apiKey.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError("API key not found");
  await prisma.apiKey.delete({ where: { id } });
  await writeAuditLog({
    actorId: actorId ?? userId,
    action: "api_key.revoke",
    entityType: "api_key",
    entityId: id,
  });
}
