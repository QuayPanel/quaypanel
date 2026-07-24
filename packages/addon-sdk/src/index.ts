/**
 * QuayPanel addon authoring contracts.
 * Link from an addon package: `"@quaypanel/addon-sdk": "file:../path/to/quaypanel/packages/addon-sdk"`
 * Or develop inside the QuayPanel repo and import from `@/src/addons/sdk`.
 */

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

/** Minimal payment gateway surface expected by QuayPanel. */
export type PaymentGateway = {
  id: string;
  name: string;
  createCheckout(input: Record<string, unknown>): Promise<{
    checkoutUrl: string;
    externalId: string;
  }>;
  handleWebhook(
    req: Request,
    rawBody: string,
  ): Promise<Record<string, unknown>>;
  refund(
    externalPaymentId: string,
    amount?: number,
  ): Promise<Record<string, unknown>>;
  chargeCustomer?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export type ProvisioningProvider = {
  id: string;
  name: string;
  provision(ctx: Record<string, unknown>): Promise<{
    externalId?: string;
    hostname?: string;
  } | void>;
  suspend(ctx: Record<string, unknown>): Promise<void>;
  unsuspend(ctx: Record<string, unknown>): Promise<void>;
  terminate(ctx: Record<string, unknown>): Promise<void>;
};

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
