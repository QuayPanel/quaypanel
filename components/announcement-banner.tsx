"use client";

import { useApiQuery } from "@/components/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
};

type ActiveResponse = {
  announcements: Announcement[];
  maintenanceMessage: string | null;
};

export function AnnouncementBanner({
  audience,
}: {
  audience: "client" | "store";
}) {
  const { data } = useApiQuery<ActiveResponse>(
    ["announcements-active", audience],
    `/api/v1/announcements/active?audience=${audience}`,
  );

  const maintenance = data?.maintenanceMessage;
  const announcements = data?.announcements ?? [];

  if (!maintenance && announcements.length === 0) return null;

  return (
    <div className="space-y-2 border-b bg-muted/40 px-6 py-3">
      {maintenance ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {maintenance}
        </div>
      ) : null}
      {announcements.map((item) => (
        <div
          key={item.id}
          className="rounded-md border bg-card px-4 py-2 text-sm"
        >
          <p className="font-medium">{item.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}
