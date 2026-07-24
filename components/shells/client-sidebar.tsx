import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export type ClientNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function ClientSidebar({
  brand,
  links,
}: {
  brand: { name: string; logoUrl: string; logoDisplay: string };
  links: ClientNavLink[];
}) {
  return (
    <aside className="border-r bg-card">
      <div className="flex h-16 items-center border-b px-5">
        <BrandMark
          name={brand.name}
          logoUrl={brand.logoUrl}
          logoDisplay={brand.logoDisplay}
          href="/client"
          size="sm"
        />
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {links.map((link) => (
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
  );
}
