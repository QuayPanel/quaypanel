"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent } from "@/components/ui/card";
import { slugify } from "@/src/core/utils";

type Article = {
  id: string;
  number: number;
  title: string;
  slug: string;
  shortDescription: string;
  body: string;
  published: boolean;
  sortOrder: number;
  categoryId: string | null;
};

type CategoryNode = {
  id: string;
  name: string;
  children: CategoryNode[];
};

type TreeResponse = {
  categories: CategoryNode[];
};

type KnowledgeArticleFormProps = {
  mode: "create" | "edit";
  articleId?: string;
};

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth });
    out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

export function KnowledgeArticleFormPage({
  mode,
  articleId,
}: KnowledgeArticleFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiQuery<Article>(
    ["knowledge", articleId ?? "new"],
    `/api/v1/knowledge/${articleId}`,
    { enabled: mode === "edit" && Boolean(articleId) },
  );
  const { data: tree } = useApiQuery<TreeResponse>(
    ["knowledge", "tree"],
    "/api/v1/knowledge/tree",
  );
  const categoryOptions = useMemo(
    () => flattenCategories(tree?.categories ?? []),
    [tree?.categories],
  );

  const [slugManual, setSlugManual] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    shortDescription: "",
    body: "",
    published: false,
    categoryId: "",
  });

  useEffect(() => {
    if (mode !== "create") return;
    const categoryId = new URLSearchParams(window.location.search).get(
      "categoryId",
    );
    if (categoryId) {
      setForm((prev) => ({ ...prev, categoryId }));
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit" || !data) return;
    setSlugManual(true);
    setForm({
      title: data.title,
      slug: data.slug,
      shortDescription: data.shortDescription ?? "",
      body: data.body,
      published: data.published,
      categoryId: data.categoryId ?? "",
    });
  }, [mode, data]);

  function setTitle(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugManual ? prev.slug : slugify(title),
    }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        shortDescription: form.shortDescription.trim(),
        body: form.body,
        published: form.published,
        categoryId: form.categoryId || null,
      };
      if (mode === "edit" && articleId) {
        return apiFetch<Article>(`/api/v1/knowledge/${articleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Article>("/api/v1/knowledge", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (article) => {
      toast.success(mode === "edit" ? "Article saved" : "Article created");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      if (mode === "create") {
        router.push(`/admin/knowledge/${article.number}`);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["knowledge", articleId],
        });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (mode === "edit" && isLoading) {
    return (
      <PageMotion>
        <p className="text-muted-foreground">Loading...</p>
      </PageMotion>
    );
  }

  if (mode === "edit" && !data) {
    return (
      <PageMotion>
        <p className="text-destructive">Article not found</p>
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/knowledge">← Back</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === "edit" ? "Edit article" : "New article"}
          </h1>
        </div>
        <Button
          onClick={() => {
            if (!form.title.trim()) {
              toast.error("Title is required");
              return;
            }
            if (!form.body.trim()) {
              toast.error("Body is required");
              return;
            }
            save.mutate();
          }}
          disabled={save.isPending}
        >
          {save.isPending
            ? "Saving..."
            : mode === "edit"
              ? "Save"
              : "Create article"}
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label required>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setForm({
                    ...form,
                    slug: slugify(e.target.value, { keepTrailingDash: true }),
                  });
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Short description</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={form.shortDescription}
              onChange={(e) =>
                setForm({ ...form, shortDescription: e.target.value })
              }
              placeholder="Shown on the articles list"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Uncategorized</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {"—".repeat(opt.depth)} {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
              />
              Published
            </label>
          </div>
          <MarkdownEditor
            label="Body"
            value={form.body}
            onChange={(v) => setForm({ ...form, body: v })}
          />
          <Button
            variant="outline"
            onClick={() => router.push("/admin/knowledge")}
          >
            Back to list
          </Button>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
