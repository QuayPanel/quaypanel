import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAffiliateByCode } from "@/src/domains/affiliates/service";
import { getSetting } from "@/src/domains/settings/service";
import { env } from "@/src/core/env";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { code } = await params;
  try {
    await getAffiliateByCode(code);
  } catch {
    return NextResponse.redirect(new URL("/store", env.APP_URL));
  }

  const cookieDays = Number(await getSetting("affiliates.cookieDays", 30));
  const maxAge = Math.max(1, cookieDays) * 60 * 60 * 24;

  const jar = await cookies();
  jar.set("qp_aff", code.toLowerCase(), {
    path: "/",
    maxAge,
    sameSite: "lax",
    httpOnly: false,
  });

  return NextResponse.redirect(new URL("/store", env.APP_URL));
}
