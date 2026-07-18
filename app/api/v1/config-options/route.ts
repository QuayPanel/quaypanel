import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  configOptionSaveSchema,
  createConfigOption,
  deleteConfigOptions,
  listConfigOptions,
} from "@/src/domains/config-options/service";
import { z } from "zod";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listConfigOptions());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = configOptionSaveSchema.parse(await request.json());
    return jsonOk(await createConfigOption(body, ctx.userId), { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = z
      .object({ ids: z.array(z.union([z.string(), z.number()])).min(1) })
      .parse(await request.json());
    return jsonOk(await deleteConfigOptions(body.ids, ctx.userId));
  });
}
