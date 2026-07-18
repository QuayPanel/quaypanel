import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { StoreHeader } from "@/components/store-header";
import { SiteFooter } from "@/components/site-footer";

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="hero-grid flex-1">
        <StoreHeader />

        <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-6 pb-24">
          <FadeIn>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Self-hosted billing
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl">
              QuayPanel
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
