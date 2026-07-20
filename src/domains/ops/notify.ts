import { prisma } from "@/src/db/client";
import { getSetting } from "@/src/domains/settings/service";

type OpsNotifySetting =
  | "ops.notifyStaffOnOrder"
  | "ops.notifyStaffOnTicket"
  | "ops.notifyStaffOnFraud";

export async function notifyStaffIfEnabled(
  settingKey: OpsNotifySetting,
  subject: string,
  html: string,
) {
  const enabled = Boolean(await getSetting(settingKey, false));
  if (!enabled) return;

  const recipients = new Set<string>();
  const systemEmail = String(await getSetting("system.email", "")).trim();
  if (systemEmail) recipients.add(systemEmail);

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  for (const admin of admins) {
    if (admin.email) recipients.add(admin.email);
  }

  if (recipients.size === 0) return;

  const { sendBroadcastEmail } = await import("@/src/email/send");
  for (const to of recipients) {
    await sendBroadcastEmail({ to, subject, html }).catch(() => undefined);
  }
}
