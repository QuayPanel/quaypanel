import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { enqueueEmail } from "@/src/core/queue";

export const ticketCreateSchema = z.object({
  clientId: z.string().min(1),
  subject: z.string().min(3),
  body: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const ticketReplySchema = z.object({
  body: z.string().min(1),
});

async function nextTicketNumber() {
  const count = await prisma.ticket.count();
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export async function listTickets(clientId?: string) {
  return prisma.ticket.findMany({
    where: clientId ? { clientId } : undefined,
    include: {
      client: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTicket(idOrNumber: string) {
  const decoded = decodeURIComponent(String(idOrNumber));
  const ticket = await prisma.ticket.findFirst({
    where: {
      OR: [{ id: decoded }, { number: decoded }],
    },
    include: {
      client: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

export async function createTicket(
  data: z.infer<typeof ticketCreateSchema>,
  authorUserId: string,
) {
  const number = await nextTicketNumber();
  const isStaff = false;
  const ticket = await prisma.ticket.create({
    data: {
      number,
      clientId: data.clientId,
      subject: data.subject,
      priority: data.priority,
      status: "OPEN",
      messages: {
        create: {
          authorUserId,
          body: data.body,
          isStaff,
        },
      },
    },
    include: { messages: true, client: true },
  });
  await writeAuditLog({
    actorId: authorUserId,
    action: "ticket.create",
    entityType: "ticket",
    entityId: ticket.id,
  });
  return ticket;
}

export async function replyToTicket(
  ticketIdOrNumber: string,
  authorUserId: string,
  body: string,
  isStaff: boolean,
) {
  const ticket = await getTicket(ticketIdOrNumber);
  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, authorUserId, body, isStaff },
  });
  const status = isStaff ? "ANSWERED" : "PENDING";
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status },
    include: { client: true },
  });

  if (isStaff) {
    await enqueueEmail({
      to: ticket.client.email,
      subject: `Ticket ${ticket.number} updated`,
      template: "welcome",
      payload: {
        name: ticket.client.name,
        message: `Staff replied to ticket ${ticket.number}: ${ticket.subject}`,
      },
    }).catch(() => undefined);
  }

  await writeAuditLog({
    actorId: authorUserId,
    action: "ticket.reply",
    entityType: "ticket",
    entityId: ticket.id,
  });

  return getTicket(updated.id);
}

export async function updateTicketStatus(
  idOrNumber: string,
  status: "OPEN" | "PENDING" | "ANSWERED" | "CLOSED",
  actorId?: string,
) {
  const existing = await getTicket(idOrNumber);
  const ticket = await prisma.ticket.update({
    where: { id: existing.id },
    data: { status },
  });
  await writeAuditLog({
    actorId,
    action: "ticket.status",
    entityType: "ticket",
    entityId: existing.id,
    metadata: { status },
  });
  return ticket;
}
