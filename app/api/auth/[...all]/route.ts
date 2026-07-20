import { auth } from "@/src/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { isCaptchaEnabled, requireCaptcha } from "@/src/core/captcha";
import { AppError } from "@/src/core/errors";

const { GET, POST: authPost } = toNextJsHandler(auth);

export { GET };

function isAuthPath(pathname: string, suffix: string) {
  return pathname.replace(/\/$/, "").endsWith(suffix);
}

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;

  // Registration must go through registerClientAction (creates Client + captcha).
  if (isAuthPath(pathname, "/sign-up/email")) {
    return NextResponse.json(
      { message: "Please register via the registration form" },
      { status: 403 },
    );
  }

  if (isAuthPath(pathname, "/sign-in/email") && (await isCaptchaEnabled())) {
    let raw: Record<string, unknown>;
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    try {
      await requireCaptcha(
        typeof raw.captchaToken === "string" ? raw.captchaToken : undefined,
        request,
      );
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Captcha verification failed";
      return NextResponse.json({ message }, { status: 422 });
    }

    const { captchaToken: _token, ...rest } = raw;
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    return authPost(
      new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(rest),
      }),
    );
  }

  return authPost(request);
}
