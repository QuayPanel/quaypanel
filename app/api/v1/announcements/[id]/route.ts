import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  announcementUpdateSchema,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/src/domains/announcements/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    const body = announcementUpdateSchema.parse(await request.json());
    return jsonOk(await updateAnnouncement(id, body, ctx.userId));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withApi(request, async ({ auth }) => {
    const ctx = requireStaff(auth);
    const { id } = await params;
    return jsonOk(await deleteAnnouncement(id, ctx.userId));
  });
}
