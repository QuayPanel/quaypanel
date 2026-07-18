import { getSetting } from "@/src/domains/settings/service";
import { ValidationError } from "@/src/core/errors";

export async function verifyCaptcha(token: string | undefined, ip?: string) {
  const provider = String(await getSetting("captcha.provider", "disabled"));
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
  return undefined;
}
