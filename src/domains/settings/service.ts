import { prisma } from "@/src/db/client";
import { cacheDel, cacheGet, cacheSet, cacheKey } from "@/src/core/redis";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { z } from "zod";
import { env } from "@/src/core/env";
import {
  DEFAULT_MAIL_CSS,
  DEFAULT_MAIL_FOOTER,
  DEFAULT_MAIL_HEADER,
  DEFAULT_THEME_COLORS,
} from "@/src/domains/settings/defaults";

const SETTINGS_CACHE = cacheKey("settings", "all");

const SECRET_KEYS = new Set([
  "smtp.pass",
  "captcha.secret",
  "oauth.google.clientSecret",
  "oauth.github.clientSecret",
  "oauth.discord.clientSecret",
]);

export {
  DEFAULT_MAIL_CSS,
  DEFAULT_MAIL_FOOTER,
  DEFAULT_MAIL_HEADER,
  DEFAULT_THEME_COLORS,
} from "@/src/domains/settings/defaults";

export const settingsDefaults: Record<string, unknown> = {
  "brand.name": env.DEFAULT_BRAND_NAME || "QuayPanel",
  "app.timezone": "UTC",
  "app.url": env.BETTER_AUTH_URL || "http://localhost:3000",
  "brand.logoUrl": "",
  "brand.faviconUrl": "",
  "system.email": env.SMTP_FROM || "admin@example.com",
  "legal.termsUrl": "",
  currency: env.DEFAULT_CURRENCY || "USD",
  "currency.rates": { USD: 1, EUR: 0.92, GBP: 0.79 } as Record<string, number>,

  "captcha.provider": "disabled",
  "captcha.siteKey": "",
  "captcha.secret": "",
  "security.trustedProxies": [] as string[],

  "oauth.google.enabled": false,
  "oauth.google.clientId": "",
  "oauth.google.clientSecret": "",
  "oauth.github.enabled": false,
  "oauth.github.clientId": "",
  "oauth.github.clientSecret": "",
  "oauth.discord.enabled": false,
  "oauth.discord.clientId": "",
  "oauth.discord.clientSecret": "",

  "tax.enabled": false,
  "tax.rate": 0,
  "tax.type": "exclusive",

  "mail.requireVerifiedEmail": false,
  "smtp.host": env.SMTP_HOST || "",
  "smtp.port": env.SMTP_PORT || 587,
  "smtp.user": env.SMTP_USER || "",
  "smtp.pass": env.SMTP_PASS || "",
  "smtp.encryption": "tls",
  "smtp.from": env.SMTP_FROM || "noreply@example.com",
  "smtp.fromName": env.DEFAULT_BRAND_NAME || "QuayPanel",
  "mail.headerHtml": DEFAULT_MAIL_HEADER,
  "mail.footerHtml": DEFAULT_MAIL_FOOTER,
  "mail.css": DEFAULT_MAIL_CSS,

  "tickets.enabled": true,

  "cron.time": "00:00",
  "cron.invoiceDueDays": 7,
  "cron.invoiceReminderDays": 3,
  "cron.cancelPendingOrderDays": 7,
  "cron.suspendOverdueDays": 2,
  "cron.deleteOverdueDays": 14,
  "cron.deleteEmailLogsDays": 90,
  "cron.closeTicketDays": 7,

  "credits.enabled": false,
  "credits.minDeposit": 5,
  "credits.maxDeposit": 1000,
  "credits.maxBalance": 5000,
  "credits.autoUse": true,
  "credits.onDowngrade": true,

  "theme.id": "default",
  "theme.packages": [
    {
      id: "default",
      name: "Default",
      description: "Built-in QuayPanel theme",
    },
  ],
  "theme.directCheckout": false,
  "theme.smallImages": false,
  "theme.showCategoryDescription": true,
  "theme.logoDisplay": "logo_name",
  "theme.homeMarkdown": "## Welcome\n\nBrowse our products and get started.",
  "theme.colors.light": DEFAULT_THEME_COLORS.light,
  "theme.colors.dark": DEFAULT_THEME_COLORS.dark,

  "invoice.billTo": "",
  "invoice.nextNumber": 1,
  "invoice.numberPadding": 5,
  "invoice.numberFormat": "INV-{year}-{number}",
  "invoice.proforma": false,
  "invoice.snapshotOnPay": true,

  "ui.pageSize": 25,
  "app.debug": false,
  "auth.disableRegistration": false,

  "provisioning.pterodactyl": { enabled: false, baseUrl: "", apiKey: "" },
  "provisioning.proxmox": {
    enabled: false,
    baseUrl: "",
    apiKey: "",
    node: "pve",
  },
  "affiliates.defaultCommission": 10,
  "plugins.installed": [] as Array<{
    id: string;
    name: string;
    version?: string;
    enabled: boolean;
    source?: string;
  }>,
  "multiTenant.enabled": false,
  "multiTenant.defaultTenantId": "default",
};

const optionalString = z.string().optional().nullable();
const optionalBool = z.boolean().optional();
const optionalInt = z.number().int().optional();
const optionalNum = z.number().optional();

export const settingsUpdateSchema = z
  .object({
    "brand.name": z.string().min(1).optional(),
    "app.timezone": z.string().min(1).optional(),
    "app.url": z.string().optional(),
    "brand.logoUrl": optionalString,
    "brand.faviconUrl": optionalString,
    "system.email": z.string().email().optional().or(z.literal("")),
    "legal.termsUrl": optionalString,
    currency: z.string().length(3).optional(),
    "currency.rates": z.record(z.string(), z.number()).optional(),

    "captcha.provider": z
      .enum([
        "disabled",
        "recaptcha_v2",
        "recaptcha_v3",
        "turnstile",
        "hcaptcha",
      ])
      .optional(),
    "captcha.siteKey": optionalString,
    "captcha.secret": optionalString,
    "security.trustedProxies": z.array(z.string()).optional(),

    "oauth.google.enabled": optionalBool,
    "oauth.google.clientId": optionalString,
    "oauth.google.clientSecret": optionalString,
    "oauth.github.enabled": optionalBool,
    "oauth.github.clientId": optionalString,
    "oauth.github.clientSecret": optionalString,
    "oauth.discord.enabled": optionalBool,
    "oauth.discord.clientId": optionalString,
    "oauth.discord.clientSecret": optionalString,

    "tax.enabled": optionalBool,
    "tax.rate": optionalNum,
    "tax.type": z.enum(["inclusive", "exclusive"]).optional(),

    "mail.requireVerifiedEmail": optionalBool,
    "smtp.host": optionalString,
    "smtp.port": optionalInt,
    "smtp.user": optionalString,
    "smtp.pass": optionalString,
    "smtp.encryption": z.enum(["none", "tls", "ssl"]).optional(),
    "smtp.from": optionalString,
    "smtp.fromName": optionalString,
    "mail.headerHtml": optionalString,
    "mail.footerHtml": optionalString,
    "mail.css": optionalString,

    "tickets.enabled": optionalBool,

    "cron.time": z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    "cron.invoiceDueDays": optionalInt,
    "cron.invoiceReminderDays": optionalInt,
    "cron.cancelPendingOrderDays": optionalInt,
    "cron.suspendOverdueDays": optionalInt,
    "cron.deleteOverdueDays": optionalInt,
    "cron.deleteEmailLogsDays": optionalInt,
    "cron.closeTicketDays": optionalInt,

    "credits.enabled": optionalBool,
    "credits.minDeposit": optionalNum,
    "credits.maxDeposit": optionalNum,
    "credits.maxBalance": optionalNum,
    "credits.autoUse": optionalBool,
    "credits.onDowngrade": optionalBool,

    "theme.id": z.string().optional(),
    "theme.packages": z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    "theme.directCheckout": optionalBool,
    "theme.smallImages": optionalBool,
    "theme.showCategoryDescription": optionalBool,
    "theme.logoDisplay": z.enum(["none", "logo", "logo_name"]).optional(),
    "theme.homeMarkdown": optionalString,
    "theme.colors.light": z.record(z.string(), z.string()).optional(),
    "theme.colors.dark": z.record(z.string(), z.string()).optional(),

    "invoice.billTo": optionalString,
    "invoice.nextNumber": optionalInt,
    "invoice.numberPadding": optionalInt,
    "invoice.numberFormat": z.string().optional(),
    "invoice.proforma": optionalBool,
    "invoice.snapshotOnPay": optionalBool,

    "ui.pageSize": optionalInt,
    "app.debug": optionalBool,
    "auth.disableRegistration": optionalBool,

    "provisioning.pterodactyl": z.record(z.string(), z.unknown()).optional(),
    "provisioning.proxmox": z.record(z.string(), z.unknown()).optional(),
    "affiliates.defaultCommission": optionalInt,
    "plugins.installed": z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          version: z.string().optional(),
          enabled: z.boolean(),
          source: z.string().optional(),
        }),
      )
      .optional(),
    "multiTenant.enabled": optionalBool,
    "multiTenant.defaultTenantId": optionalString,
    // compat
    "billing.suspendDays": optionalInt,
  })
  .superRefine((data, ctx) => {
    const format = data["invoice.numberFormat"];
    if (format != null && !String(format).includes("{number}")) {
      ctx.addIssue({
        code: "custom",
        message: "Invoice number format must contain {number}",
        path: ["invoice.numberFormat"],
      });
    }
  });

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const PUBLIC_SETTING_KEYS = [
  "brand.name",
  "brand.logoUrl",
  "brand.faviconUrl",
  "legal.termsUrl",
  "app.url",
  "currency",
  "tax.enabled",
  "tax.rate",
  "tax.type",
  "tickets.enabled",
  "credits.enabled",
  "credits.minDeposit",
  "credits.maxDeposit",
  "theme.id",
  "theme.packages",
  "theme.directCheckout",
  "theme.smallImages",
  "theme.showCategoryDescription",
  "theme.logoDisplay",
  "theme.homeMarkdown",
  "theme.colors.light",
  "theme.colors.dark",
  "auth.disableRegistration",
  "captcha.provider",
  "captcha.siteKey",
  "oauth.google.enabled",
  "oauth.github.enabled",
  "oauth.discord.enabled",
  "ui.pageSize",
  "currency.rates",
] as const;

function migrateLegacy(map: Record<string, unknown>) {
  if (
    map["cron.suspendOverdueDays"] == null &&
    map["billing.suspendDays"] != null
  ) {
    map["cron.suspendOverdueDays"] = map["billing.suspendDays"];
  }

  // Credits limits used to be stored in cents; convert to dollars.
  const creditCentDefaults: Record<string, { cents: number; dollars: number }> =
    {
      "credits.minDeposit": { cents: 500, dollars: 5 },
      "credits.maxDeposit": { cents: 100000, dollars: 1000 },
      "credits.maxBalance": { cents: 500000, dollars: 5000 },
    };
  for (const [key, { cents, dollars }] of Object.entries(creditCentDefaults)) {
    if (Number(map[key]) === cents) {
      map[key] = dollars;
    }
  }

  // Custom cent configs: all three look like whole-cent amounts.
  const minDep = Number(map["credits.minDeposit"]);
  const maxDep = Number(map["credits.maxDeposit"]);
  const maxBal = Number(map["credits.maxBalance"]);
  if (
    Number.isInteger(minDep) &&
    minDep >= 100 &&
    Number.isInteger(maxDep) &&
    maxDep >= 10000 &&
    Number.isInteger(maxBal) &&
    maxBal >= 10000
  ) {
    map["credits.minDeposit"] = minDep / 100;
    map["credits.maxDeposit"] = maxDep / 100;
    map["credits.maxBalance"] = maxBal / 100;
  }

  return map;
}

export async function getSettingsMap(): Promise<Record<string, unknown>> {
  const cached = await cacheGet<Record<string, unknown>>(SETTINGS_CACHE);
  if (cached) return migrateLegacy({ ...settingsDefaults, ...cached });

  const rows = await prisma.setting.findMany();
  const map: Record<string, unknown> = { ...settingsDefaults };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  migrateLegacy(map);
  await cacheSet(SETTINGS_CACHE, map, 60);
  return map;
}

export async function getSetting<T = unknown>(
  key: string,
  fallback?: T,
): Promise<T> {
  const map = await getSettingsMap();
  if (key in map && map[key] !== undefined && map[key] !== null) {
    return map[key] as T;
  }
  if (key in settingsDefaults) return settingsDefaults[key] as T;
  return fallback as T;
}

export function maskSecrets(map: Record<string, unknown>) {
  const out = { ...map };
  for (const key of SECRET_KEYS) {
    const val = out[key];
    if (typeof val === "string" && val.length > 0) {
      out[key] = "••••••••";
      out[`${key}.set`] = true;
    } else {
      out[`${key}.set`] = false;
    }
  }
  return out;
}

export function getPublicSettings(map: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    out[key] = map[key] ?? settingsDefaults[key];
  }
  return out;
}

export async function updateSettings(values: SettingsUpdate) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (SECRET_KEYS.has(key) && value === "••••••••") continue;
    cleaned[key] = value;
  }

  if (
    cleaned["invoice.numberFormat"] != null &&
    !String(cleaned["invoice.numberFormat"]).includes("{number}")
  ) {
    throw new ValidationError("Invoice number format must contain {number}");
  }

  if (cleaned["billing.suspendDays"] != null) {
    cleaned["cron.suspendOverdueDays"] = cleaned["billing.suspendDays"];
  }

  for (const [key, value] of Object.entries(cleaned)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }
  await cacheDel(SETTINGS_CACHE);

  if (cleaned["cron.time"] != null || cleaned["app.timezone"] != null) {
    const { rescheduleCronJobs } = await import(
      "@/src/domains/cron-stats/reschedule"
    );
    await rescheduleCronJobs().catch(() => undefined);
  }

  return getSettingsMap();
}

export async function ensureSettingsDefaults() {
  for (const [key, value] of Object.entries(settingsDefaults)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
  }
}

export async function listGatewayConfigs() {
  return prisma.gatewayConfig.findMany({ orderBy: { gatewayId: "asc" } });
}

export async function updateGatewayConfig(
  gatewayId: string,
  data: { enabled?: boolean; config?: Record<string, unknown> },
) {
  const existing = await prisma.gatewayConfig.findUnique({
    where: { gatewayId },
  });
  if (!existing) throw new NotFoundError(`Gateway ${gatewayId} not found`);

  return prisma.gatewayConfig.update({
    where: { gatewayId },
    data: {
      enabled: data.enabled ?? existing.enabled,
      config: (data.config ?? existing.config) as object,
    },
  });
}
