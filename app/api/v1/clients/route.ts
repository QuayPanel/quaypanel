import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  clientCreateSchema,
  createClient,
  listClients,
} from "@/src/domains/clients/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const clients = await listClients();
    return jsonOk(clients);
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = clientCreateSchema.parse(await request.json());
    const client = await createClient(body, ctx.userId);
    return jsonOk(client, { status: 201 });
  });
}
