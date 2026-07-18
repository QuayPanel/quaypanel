import Link from "next/link";
import { listCategories } from "@/src/domains/categories/service";
import { getSetting } from "@/src/domains/settings/service";

const QUAYPANEL_GITHUB = "https://github.com/QuayPanel";

export async function SiteFooter() {
  const [brandName, logoUrl, termsUrl, categories] = await Promise.all([
    getSetting("brand.name", "QuayPanel").then(String),
    getSetting("brand.logoUrl", "").then((v) => String(v ?? "").trim()),
    getSetting("legal.termsUrl", "").then((v) => String(v ?? "").trim()),
    listCategories(true),
  ]);

  const roots = categories.filter((c) => !c.parentId).slice(0, 8);

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={brandName}
                className="h-8 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <span className="text-lg font-semibold tracking-tight">
                {brandName}
              </span>
            )}
          </Link>
          <p className="text-sm text-muted-foreground">
            Billing, invoices, and services — powered by open source.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Explore</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link className="hover:text-foreground" href="/store">
                Store
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/login">
                Sign in
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/register">
                Register
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/docs">
                Knowledge base
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/client">
                Client area
              </Link>
            </li>
            {termsUrl ? (
              <li>
                <a
                  className="hover:text-foreground"
                  href={termsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms of Service
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Categories</p>
          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {roots.map((cat) => (
                <li key={cat.id}>
                  <Link
                    className="hover:text-foreground"
                    href={`/store/categories/${cat.slug}`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Project</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a
                className="hover:text-foreground"
                href={QUAYPANEL_GITHUB}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {brandName}
          </p>
          <p>
            Powered by{" "}
            <a
              href={QUAYPANEL_GITHUB}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              QuayPanel
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
