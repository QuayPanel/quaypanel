import { z } from "zod";
import { withApi, jsonOk } from "@/src/core/api";
import {
  ANNOUNCEMENT_AUDIENCES,
  listActiveAnnouncements,
} from "@/src/domains/announcements/service";
import { getSetting } from "@/src/domains/settings/service";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const url = new URL(request.url);
    const audience = z
      .enum(ANNOUNCEMENT_AUDIENCES)
      .parse(url.searchParams.get("audience") ?? "client");

    const maintenanceMessage = String(
      await getSetting("status.maintenanceMessage", ""),
    ).trim();

    const announcements = await listActiveAnnouncements(audience);

    return jsonOk({
      announcements,
      maintenanceMessage: maintenanceMessage || null,
    });
  });
}
