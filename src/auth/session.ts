import { headers } from "next/headers";
import { auth } from "@/src/auth/auth";
import type { Role } from "@/src/generated/prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/src/core/errors";
import { prisma } from "@/src/db/client";
import { createHash } from "crypto";
import { ensureUserClient } from "@/src/domains/clients/ensure-user-client";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  via: "session" | "api_key";
};

export async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return null;

  const clientId = await ensureUserClient(user);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId,
    via: "session" as const,
  };
}

function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function resolveAuthFromRequest(
  request: Request,
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    const keyHash = hashApiKey(raw);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });
    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    const clientId = await ensureUserClient(apiKey.user);

    return {
      userId: apiKey.user.id,
      email: apiKey.user.email,
      name: apiKey.user.name,
      role: apiKey.user.role,
      clientId,
      via: "api_key",
    };
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return null;

  const clientId = await ensureUserClient(user);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId,
    via: "session",
  };
}

export function requireAuth(ctx: AuthContext | null): AuthContext {
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export function requireRole(
  ctx: AuthContext | null,
  roles: Role[],
): AuthContext {
  const authCtx = requireAuth(ctx);
  if (!roles.includes(authCtx.role)) {
    throw new ForbiddenError();
  }
  return authCtx;
}

export function requireStaff(ctx: AuthContext | null) {
  return requireRole(ctx, ["ADMIN", "STAFF"]);
}

export function requireAdmin(ctx: AuthContext | null) {
  return requireRole(ctx, ["ADMIN"]);
}

export function isStaffRole(role: Role) {
  return role === "ADMIN" || role === "STAFF";
}

/** Client portal requests send `X-Quay-Portal: client`. */
export function isClientPortalRequest(request: Request) {
  return request.headers.get("x-quay-portal") === "client";
}

/**
 * When true, the requester should only see/act on their own linked client.
 * Pure CLIENT users always; staff only while in the client portal.
 */
export function useOwnClientScope(ctx: AuthContext, request: Request) {
  if (ctx.role === "CLIENT") return true;
  return isClientPortalRequest(request) && Boolean(ctx.clientId);
}

export function requireOwnClientId(ctx: AuthContext): string {
  if (!ctx.clientId) {
    throw new ForbiddenError("No client account linked");
  }
  return ctx.clientId;
}
