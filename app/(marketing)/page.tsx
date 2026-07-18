import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { FadeIn } from "@/components/motion";
import { StoreHeader } from "@/components/store-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetting } from "@/src/domains/settings/service";

export default async function MarketingPage() {
  const [brandName, logoUrl, logoDisplay] = await Promise.all([
    getSetting("brand.name", "QuayPanel").then(String),
    getSetting("brand.logoUrl", "").then((v) => String(v ?? "").trim()),
    getSetting("theme.logoDisplay", "logo_name").then(String),
  ]);

  const brand = { name: brandName, logoUrl, logoDisplay };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="hero-grid flex-1">
        <StoreHeader brand={brand} />

        <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-6 pb-24">
          <FadeIn>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Self-hosted billing
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="max-w-4xl leading-[1.05] text-foreground">
              <BrandMark
                name={brandName}
                logoUrl={logoUrl}
                logoDisplay={logoDisplay}
                size="hero"
                asSpan
                className="flex-wrap"
              />
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A modern open-source billing panel for products, invoices, payments,
              and provisioning — free to self-host and extend.
            </p>
          </FadeIn>
          <FadeIn delay={0.24}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/store">Browse store</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Admin / client login</Link>
              </Button>
            </div>
          </FadeIn>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
