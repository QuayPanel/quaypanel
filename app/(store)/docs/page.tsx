"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { useDeferredSearch } from "@/components/use-deferred-search";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Article = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  category?: { id: string; name: string; slug: string } | null;
};

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
  articles: Article[];
};

type TreeResponse = {
  categories: CategoryNode[];
  uncategorized: Article[];
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Link className="hover:underline" href={`/docs/${article.slug}`}>
            {article.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {article.category ? (
          <p className="text-xs text-muted-foreground">
            {article.category.name}
          </p>
        ) : null}
        {article.shortDescription ? (
          <p className="text-sm text-muted-foreground">
            {article.shortDescription}
          </p>
        ) : null}
        <Link
          className="text-sm text-primary hover:underline"
          href={`/docs/${article.slug}`}
        >
          Read article
        </Link>
      </CardContent>
    </Card>
  );
}

function CategorySection({
  node,
  depth = 0,
}: {
  node: CategoryNode;
  depth?: number;
}) {
  return (
    <section
      className="space-y-3"
      style={{ marginLeft: depth > 0 ? Math.min(depth, 3) * 12 : 0 }}
    >
      <div>
        <h2
          className={
            depth === 0 ? "text-xl font-semibold" : "text-lg font-medium"
          }
        >
          {node.name}
        </h2>
      </div>
      {node.articles.length > 0 ? (
        <div className="space-y-3">
          {node.articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : null}
      {node.children.map((child) => (
        <CategorySection key={child.id} node={child} depth={depth + 1} />
      ))}
    </section>
  );
}

export default function DocsIndexPage() {
  const {
    input: search,
    setInput: setSearch,
    query: q,
    searching,
    onKeyDown: onSearchKeyDown,
  } = useDeferredSearch();

  const treeQuery = useApiQuery<TreeResponse>(
    ["docs-public", "tree"],
    "/api/v1/knowledge/tree?public=1",
    { enabled: !searching },
  );
  const searchQuery = useApiQuery<Article[]>(
    ["docs-public", "search", q],
    `/api/v1/knowledge?public=1&q=${encodeURIComponent(q)}`,
    { enabled: searching },
  );

  const tree = treeQuery.data;
  const isLoading = searching ? searchQuery.isLoading : treeQuery.isLoading;
  const results = searchQuery.data ?? [];

  const hasContent = useMemo(() => {
    if (!tree) return false;
    return tree.categories.length > 0 || tree.uncategorized.length > 0;
  }, [tree]);

  return (
    <PageMotion>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Knowledge base
          </h1>
          <p className="mt-2 text-muted-foreground">
            Guides and answers for getting the most out of your services.
          </p>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search articles…"
        />

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : searching ? (
          results.length === 0 ? (
            <p className="text-muted-foreground">No articles match “{q}”.</p>
          ) : (
            <div className="space-y-3">
              {results.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )
        ) : !hasContent ? (
          <p className="text-muted-foreground">No articles published yet.</p>
        ) : (
          <div className="space-y-8">
            {tree?.categories.map((node) => (
              <CategorySection key={node.id} node={node} />
            ))}
            {tree && tree.uncategorized.length > 0 ? (
              <section className="space-y-3">
                {tree.categories.length > 0 ? (
                  <h2 className="text-xl font-semibold">Other articles</h2>
                ) : null}
                {tree.uncategorized.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </PageMotion>
  );
}
