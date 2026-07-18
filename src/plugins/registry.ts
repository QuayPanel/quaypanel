import { prisma } from "@/src/db/client";
import { AppError } from "@/src/core/errors";
import type { PaymentGateway } from "@/src/plugins/payments/types";
import type { ProvisioningProvider } from "@/src/plugins/provisioning/types";
import { createStripeGateway } from "@/src/plugins/payments/stripe";
import { createPayPalGateway } from "@/src/plugins/payments/paypal";
import { noopProvisioningProvider } from "@/src/plugins/provisioning/noop";
import { createPterodactylProvider } from "@/src/plugins/provisioning/pterodactyl";
import { proxmoxProvisioningProvider } from "@/src/plugins/provisioning/proxmox";

const paymentGateways = new Map<string, PaymentGateway>();
const provisioningProviders = new Map<string, ProvisioningProvider>();

provisioningProviders.set(noopProvisioningProvider.id, noopProvisioningProvider);
provisioningProviders.set("pterodactyl", createPterodactylProvider());
provisioningProviders.set(
  proxmoxProvisioningProvider.id,
  proxmoxProvisioningProvider,
);

export function registerPaymentGateway(gateway: PaymentGateway) {
  paymentGateways.set(gateway.id, gateway);
}

export function registerProvisioningProvider(provider: ProvisioningProvider) {
  provisioningProviders.set(provider.id, provider);
}

export async function loadBuiltInGateways() {
  const configs = await prisma.gatewayConfig.findMany();
  paymentGateways.clear();

  for (const config of configs) {
    if (!config.enabled) continue;
    const cfg = (config.config ?? {}) as Record<string, string>;

    if (config.gatewayId === "stripe" && cfg.secretKey) {
      registerPaymentGateway(
        createStripeGateway({
          secretKey: cfg.secretKey,
          webhookSecret: cfg.webhookSecret ?? "",
        }),
      );
    }

    if (config.gatewayId === "paypal" && cfg.clientId && cfg.clientSecret) {
      registerPaymentGateway(
        createPayPalGateway({
          clientId: cfg.clientId,
          clientSecret: cfg.clientSecret,
          mode: (cfg.mode as "sandbox" | "live") || "sandbox",
        }),
      );
    }
  }
}

export function getPaymentGateway(id: string): PaymentGateway {
  const gateway = paymentGateways.get(id);
  if (!gateway) {
    throw new AppError(`Payment gateway "${id}" is not enabled`, 400, "GATEWAY_DISABLED");
  }
  return gateway;
}

export function listPaymentGateways(): PaymentGateway[] {
  return Array.from(paymentGateways.values());
}

export function getProvisioningProvider(id: string): ProvisioningProvider {
  return provisioningProviders.get(id) ?? noopProvisioningProvider;
}

export function listProvisioningProviders(): ProvisioningProvider[] {
  return Array.from(provisioningProviders.values());
}
