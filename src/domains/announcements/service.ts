import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";

export const ANNOUNCEMENT_AUDIENCES = ["client", "store", "all"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const announcementCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES).default("client"),
  active: z.boolean().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

export const announcementUpdateSchema = announcementCreateSchema.partial();

export async function listAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getAnnouncement(id: string) {
  const row = await prisma.announcement.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Announcement not found");
  return row;
}

export async function createAnnouncement(
  data: z.infer<typeof announcementCreateSchema>,
  actorId?: string,
) {
  const parsed = announcementCreateSchema.parse(data);
  const row = await prisma.announcement.create({
    data: {
      title: parsed.title,
      body: parsed.body,
      audience: parsed.audience,
      active: parsed.active ?? true,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    },
  });

  await writeAuditLog({
    actorId,
    action: "announcement.create",
    entityType: "announcement",
    entityId: row.id,
  });

  return row;
}

export async function updateAnnouncement(
  id: string,
  data: z.infer<typeof announcementUpdateSchema>,
  actorId?: string,
) {
  await getAnnouncement(id);
  const parsed = announcementUpdateSchema.parse(data);

  const row = await prisma.announcement.update({
    where: { id },
    data: {
      title: parsed.title,
      body: parsed.body,
      audience: parsed.audience,
      active: parsed.active,
      startsAt:
        parsed.startsAt === undefined
          ? undefined
          : parsed.startsAt
            ? new Date(parsed.startsAt)
            : null,
      endsAt:
        parsed.endsAt === undefined
          ? undefined
          : parsed.endsAt
            ? new Date(parsed.endsAt)
            : null,
    },
  });

  await writeAuditLog({
    actorId,
    action: "announcement.update",
    entityType: "announcement",
    entityId: id,
  });

  return row;
}

export async function deleteAnnouncement(id: string, actorId?: string) {
  await getAnnouncement(id);
  await prisma.announcement.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "announcement.delete",
    entityType: "announcement",
    entityId: id,
  });
  return { ok: true };
}

export async function listActiveAnnouncements(audience: AnnouncementAudience) {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ audience }, { audience: "all" }] },
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}
