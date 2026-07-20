import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

const DEFAULT_PAGES = [
  {
    slug: "terms",
    title: "Terms of Service",
    version: "1",
    body: `# Terms of Service

By using our services you agree to these terms. Replace this placeholder with your legal copy.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    version: "1",
    body: `# Privacy Policy

Describe how you collect, use, and protect customer data.`,
  },
  {
    slug: "aup",
    title: "Acceptable Use Policy",
    version: "1",
    body: `# Acceptable Use Policy

Describe prohibited uses of your services and infrastructure.`,
  },
] as const;

export const legalPageUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  published: z.boolean().optional(),
});

export async function ensureLegalPagesSeeded() {
  for (const page of DEFAULT_PAGES) {
    await prisma.legalPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        body: page.body,
        version: page.version,
        published: true,
      },
      update: {},
    });
  }
}

export async function listLegalPages(includeUnpublished = false) {
  await ensureLegalPagesSeeded();
  return prisma.legalPage.findMany({
    where: includeUnpublished ? undefined : { published: true },
    orderBy: { slug: "asc" },
  });
}

export async function getLegalPageBySlug(slug: string, staff = false) {
  await ensureLegalPagesSeeded();
  const page = await prisma.legalPage.findUnique({ where: { slug } });
  if (!page || (!staff && !page.published)) {
    throw new NotFoundError("Legal page not found");
  }
  return page;
}

export async function getTermsPage() {
  return getLegalPageBySlug("terms");
}

export async function updateLegalPage(
  slug: string,
  data: z.infer<typeof legalPageUpdateSchema>,
  actorId?: string,
) {
  const existing = await getLegalPageBySlug(slug, true);
  const parsed = legalPageUpdateSchema.parse(data);
  const updated = await prisma.legalPage.update({
    where: { id: existing.id },
    data: parsed,
  });
  await writeAuditLog({
    actorId,
    action: "legal_page.update",
    entityType: "legal_page",
    entityId: updated.id,
    metadata: { slug },
  });
  return updated;
}

export async function acceptTermsForClient(clientId: string) {
  const terms = await getTermsPage();
  return prisma.client.update({
    where: { id: clientId },
    data: {
      tosAcceptedAt: new Date(),
      tosVersion: terms.version,
    },
  });
}
