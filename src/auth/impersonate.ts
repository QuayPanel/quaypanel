import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/src/core/env";

const COOKIE_NAME = "qp_impersonate";
const MAX_AGE_SEC = 60 * 60; // 1 hour

type ImpersonatePayload = {
  clientId: string;
  adminUserId: string;
  exp: number;
};

function sign(value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(value).digest("hex");
}

function encode(payload: ImpersonatePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): ImpersonatePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || sig !== expected) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ImpersonatePayload;
    if (!payload.clientId || !payload.adminUserId || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setImpersonateCookie(
  clientId: string,
  adminUserId: string,
) {
  const token = encode({
    clientId,
    adminUserId,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearImpersonateCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function readImpersonateFromHeaders(
  headerCookies: string | null,
): Promise<ImpersonatePayload | null> {
  if (!headerCookies) return null;
  const match = headerCookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  return decode(token);
}

export async function readImpersonateCookie(): Promise<ImpersonatePayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}
