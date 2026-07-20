import type { AuthContext } from "@/src/auth/session";
import { ForbiddenError } from "@/src/core/errors";
import { prisma } from "@/src/db/client";
import type { Role } from "@/src/generated/prisma/client";
import { PERMISSIONS, type PermissionKey } from "@/src/auth/permission-keys";

export { PERMISSIONS, type PermissionKey } from "@/src/auth/permission-keys";

export function parseUserPermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export async function loadUserPermissions(userId: string, role: Role) {
  if (role === "ADMIN") return [...PERMISSIONS];
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true },
  });
  return parseUserPermissions(user?.permissions);
}

export async function requirePermission(
  ctx: AuthContext | null,
  key: PermissionKey,
): Promise<AuthContext> {
  if (!ctx) throw new ForbiddenError();
  if (ctx.role !== "ADMIN" && ctx.role !== "STAFF") {
    throw new ForbiddenError();
  }
  if (ctx.role === "ADMIN") return ctx;

  const permissions =
    ctx.permissions ?? (await loadUserPermissions(ctx.userId, ctx.role));
  if (!permissions.includes(key)) {
    throw new ForbiddenError(`Missing permission: ${key}`);
  }
  return ctx;
}

export async function hasPermission(
  ctx: AuthContext,
  key: PermissionKey,
): Promise<boolean> {
  if (ctx.role === "ADMIN") return true;
  if (ctx.role !== "STAFF") return false;
  const permissions =
    ctx.permissions ?? (await loadUserPermissions(ctx.userId, ctx.role));
  return permissions.includes(key);
}
