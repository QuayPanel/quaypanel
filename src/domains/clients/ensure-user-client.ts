import { prisma } from "@/src/db/client";
import { createClient } from "@/src/domains/clients/service";

/**
 * Ensure a user has a linked Client so staff can also use the client portal.
 * Idempotent — returns existing clientId when already linked.
 */
export async function ensureUserClient(user: {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
}): Promise<string> {
  if (user.clientId) return user.clientId;

  const byEmail = await prisma.client.findFirst({
    where: { email: user.email },
  });
  const client =
    byEmail ??
    (await createClient({
      name: user.name,
      email: user.email,
    }));

  await prisma.user.update({
    where: { id: user.id },
    data: { clientId: client.id },
  });

  return client.id;
}
