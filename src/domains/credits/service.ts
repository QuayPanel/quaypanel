import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { getSetting } from "@/src/domains/settings/service";
import { writeAuditLog } from "@/src/domains/audit/service";

export const creditDepositSchema = z.object({
  clientId: z.string().min(1),
  amountMinor: z.number().int().positive(),
});

export async function getCreditBalance(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");
  return client.creditBalanceMinor;
}

export async function listCreditLedger(clientId: string) {
  return prisma.creditTransaction.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function depositCredits(
  data: z.infer<typeof creditDepositSchema>,
  actorId?: string,
) {
  const enabled = Boolean(await getSetting("credits.enabled", false));
  if (!enabled) throw new ValidationError("Credits system is disabled");

  const min = Number(await getSetting("credits.minDeposit", 500));
  const max = Number(await getSetting("credits.maxDeposit", 100000));
  const maxBalance = Number(await getSetting("credits.maxBalance", 500000));

  if (data.amountMinor < min || data.amountMinor > max) {
    throw new ValidationError("Deposit amount outside allowed range");
  }

  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
  });
  if (!client) throw new NotFoundError("Client not found");
  if (client.creditBalanceMinor + data.amountMinor > maxBalance) {
    throw new ValidationError("Deposit would exceed maximum credit balance");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.client.update({
      where: { id: data.clientId },
      data: { creditBalanceMinor: { increment: data.amountMinor } },
    });
    await tx.creditTransaction.create({
      data: {
        clientId: data.clientId,
        amountMinor: data.amountMinor,
        type: "DEPOSIT",
        note: "Credit deposit",
      },
    });
    return c;
  });

  await writeAuditLog({
    actorId,
    action: "credits.deposit",
    entityType: "client",
    entityId: data.clientId,
    metadata: { amountMinor: data.amountMinor },
  });

  return updated;
}

/** Apply credits to an amount; returns remaining due and credits used. */
export async function applyCreditsToAmount(
  clientId: string,
  amountDue: number,
  ref?: { refType: string; refId: string },
) {
  const enabled = Boolean(await getSetting("credits.enabled", false));
  const autoUse = Boolean(await getSetting("credits.autoUse", true));
  if (!enabled || !autoUse || amountDue <= 0) {
    return { remaining: amountDue, used: 0 };
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.creditBalanceMinor <= 0) {
    return { remaining: amountDue, used: 0 };
  }

  const used = Math.min(client.creditBalanceMinor, amountDue);
  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: { creditBalanceMinor: { decrement: used } },
    });
    await tx.creditTransaction.create({
      data: {
        clientId,
        amountMinor: -used,
        type: "PURCHASE",
        note: "Applied to order",
        refType: ref?.refType,
        refId: ref?.refId,
      },
    });
  });

  return { remaining: amountDue - used, used };
}

export async function creditOnDowngrade(
  clientId: string,
  amountMinor: number,
  serviceId: string,
  actorId?: string,
) {
  const enabled = Boolean(await getSetting("credits.enabled", false));
  const onDowngrade = Boolean(await getSetting("credits.onDowngrade", true));
  if (!enabled || !onDowngrade || amountMinor <= 0) return null;

  const maxBalance = Number(await getSetting("credits.maxBalance", 500000));
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");

  const credit = Math.min(
    amountMinor,
    Math.max(0, maxBalance - client.creditBalanceMinor),
  );
  if (credit <= 0) return null;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.client.update({
      where: { id: clientId },
      data: { creditBalanceMinor: { increment: credit } },
    });
    await tx.creditTransaction.create({
      data: {
        clientId,
        amountMinor: credit,
        type: "DOWNGRADE",
        note: "Service downgrade credit",
        refType: "service",
        refId: serviceId,
      },
    });
    return c;
  });

  await writeAuditLog({
    actorId,
    action: "credits.downgrade",
    entityType: "service",
    entityId: serviceId,
    metadata: { amountMinor: credit },
  });

  return updated;
}

export async function creditOnRefund(
  clientId: string,
  amountMinor: number,
  paymentId: string,
  actorId?: string,
) {
  if (amountMinor <= 0) return null;

  const maxBalance = Number(await getSetting("credits.maxBalance", 500000));
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");

  const credit = Math.min(
    amountMinor,
    Math.max(0, maxBalance - client.creditBalanceMinor),
  );
  if (credit <= 0) return null;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.client.update({
      where: { id: clientId },
      data: { creditBalanceMinor: { increment: credit } },
    });
    await tx.creditTransaction.create({
      data: {
        clientId,
        amountMinor: credit,
        type: "REFUND",
        note: "Payment refund credit",
        refType: "payment",
        refId: paymentId,
      },
    });
    return c;
  });

  await writeAuditLog({
    actorId,
    action: "credits.refund",
    entityType: "payment",
    entityId: paymentId,
    metadata: { amountMinor: credit },
  });

  return updated;
}
