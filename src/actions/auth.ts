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
import { requireCaptcha } from "@/src/core/captcha";

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
    captchaToken: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export async function registerClientAction(
  input: z.infer<typeof registerSchema>,
) {
  if (Boolean(await getSetting("auth.disableRegistration", false))) {
    throw new ValidationError("Registration is disabled");
  }

  const data = registerSchema.parse(input);
  await requireCaptcha(data.captchaToken);

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

  // Establish session without a second captcha (token is single-use).
  await auth.api.signInEmail({
    body: {
      email: data.email,
      password: data.password,
    },
    headers: await headers(),
  });

  return { ok: true };
}

export async function loginClientAction(input: z.infer<typeof loginSchema>) {
  const data = loginSchema.parse(input);
  await requireCaptcha(data.captchaToken);

  const result = await auth.api.signInEmail({
    body: {
      email: data.email,
      password: data.password,
    },
    headers: await headers(),
  });

  return { ok: true, user: result.user };
}
