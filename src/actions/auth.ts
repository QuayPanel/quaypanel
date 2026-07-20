"use server";

import { z } from "zod";
import { auth } from "@/src/auth/auth";
import { prisma } from "@/src/db/client";
import { createClient } from "@/src/domains/clients/service";
import { enqueueEmail } from "@/src/core/queue";
import { headers } from "next/headers";
import { getSetting } from "@/src/domains/settings/service";
import { ValidationError } from "@/src/core/errors";
import { acceptTermsForClient, getTermsPage } from "@/src/domains/legal/service";

const registerSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    phone: z.string().min(1),
    company: z.string().optional(),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
    acceptedTerms: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function registerClientAction(
  input: z.infer<typeof registerSchema>,
) {
  if (Boolean(await getSetting("auth.disableRegistration", false))) {
    throw new ValidationError("Registration is disabled");
  }

  const data = registerSchema.parse(input);

  const terms = await getTermsPage().catch(() => null);
  if (terms?.published) {
    if (!data.acceptedTerms) {
      throw new ValidationError("Please agree to the Terms of Service");
    }
  }

  const legacyTermsUrl = String(
    (await getSetting("legal.termsUrl", "")) ?? "",
  ).trim();
  if (!terms?.published && legacyTermsUrl && !data.acceptedTerms) {
    throw new ValidationError("Please agree to the Terms of Service");
  }

  const name = `${data.firstName} ${data.lastName}`.trim();

  const client = await createClient({
    name,
    email: data.email,
    company: data.company || undefined,
    phone: data.phone,
    address1: data.address1,
    address2: data.address2 || undefined,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
  });

  await auth.api.signUpEmail({
    body: {
      email: data.email,
      password: data.password,
      name,
    },
    headers: await headers(),
  });

  await prisma.user.update({
    where: { email: data.email },
    data: {
      role: "CLIENT",
      clientId: client.id,
    },
  });

  if (terms?.published && data.acceptedTerms) {
    await acceptTermsForClient(client.id);
  }

  await enqueueEmail({
    to: data.email,
    subject: "Welcome",
    template: "welcome",
    payload: { name },
  }).catch(() => undefined);

  return { ok: true };
}
