import { prisma } from "@/src/db/client";
import { AppError } from "@/src/core/errors";
import type { PaymentGateway } from "@/src/plugins/payments/types";
import type { ProvisioningProvider } from "@/src/plugins/provisioning/types";
import { createStripeGateway } from "@/src/plugins/payments/stripe";
import { createPayPalGateway } from "@/src/plugins/payments/paypal";
import { noopProvisioningProvider } from "@/src/plugins/provisioning/noop";
import { createPterodactylProvider } from "@/src/plugins/provisioning/pterodactyl";
import { proxmoxProvisioningProvider } from "@/src/plugins/provisioning/proxmox";

type GatewayMeta = { external?: boolean; addonId?: string };
type ProviderMeta = { external?: boolean; addonId?: string };

const paymentGateways = new Map<string, PaymentGateway>();
const paymentGatewayMeta = new Map<string, GatewayMeta>();
const provisioningProviders = new Map<string, ProvisioningProvider>();
const provisioningProviderMeta = new Map<string, ProviderMeta>();

provisioningProviders.set(noopProvisioningProvider.id, noopProvisioningProvider);
provisioningProviderMeta.set(noopProvisioningProvider.id, {});
provisioningProviders.set("pterodactyl", createPterodactylProvider());
provisioningProviderMeta.set("pterodactyl", {});
provisioningProviders.set(
  proxmoxProvisioningProvider.id,
  proxmoxProvisioningProvider,
);
provisioningProviderMeta.set(proxmoxProvisioningProvider.id, {});

export function registerPaymentGateway(
  gateway: PaymentGateway,
  meta: GatewayMeta = {},
) {
  paymentGateways.set(gateway.id, gateway);
  paymentGatewayMeta.set(gateway.id, meta);
}

export function registerProvisioningProvider(
  provider: ProvisioningProvider,
  meta: ProviderMeta = {},
) {
  provisioningProviders.set(provider.id, provider);
  provisioningProviderMeta.set(provider.id, meta);
}

export function clearExternalPaymentGateways() {
  for (const [id, meta] of paymentGatewayMeta) {
    if (meta.external) {
      paymentGateways.delete(id);
      paymentGatewayMeta.delete(id);
    }
  }
}

export function clearExternalProvisioningProviders() {
  for (const [id, meta] of provisioningProviderMeta) {
    if (meta.external) {
      provisioningProviders.delete(id);
      provisioningProviderMeta.delete(id);
    }
  }
}

export async function loadBuiltInGateways() {
  const configs = await prisma.gatewayConfig.findMany();

  // Drop built-in Stripe/PayPal; keep external addon gateways until plugin reload.
  for (const id of ["stripe", "paypal"]) {
    if (!paymentGatewayMeta.get(id)?.external) {
      paymentGateways.delete(id);
      paymentGatewayMeta.delete(id);
    }
  }

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

  try {
    const { reloadEnabledPlugins } = await import("@/src/addons/plugin-loader");
    await reloadEnabledPlugins();
  } catch {
    /* addons optional during early boot */
  }
}

export function getPaymentGateway(id: string): PaymentGateway {
  const gateway = paymentGateways.get(id);
  if (!gateway) {
    throw new AppError(
      `Payment gateway "${id}" is not enabled`,
      400,
      "GATEWAY_DISABLED",
    );
  }
  return gateway;
}

export function listPaymentGateways(): PaymentGateway[] {
  return Array.from(paymentGateways.values());
}

export function listPaymentGatewayIds(): string[] {
  return Array.from(paymentGateways.keys());
}

export function getProvisioningProvider(id: string): ProvisioningProvider {
  return provisioningProviders.get(id) ?? noopProvisioningProvider;
}

export function listProvisioningProviders(): ProvisioningProvider[] {
  return Array.from(provisioningProviders.values());
}
