import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/src/core/errors";
import { logger } from "@/src/core/logger";
import {
  resolveAuthFromRequest,
  type AuthContext,
} from "@/src/auth/session";
import { checkRateLimit, rateLimitKey } from "@/src/core/redis";

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export function jsonOk<T>(data: T, init?: ResponseInit & { meta?: Record<string, unknown> }) {
  const { meta, ...rest } = init ?? {};
  return NextResponse.json({ data, meta } satisfies ApiSuccess<T>, rest);
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.issues,
        },
      },
      { status: 422 },
    );
  }

  logger.error({ err: error }, "Unhandled API error");
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    },
    { status: fallbackStatus },
  );
}

export async function withApi(
  request: Request,
  handler: (ctx: {
    request: Request;
    auth: AuthContext | null;
  }) => Promise<Response>,
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await checkRateLimit(rateLimitKey("api", ip), 120, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "RATE_LIMITED", message: "Too many requests" },
        },
        { status: 429, headers: { "X-RateLimit-Remaining": "0" } },
      );
    }

    const auth = await resolveAuthFromRequest(request);
    return await handler({ request, auth });
  } catch (error) {
    return jsonError(error);
  }
}
