import { getSetting } from "@/src/domains/settings/service";

/** When multi-tenant mode is on, return the tenant filter for Prisma `where`. */
export async function tenantWhere(explicitTenantId?: string | null) {
  const enabled = Boolean(await getSetting("multiTenant.enabled", false));
  if (!enabled) return {};
  const tenantId =
    explicitTenantId ||
    String(await getSetting("multiTenant.defaultTenantId", "default"));
  return { tenantId };
}

export async function isMultiTenantEnabled() {
  return Boolean(await getSetting("multiTenant.enabled", false));
}

export async function defaultTenantId() {
  return String(await getSetting("multiTenant.defaultTenantId", "default"));
}
