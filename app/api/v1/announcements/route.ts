import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  announcementCreateSchema,
  createAnnouncement,
  listAnnouncements,
} from "@/src/domains/announcements/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    return jsonOk(await listAnnouncements());
  });
}

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const body = announcementCreateSchema.parse(await request.json());
    return jsonOk(await createAnnouncement(body, ctx.userId), { status: 201 });
  });
}
