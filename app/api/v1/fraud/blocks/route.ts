import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  createFraudBlock,
  fraudBlockCreateSchema,
  listFraudBlocks,
} from "@/src/domains/fraud/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listFraudBlocks());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = fraudBlockCreateSchema.parse(await request.json());
    return jsonOk(await createFraudBlock(body, ctx.userId), { status: 201 });
  });
}
