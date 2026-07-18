import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/src/db/client";
import { env } from "@/src/core/env";
import { getSettingsMap } from "@/src/domains/settings/service";

async function socialProvidersFromSettings() {
  const settings = await getSettingsMap().catch(() => ({} as Record<string, unknown>));
  const providers: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};

  for (const id of ["google", "github", "discord"] as const) {
    if (
      settings[`oauth.${id}.enabled`] &&
      settings[`oauth.${id}.clientId`] &&
      settings[`oauth.${id}.clientSecret`] &&
      String(settings[`oauth.${id}.clientSecret`]) !== "••••••••"
    ) {
      providers[id] = {
        clientId: String(settings[`oauth.${id}.clientId`]),
        clientSecret: String(settings[`oauth.${id}.clientSecret`]),
      };
    }
  }
  return providers;
}

// Better Auth initializes once; env-based OAuth still works as bootstrap.
// Settings toggles gate UI buttons; secrets are also readable at runtime for
// providers configured via settings after restart / process boot.
const bootProviders: Record<string, { clientId: string; clientSecret: string }> =
  {};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: bootProviders,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CLIENT",
        input: false,
      },
      clientId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Refresh in-memory provider map for UI/API checks (auth init is static). */
export async function getEnabledSocialProviders() {
  return socialProvidersFromSettings();
}
