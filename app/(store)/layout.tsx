import { StoreHeader } from "@/components/store-header";
import { SiteFooter } from "@/components/site-footer";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StoreHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</div>
      <SiteFooter />
    </div>
  );
}
