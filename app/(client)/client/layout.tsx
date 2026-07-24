import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  UserRound,
  Server,
  Ticket,
  Handshake,
  Wallet,
  Coins,
} from "lucide-react";
import { getSessionUser } from "@/src/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { SiteFooter } from "@/components/site-footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { LoginEventRecorder } from "@/components/login-event-recorder";
import { ImpersonationExitButton } from "@/components/impersonation-exit-button";
import { ClientSidebar } from "@/components/shells/client-sidebar";
import { getSetting } from "@/src/domains/settings/service";
import {
  ensureThemeLoaded,
  getThemeView,
} from "@/src/addons/theme-runtime";

const links = [
  { href: "/client", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/services", label: "Services", icon: Server },
  { href: "/client/orders", label: "Orders", icon: ShoppingCart },
  { href: "/client/invoices", label: "Invoices", icon: FileText },
  { href: "/client/quotes", label: "Quotes", icon: FileText },
  { href: "/client/credits", label: "Credits", icon: Coins },
  { href: "/client/payment-methods", label: "Payment methods", icon: Wallet },
  { href: "/client/tickets", label: "Tickets", icon: Ticket },
  { href: "/client/affiliates", label: "Affiliates", icon: Handshake },
  { href: "/client/profile", label: "Account", icon: UserRound },
  { href: "/client/privacy", label: "Privacy", icon: UserRound },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || !user.clientId) {
    redirect("/login");
  }

  const [brandName, logoUrl, logoDisplay, affiliatesEnabled, ticketsEnabled, creditsEnabled] =
    await Promise.all([
      getSetting("brand.name", "QuayPanel").then(String),
      getSetting("brand.logoUrl", "").then((v) => String(v ?? "").trim()),
      getSetting("theme.logoDisplay", "logo_name").then(String),
      getSetting("affiliates.enabled", true).then(Boolean),
      getSetting("tickets.enabled", true).then(Boolean),
      getSetting("credits.enabled", false).then(Boolean),
    ]);

  const navLinks = links.filter((link) => {
    if (!affiliatesEnabled && link.href === "/client/affiliates") return false;
    if (!ticketsEnabled && link.href === "/client/tickets") return false;
    if (!creditsEnabled && link.href === "/client/credits") return false;
    return true;
  });

  await ensureThemeLoaded().catch(() => undefined);
  const SidebarOverride = getThemeView("shell.client.sidebar");
  const FooterOverride = getThemeView("shell.footer");
  const brand = { name: brandName, logoUrl, logoDisplay };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <LoginEventRecorder />
      {SidebarOverride ? (
        <SidebarOverride brand={brand} links={navLinks} />
      ) : (
        <ClientSidebar brand={brand} links={navLinks} />
      )}
      <div className="flex min-h-screen flex-col">
        <AnnouncementBanner audience="client" />
        <header className="flex h-16 items-center justify-between border-b bg-card/70 px-6">
          <div className="text-sm text-muted-foreground">
            Client area
            {user.impersonating ? (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                (impersonating)
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {user.impersonating ? <ImpersonationExitButton /> : null}
            <ThemeToggle />
            <AccountMenu email={user.email} role={user.role} portal="client" />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
        {FooterOverride ? <FooterOverride /> : <SiteFooter />}
      </div>
    </div>
  );
}
