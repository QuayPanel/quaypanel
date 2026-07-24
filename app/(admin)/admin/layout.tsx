import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  CreditCard,
  Settings,
  ScrollText,
  KeyRound,
  Tags,
  Ticket,
  Server,
  Percent,
  Handshake,
  SlidersHorizontal,
  Boxes,
  Timer,
  BookOpen,
  Palette,
  Puzzle,
  Mail,
  Inbox,
  ShieldAlert,
  Shield,
  Megaphone,
  BarChart3,
  Workflow,
  Send,
} from "lucide-react";
import { getSessionUser } from "@/src/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { AdminSidebar } from "@/components/shells/admin-sidebar";
import { getSetting } from "@/src/domains/settings/service";
import {
  ensureThemeLoaded,
  getThemeView,
} from "@/src/addons/theme-runtime";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Clients",
    links: [
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/services", label: "Services", icon: Server },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/products", label: "Products", icon: Package },
      {
        href: "/admin/config-options",
        label: "Config Options",
        icon: SlidersHorizontal,
      },
      { href: "/admin/providers", label: "Providers", icon: Boxes },
    ],
  },
  {
    label: "Billing",
    links: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/quotes", label: "Quotes", icon: FileText },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/coupons", label: "Coupons", icon: Percent },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Support",
    links: [
      { href: "/admin/tickets", label: "Tickets", icon: Ticket },
      { href: "/admin/affiliates", label: "Affiliates", icon: Handshake },
      { href: "/admin/knowledge", label: "Knowledge base", icon: BookOpen },
      { href: "/admin/fraud", label: "Fraud & review", icon: ShieldAlert },
      { href: "/admin/gdpr", label: "GDPR", icon: Shield },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/mail-campaigns", label: "Mail campaigns", icon: Send },
      { href: "/admin/automation", label: "Automation", icon: Workflow },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/staff", label: "Staff", icon: Users },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/email-templates", label: "Email templates", icon: Mail },
      { href: "/admin/email-logs", label: "Email logs", icon: Inbox },
      { href: "/admin/themes", label: "Themes", icon: Palette },
      { href: "/admin/plugins", label: "Plugins", icon: Puzzle },
      { href: "/admin/cron", label: "Cron", icon: Timer },
      { href: "/admin/api-keys", label: "API Keys", icon: KeyRound },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    redirect("/login");
  }

  const ticketsEnabled = Boolean(await getSetting("tickets.enabled", true));
  const affiliatesEnabled = Boolean(
    await getSetting("affiliates.enabled", true),
  );
  const brand = String(await getSetting("brand.name", "QuayPanel"));
  const logoUrl = String(await getSetting("brand.logoUrl", "")).trim();
  const logoDisplay = String(
    await getSetting("theme.logoDisplay", "logo_name"),
  );
  const groups = navGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => {
        if (!ticketsEnabled && link.href === "/admin/tickets") return false;
        if (!affiliatesEnabled && link.href === "/admin/affiliates") {
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.links.length > 0);

  await ensureThemeLoaded().catch(() => undefined);
  const SidebarOverride = getThemeView("shell.admin.sidebar");
  const brandProps = { name: brand, logoUrl, logoDisplay };

  return (
    <div className="h-screen md:grid md:grid-cols-[240px_1fr]">
      {SidebarOverride ? (
        <SidebarOverride brand={brandProps} groups={groups} />
      ) : (
        <AdminSidebar brand={brandProps} groups={groups} />
      )}
      <div className="flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/70 px-6 backdrop-blur">
          <div className="text-sm text-muted-foreground">Admin</div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu email={user.email} role={user.role} portal="admin" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
