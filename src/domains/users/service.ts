import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { PERMISSIONS, parseUserPermissions } from "@/src/auth/permissions";
import type { Role } from "@/src/generated/prisma/client";

export const staffPermissionsUpdateSchema = z.object({
  permissions: z.array(z.string()),
});

export async function listStaffUsers() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateStaffPermissions(
  userId: string,
  permissions: string[],
  actorId?: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (user.role !== "STAFF") {
    throw new ValidationError("Only STAFF users have editable permissions");
  }

  const allowed = new Set<string>(PERMISSIONS);
  const cleaned = permissions.filter((p) => allowed.has(p));

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { permissions: cleaned },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
    },
  });

  await writeAuditLog({
    actorId,
    action: "staff.permissions",
    entityType: "user",
    entityId: userId,
    metadata: { permissions: cleaned },
  });

  return {
    ...updated,
    permissions: parseUserPermissions(updated.permissions),
  };
}

export function staffUserPayload(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: unknown;
  createdAt?: Date;
}) {
  return {
    ...user,
    permissions:
      user.role === "ADMIN"
        ? [...PERMISSIONS]
        : parseUserPermissions(user.permissions),
  };
}
