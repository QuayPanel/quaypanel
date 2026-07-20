import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getLegalPageBySlug } from "@/src/domains/legal/service";

type Params = { params: Promise<{ slug: string }> };

export default async function LegalPage({ params }: Params) {
  const { slug } = await params;
  let page;
  try {
    page = await getLegalPageBySlug(slug);
  } catch {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold">{page.title}</h1>
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown>{page.body}</ReactMarkdown>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Version {page.version} · Updated{" "}
        {new Date(page.updatedAt).toLocaleDateString()}
      </p>
    </article>
  );
}
