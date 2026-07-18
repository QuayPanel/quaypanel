import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";

const cartLineSchema = z.object({
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  planId: z.string(),
  planName: z.string(),
  currency: z.string().default("USD"),
  quantity: z.number().int().positive().default(1),
  planPriceMinor: z.number().int().nonnegative(),
  setupFeeMinor: z.number().int().nonnegative().default(0),
  config: z.unknown().default([]),
  lineTotalMinor: z.number().int().nonnegative(),
});

async function getOrCreateCart(input: {
  clientId?: string | null;
  guestKey?: string | null;
}) {
  if (input.clientId) {
    const existing = await prisma.cart.findFirst({
      where: { clientId: input.clientId },
      include: { lines: true },
    });
    if (existing) return existing;
    return prisma.cart.create({
      data: { clientId: input.clientId },
      include: { lines: true },
    });
  }
  if (input.guestKey) {
    const existing = await prisma.cart.findUnique({
      where: { guestKey: input.guestKey },
      include: { lines: true },
    });
    if (existing) return existing;
    return prisma.cart.create({
      data: { guestKey: input.guestKey },
      include: { lines: true },
    });
  }
  throw new ValidationError("clientId or guestKey required");
}

export async function getServerCart(input: {
  clientId?: string | null;
  guestKey?: string | null;
}) {
  return getOrCreateCart(input);
}

export async function replaceServerCart(
  input: {
    clientId?: string | null;
    guestKey?: string | null;
  },
  lines: z.infer<typeof cartLineSchema>[],
) {
  const cart = await getOrCreateCart(input);
  await prisma.$transaction(async (tx) => {
    await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
    if (lines.length) {
      await tx.cartLine.createMany({
        data: lines.map((line) => ({
          cartId: cart.id,
          ...line,
          config: line.config as object,
        })),
      });
    }
  });
  return getOrCreateCart(input);
}

export async function clearServerCart(input: {
  clientId?: string | null;
  guestKey?: string | null;
}) {
  const cart = await getOrCreateCart(input);
  await prisma.cartLine.deleteMany({ where: { cartId: cart.id } });
  return getOrCreateCart(input);
}

export { cartLineSchema };
