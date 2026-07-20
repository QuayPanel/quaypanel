export const PERMISSIONS = [
  "billing",
  "orders",
  "clients",
  "clients.impersonate",
  "services",
  "tickets",
  "settings",
  "fraud",
  "automation",
  "affiliates",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];
