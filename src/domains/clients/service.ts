import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { isPublicNumberId } from "@/src/core/public-id";
import { writeAuditLog } from "@/src/domains/audit/service";
import { defaultTenantId, isMultiTenantEnabled, tenantWhere } from "@/src/core/tenant";

export const clientCreateSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  tenantId: z.string().optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  isAdmin: z.boolean().optional(),
});

/** Resolve client by public number (`1`) or internal cuid. */
export async function resolveClientId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (isPublicNumberId(raw)) {
    const client = await prisma.client.findUnique({
      where: { number: Number(raw) },
    });
    if (!client) throw new NotFoundError("Client not found");
    return client.id;
  }
  return raw;
}

export async function listClients() {
  const where = await tenantWhere();
  return prisma.client.findMany({
    where,
    orderBy: [{ number: "asc" }],
  });
}

export async function getClient(idOrNumber: string) {
  const id = await resolveClientId(idOrNumber);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!client) throw new NotFoundError("Client not found");
  const users = await linkedUsersForClient(client.id, client.email);
  return {
    ...client,
    isAdmin: users.some((u) => u.role === "ADMIN"),
    hasUserAccount: users.length > 0,
  };
}

export async function createClient(
  data: z.infer<typeof clientCreateSchema>,
  actorId?: string,
) {
  const payload = { ...data };
  if (!payload.tenantId && (await isMultiTenantEnabled())) {
    payload.tenantId = await defaultTenantId();
  }
  const client = await prisma.client.create({ data: payload });
  await writeAuditLog({
    actorId,
    action: "client.create",
    entityType: "client",
    entityId: client.id,
    metadata: { email: client.email, number: client.number },
  });
  return client;
}

async function linkedUsersForClient(clientId: string, email: string) {
  return prisma.user.findMany({
    where: {
      OR: [{ clientId }, { email }],
    },
    select: { id: true, role: true },
  });
}

export async function updateClient(
  idOrNumber: string,
  data: z.infer<typeof clientUpdateSchema>,
  actorId?: string,
) {
  const id = await resolveClientId(idOrNumber);
  const existing = await getClient(id);
  const { isAdmin, ...profile } = data;
  const client = await prisma.client.update({
    where: { id },
    data: profile,
  });

  if (isAdmin !== undefined) {
    const users = await linkedUsersForClient(id, client.email);

    if (isAdmin) {
      if (users.length === 0) {
        throw new ValidationError(
          "No user account is linked to this client yet. They must register or be invited before granting admin access.",
        );
      }
      await prisma.user.updateMany({
        where: { id: { in: users.map((u) => u.id) } },
        data: { role: "ADMIN" },
      });
    } else {
      const admins = users.filter((u) => u.role === "ADMIN");
      if (admins.length > 0) {
        if (actorId && admins.some((u) => u.id === actorId)) {
          throw new ValidationError("You cannot remove your own admin access");
        }
        const adminCount = await prisma.user.count({
          where: { role: "ADMIN" },
        });
        if (adminCount <= admins.length) {
          throw new ValidationError("Cannot remove the last admin");
        }
        await prisma.user.updateMany({
          where: {
            id: { in: admins.map((u) => u.id) },
            role: "ADMIN",
          },
          data: { role: "CLIENT" },
        });
      }
    }
  }

  await writeAuditLog({
    actorId,
    action: "client.update",
    entityType: "client",
    entityId: client.id,
    metadata:
      isAdmin !== undefined
        ? { isAdmin, previousIsAdmin: existing.isAdmin }
        : undefined,
  });
  return getClient(id);
}

export async function deleteClient(idOrNumber: string, actorId?: string) {
  const id = await resolveClientId(idOrNumber);
  await getClient(id);
  await prisma.client.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "client.delete",
    entityType: "client",
    entityId: id,
  });
  return { ok: true };
}
