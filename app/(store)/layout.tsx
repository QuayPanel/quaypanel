import { StoreHeader } from "@/components/store-header";
import { SiteFooter } from "@/components/site-footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { ThemeSlotServer } from "@/components/theme-slot-server";
import { getSetting } from "@/src/domains/settings/service";
import {
  ensureThemeLoaded,
  getThemeView,
} from "@/src/addons/theme-runtime";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [name, logoUrl, logoDisplay] = await Promise.all([
    getSetting("brand.name", "QuayPanel").then(String),
    getSetting("brand.logoUrl", "").then((v) => String(v ?? "").trim()),
    getSetting("theme.logoDisplay", "logo_name").then(String),
  ]);

  await ensureThemeLoaded().catch(() => undefined);
  const FooterOverride = getThemeView("shell.footer");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ThemeSlotServer
        id="shell.store.header"
        fallback={StoreHeader}
        brand={{ name, logoUrl, logoDisplay }}
      />
      <AnnouncementBanner audience="store" />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</div>
      {FooterOverride ? <FooterOverride /> : <SiteFooter />}
    </div>
  );
}
