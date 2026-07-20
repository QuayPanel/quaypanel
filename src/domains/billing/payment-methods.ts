import Stripe from "stripe";
import { prisma } from "@/src/db/client";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/src/core/errors";

export type ClientPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

async function getStripeForClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");

  const config = await prisma.gatewayConfig.findUnique({
    where: { gatewayId: "stripe" },
  });
  if (!config?.enabled) {
    throw new AppError("Stripe is not enabled", 400, "GATEWAY_DISABLED");
  }

  const cfg = (config.config ?? {}) as Record<string, string>;
  if (!cfg.secretKey) {
    throw new AppError("Stripe is not configured", 400, "GATEWAY_DISABLED");
  }

  return {
    stripe: new Stripe(cfg.secretKey),
    client,
  };
}

async function assertPaymentMethodOwnedByClient(
  stripe: Stripe,
  client: { stripeCustomerId: string | null; defaultPaymentMethodId: string | null },
  paymentMethodId: string,
) {
  if (!client.stripeCustomerId) {
    throw new ValidationError("No saved payment profile yet");
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== client.stripeCustomerId) {
    throw new ForbiddenError();
  }

  return paymentMethod;
}

export async function listClientPaymentMethods(
  clientId: string,
): Promise<ClientPaymentMethod[]> {
  const { stripe, client } = await getStripeForClient(clientId);
  if (!client.stripeCustomerId) return [];

  const methods = await stripe.paymentMethods.list({
    customer: client.stripeCustomerId,
    type: "card",
  });

  return methods.data.map((method) => ({
    id: method.id,
    brand: method.card?.brand ?? "unknown",
    last4: method.card?.last4 ?? "????",
    expMonth: method.card?.exp_month ?? 0,
    expYear: method.card?.exp_year ?? 0,
    isDefault: client.defaultPaymentMethodId === method.id,
  }));
}

export async function setDefaultPaymentMethod(
  clientId: string,
  paymentMethodId: string,
) {
  const { stripe, client } = await getStripeForClient(clientId);
  await assertPaymentMethodOwnedByClient(stripe, client, paymentMethodId);

  await stripe.customers.update(client.stripeCustomerId!, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { defaultPaymentMethodId: paymentMethodId },
  });

  return { ok: true as const };
}

export async function removePaymentMethod(
  clientId: string,
  paymentMethodId: string,
) {
  const { stripe, client } = await getStripeForClient(clientId);
  await assertPaymentMethodOwnedByClient(stripe, client, paymentMethodId);

  await stripe.paymentMethods.detach(paymentMethodId);

  if (client.defaultPaymentMethodId === paymentMethodId) {
    await prisma.client.update({
      where: { id: clientId },
      data: { defaultPaymentMethodId: null },
    });
  }

  return { ok: true as const };
}
