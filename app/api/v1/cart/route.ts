import { z } from "zod";
import { withApi, jsonOk } from "@/src/core/api";
import { requireAuth } from "@/src/auth/session";
import {
  cartLineSchema,
  clearServerCart,
  getServerCart,
  replaceServerCart,
} from "@/src/domains/cart/service";

const syncSchema = z.object({
  guestKey: z.string().optional(),
  lines: z.array(cartLineSchema).optional(),
});

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const guestKey = new URL(req.url).searchParams.get("guestKey");
    if (auth?.clientId) {
      return jsonOk(await getServerCart({ clientId: auth.clientId }));
    }
    return jsonOk(await getServerCart({ guestKey }));
  });
}

export async function PUT(request: Request) {
  return withApi(request, async ({ auth }) => {
    const body = syncSchema.parse(await request.json());
    if (auth?.clientId) {
      return jsonOk(
        await replaceServerCart(
          { clientId: auth.clientId },
          body.lines ?? [],
        ),
      );
    }
    return jsonOk(
      await replaceServerCart({ guestKey: body.guestKey }, body.lines ?? []),
    );
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const guestKey = new URL(req.url).searchParams.get("guestKey");
    if (auth?.clientId) {
      return jsonOk(await clearServerCart({ clientId: auth.clientId }));
    }
    return jsonOk(await clearServerCart({ guestKey }));
  });
}
