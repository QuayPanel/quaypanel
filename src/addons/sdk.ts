/**
 * Shared types for QuayPanel plugin/theme authors.
 * Import from `@/src/addons/sdk` when developing against this repo,
 * or copy these contracts into external addon packages.
 */

import type { PaymentGateway } from "@/src/plugins/payments/types";
import type { ProvisioningProvider } from "@/src/plugins/provisioning/types";

export type AddonHookName =
  | "order.paid"
  | "service.provision"
  | "invoice.created"
  | "client.register";

export type ThemeViewId =
  | "shell.store.header"
  | "shell.client.sidebar"
  | "shell.admin.sidebar"
  | "shell.footer"
  | "view.store.home"
  | "view.store.product"
  | "view.auth.login"
  | "view.client.dashboard"
  | "view.admin.dashboard"
  | (string & {});

export type ThemeComponent = React.ComponentType<Record<string, unknown>>;

export type PluginApi = {
  addonId: string;
  registerPaymentGateway: (gateway: PaymentGateway) => void;
  registerProvisioningProvider: (provider: ProvisioningProvider) => void;
  on: (
    hook: AddonHookName,
    handler: (payload: Record<string, unknown>) => void | Promise<void>,
  ) => void;
  getConfig: <T extends Record<string, unknown> = Record<string, unknown>>() => T;
};

export type ThemeApi = {
  themeId: string;
  registerView: (id: ThemeViewId, component: ThemeComponent) => void;
  setTokens: (tokens: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  }) => void;
};

export type PluginModule = {
  register: (api: PluginApi) => void | Promise<void>;
};

export type ThemeModule = {
  register?: (api: ThemeApi) => void | Promise<void>;
};

export type { PaymentGateway, ProvisioningProvider };
