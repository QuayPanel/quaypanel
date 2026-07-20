import { headers } from "next/headers";
import { getSetting } from "@/src/domains/settings/service";
import { ValidationError } from "@/src/core/errors";

export type CaptchaProvider =
  | "disabled"
  | "recaptcha_v2"
  | "recaptcha_v3"
  | "turnstile"
  | "hcaptcha";

export async function getCaptchaProvider(): Promise<CaptchaProvider> {
  const provider = String(await getSetting("captcha.provider", "disabled"));
  if (
    provider === "recaptcha_v2" ||
    provider === "recaptcha_v3" ||
    provider === "turnstile" ||
    provider === "hcaptcha"
  ) {
    return provider;
  }
  return "disabled";
}

export async function isCaptchaEnabled() {
  return (await getCaptchaProvider()) !== "disabled";
}

export async function verifyCaptcha(token: string | undefined, ip?: string) {
  const provider = await getCaptchaProvider();
  if (provider === "disabled") return;

  if (!token) throw new ValidationError("Captcha verification required");

  const secret = String(await getSetting("captcha.secret", ""));
  if (!secret) throw new ValidationError("Captcha is misconfigured");

  let url = "";
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  switch (provider) {
    case "recaptcha_v2":
    case "recaptcha_v3":
      url = "https://www.google.com/recaptcha/api/siteverify";
      break;
    case "turnstile":
      url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
      break;
    case "hcaptcha":
      url = "https://hcaptcha.com/siteverify";
      break;
    default:
      return;
  }

  const res = await fetch(url, { method: "POST", body });
  const json = (await res.json()) as { success?: boolean; score?: number };
  if (!json.success) throw new ValidationError("Captcha verification failed");
  if (provider === "recaptcha_v3" && (json.score ?? 0) < 0.5) {
    throw new ValidationError("Captcha score too low");
  }
}

export function clientIpFromRequest(
  request: Request,
  trustedProxies: string[],
): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && trustedProxies.length > 0) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.headers.get("x-real-ip")?.trim() || undefined;
}

export async function resolveClientIp(request?: Request) {
  const trustedRaw = await getSetting("security.trustedProxies", []);
  const trusted = Array.isArray(trustedRaw)
    ? trustedRaw.map(String).filter(Boolean)
    : [];

  if (request) {
    return clientIpFromRequest(request, trusted);
  }

  const h = await headers();
  if (trusted.length > 0) {
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim();
  }
  return h.get("x-real-ip")?.trim() || undefined;
}

/** Verify captcha when enabled. Pass the request for accurate client IP. */
export async function requireCaptcha(
  token: string | undefined,
  request?: Request,
) {
  await verifyCaptcha(token, await resolveClientIp(request));
}
