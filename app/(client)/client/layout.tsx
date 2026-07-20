import Link from "next/link";
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
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { SiteFooter } from "@/components/site-footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { LoginEventRecorder } from "@/components/login-event-recorder";
import { ImpersonationExitButton } from "@/components/impersonation-exit-button";
import { getSetting } from "@/src/domains/settings/service";

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

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <LoginEventRecorder />
      <aside className="border-r bg-card">
        <div className="flex h-16 items-center border-b px-5">
          <BrandMark
            name={brandName}
            logoUrl={logoUrl}
            logoDisplay={logoDisplay}
            href="/client"
            size="sm"
          />
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 p-3">
          <Button asChild variant="secondary" className="w-full">
            <Link href="/store">Browse store</Link>
          </Button>
        </div>
      </aside>
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
        <SiteFooter />
      </div>
    </div>
  );
}
