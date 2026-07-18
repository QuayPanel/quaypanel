import Link from "next/link";
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
} from "lucide-react";
import { getSessionUser } from "@/src/auth/session";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { getSetting } from "@/src/domains/settings/service";

const QUAYPANEL_GITHUB = "https://github.com/QuayPanel";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.295 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

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
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/coupons", label: "Coupons", icon: Percent },
    ],
  },
  {
    label: "Support",
    links: [
      { href: "/admin/tickets", label: "Tickets", icon: Ticket },
      { href: "/admin/affiliates", label: "Affiliates", icon: Handshake },
      { href: "/admin/knowledge", label: "Knowledge base", icon: BookOpen },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
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
  const brand = String(await getSetting("brand.name", "QuayPanel"));
  const logoUrl = String(await getSetting("brand.logoUrl", "")).trim();
  const logoDisplay = String(
    await getSetting("theme.logoDisplay", "logo_name"),
  );
  const groups = navGroups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) => ticketsEnabled || link.href !== "/admin/tickets",
      ),
    }))
    .filter((group) => group.links.length > 0);

  return (
    <div className="h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex h-screen flex-col border-r bg-card">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <BrandMark
            name={brand}
            logoUrl={logoUrl}
            logoDisplay={logoDisplay}
            href="/admin"
            size="sm"
          />
        </div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="shrink-0 space-y-1 border-t p-3">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            About
          </p>
          <a
            href={QUAYPANEL_GITHUB}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Powered by QuayPanel
          </p>
        </div>
      </aside>
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
