import { z } from "zod";

export const pluginManifestSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(64),
  type: z.literal("plugin"),
  description: z.string().max(2000).optional(),
  entry: z.string().default("dist/index.js"),
  engines: z
    .object({
      quaypanel: z.string().optional(),
    })
    .optional(),
  provides: z.array(z.string()).default([]),
  permissions: z.array(z.string()).optional(),
  hooks: z.array(z.string()).optional(),
  configSchema: z.record(z.string(), z.unknown()).optional(),
});

export const themeManifestSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(64),
  type: z.literal("theme"),
  description: z.string().max(2000).optional(),
  entry: z.string().optional(),
  assets: z
    .object({
      css: z.array(z.string()).optional(),
    })
    .optional(),
  tokens: z
    .object({
      light: z.record(z.string(), z.string()).optional(),
      dark: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  overrides: z.array(z.string()).optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type ThemeManifest = z.infer<typeof themeManifestSchema>;
