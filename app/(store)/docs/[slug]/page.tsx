"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";

type Article = {
  slug: string;
  title: string;
  body: string;
  published: boolean;
};

export default function DocsArticlePage() {
  const params = useParams<{ slug: string }>();
  const { data, isLoading, error } = useApiQuery<Article>(
    ["docs", params.slug],
    `/api/v1/knowledge/${params.slug}`,
  );

  return (
    <PageMotion>
      <article className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Link
          href="/docs"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Knowledge base
        </Link>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error || !data || !data.published ? (
          <p className="text-muted-foreground">Article not found.</p>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.title}
            </h1>
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <Markdown>{data.body}</Markdown>
            </div>
          </>
        )}
      </article>
    </PageMotion>
  );
}
