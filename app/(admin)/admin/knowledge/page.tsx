"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { useDeferredSearch } from "@/components/use-deferred-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDialog } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/src/core/utils";

type Article = {
  id: string;
  number: number;
  slug: string;
  title: string;
  shortDescription: string;
  body?: string;
  published: boolean;
  publishedAt?: string | null;
  categoryId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
};

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children: CategoryNode[];
  articles: Article[];
};

type TreeResponse = {
  categories: CategoryNode[];
  uncategorized: Article[];
};

type CategoryOption = { id: string; name: string; depth: number };

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth });
    out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const next = [...ids];
  const from = next.indexOf(fromId);
  const to = next.indexOf(toId);
  if (from < 0 || to < 0) return ids;
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export default function AdminKnowledgePage() {
  const queryClient = useQueryClient();
  const {
    input: search,
    setInput: setSearch,
    query: q,
    searching,
    onKeyDown: onSearchKeyDown,
  } = useDeferredSearch();

  const treeQuery = useApiQuery<TreeResponse>(
    ["knowledge", "tree"],
    "/api/v1/knowledge/tree",
    { enabled: !searching },
  );
  const searchQuery = useApiQuery<Article[]>(
    ["knowledge", "search", q],
    `/api/v1/knowledge?q=${encodeURIComponent(q)}`,
    { enabled: searching },
  );

  const categoryOptions = useMemo(
    () => flattenCategories(treeQuery.data?.categories ?? []),
    [treeQuery.data?.categories],
  );

  const [categoryDialog, setCategoryDialog] = useState<{
    mode: "create" | "edit";
    parentId: string | null;
    category?: { id: string; name: string; parentId: string | null };
  } | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    parentId: "",
  });
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteArticleId, setDeleteArticleId] = useState<string | null>(null);

  const [dragPayload, setDragPayload] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
  }

  const saveCategory = useMutation({
    mutationFn: async () => {
      const payload = {
        name: categoryForm.name.trim(),
        parentId: categoryForm.parentId || null,
      };
      if (categoryDialog?.mode === "edit" && categoryDialog.category) {
        return apiFetch(`/api/v1/knowledge/categories/${categoryDialog.category.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/api/v1/knowledge/categories", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          parentId:
            categoryDialog?.mode === "create"
              ? categoryDialog.parentId
              : payload.parentId,
        }),
      });
    },
    onSuccess: () => {
      toast.success(
        categoryDialog?.mode === "edit" ? "Category saved" : "Category created",
      );
      setCategoryDialog(null);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/knowledge/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Category deleted");
      setDeleteCategoryId(null);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeArticle = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Article deleted");
      setDeleteArticleId(null);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorder = useMutation({
    mutationFn: (body: {
      type: "category" | "article";
      parentId: string | null;
      orderedIds: string[];
    }) =>
      apiFetch("/api/v1/knowledge/reorder", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(),
    onError: (err: Error) => toast.error(err.message),
  });

  const moveArticle = useMutation({
    mutationFn: (input: { id: string; categoryId: string | null }) =>
      apiFetch(`/api/v1/knowledge/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: input.categoryId,
          sortOrder: 0,
        }),
      }),
    onSuccess: () => {
      toast.success("Article moved");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreateCategory(parentId: string | null = null) {
    setCategoryForm({ name: "", parentId: parentId ?? "" });
    setCategoryDialog({ mode: "create", parentId });
  }

  function openEditCategory(cat: CategoryNode) {
    setCategoryForm({
      name: cat.name,
      parentId: cat.parentId ?? "",
    });
    setCategoryDialog({
      mode: "edit",
      parentId: cat.parentId,
      category: { id: cat.id, name: cat.name, parentId: cat.parentId },
    });
  }

  function parseDrag(raw: string | null) {
    if (!raw) return null;
    const [type, id, parentKey] = raw.split(":");
    if ((type !== "category" && type !== "article") || !id) return null;
    return {
      type: type as "category" | "article",
      id,
      parentId: parentKey === "null" || !parentKey ? null : parentKey,
    };
  }

  function onDropReorder(
    type: "category" | "article",
    parentId: string | null,
    targetId: string,
    currentIds: string[],
  ) {
    const from = parseDrag(dragPayload);
    if (!from || from.type !== type) return;
    if (from.parentId !== parentId) {
      if (type === "article" && from.type === "article") {
        // Cross-category move handled separately via category drop zones.
        return;
      }
      return;
    }
    const orderedIds = reorderIds(currentIds, from.id, targetId);
    if (orderedIds.join() === currentIds.join()) return;
    reorder.mutate({ type, parentId, orderedIds });
  }

  function ArticleRow({
    article,
    parentId,
    siblingIds,
  }: {
    article: Article;
    parentId: string | null;
    siblingIds: string[];
  }) {
    const dragKey = `article:${article.id}:${parentId ?? "null"}`;
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDragPayload(dragKey);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", dragKey);
        }}
        onDragEnd={() => {
          setDragPayload(null);
          setDragOverKey(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          if (dragOverKey !== dragKey) setDragOverKey(dragKey);
        }}
        onDragLeave={() => {
          if (dragOverKey === dragKey) setDragOverKey(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropReorder("article", parentId, article.id, siblingIds);
          setDragPayload(null);
          setDragOverKey(null);
        }}
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2",
          dragPayload === dragKey && "opacity-60",
          dragOverKey === dragKey &&
            dragPayload &&
            dragPayload !== dragKey &&
            "border-primary",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className="mt-0.5 inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="truncate text-sm font-medium hover:underline"
                href={`/admin/knowledge/${article.number}`}
              >
                {article.title}
              </Link>
              <Badge>
                {article.published ? "Published" : "Draft"}
              </Badge>
            </div>
            {article.shortDescription ? (
              <p className="text-xs text-muted-foreground">
                {article.shortDescription}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/knowledge/${article.number}`}>Edit</Link>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteArticleId(article.id)}
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }

  function renderCategoryList(
    nodes: CategoryNode[],
    parentId: string | null,
    depth: number,
  ) {
    const siblingIds = nodes.map((n) => n.id);
    return (
      <div className="space-y-3">
        {nodes.map((node) => {
          const dragKey = `category:${node.id}:${parentId ?? "null"}`;
          const articleIds = node.articles.map((a) => a.id);
          return (
            <Card
              key={node.id}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragPayload(dragKey);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", dragKey);
              }}
              onDragEnd={() => {
                setDragPayload(null);
                setDragOverKey(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                const from = parseDrag(dragPayload);
                if (from?.type === "article") {
                  setDragOverKey(`drop-cat:${node.id}`);
                  return;
                }
                if (dragOverKey !== dragKey) setDragOverKey(dragKey);
              }}
              onDragLeave={() => {
                if (
                  dragOverKey === dragKey ||
                  dragOverKey === `drop-cat:${node.id}`
                ) {
                  setDragOverKey(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const from = parseDrag(
                  e.dataTransfer.getData("text/plain") || dragPayload,
                );
                if (from?.type === "article" && from.parentId !== node.id) {
                  moveArticle.mutate({ id: from.id, categoryId: node.id });
                } else if (from?.type === "category") {
                  onDropReorder("category", parentId, node.id, siblingIds);
                }
                setDragPayload(null);
                setDragOverKey(null);
              }}
              className={cn(
                dragPayload === dragKey && "opacity-60",
                (dragOverKey === dragKey ||
                  dragOverKey === `drop-cat:${node.id}`) &&
                  dragPayload &&
                  dragPayload !== dragKey &&
                  "ring-2 ring-primary/40",
              )}
              style={{ marginLeft: depth > 0 ? Math.min(depth, 4) * 12 : 0 }}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1 inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{node.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      /{node.slug}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openCreateCategory(node.id)}
                    title="Add subcategory"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    title="New article in category"
                  >
                    <Link href={`/admin/knowledge/new?categoryId=${node.id}`}>
                      <Plus className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditCategory(node)}
                    title="Edit category"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteCategoryId(node.id)}
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {node.articles.length > 0 ? (
                  <div className="space-y-2">
                    {node.articles.map((article) => (
                      <ArticleRow
                        key={article.id}
                        article={article}
                        parentId={node.id}
                        siblingIds={articleIds}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No articles in this category.
                  </p>
                )}
                {node.children.length > 0
                  ? renderCategoryList(node.children, node.id, depth + 1)
                  : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  const tree = treeQuery.data;
  const isLoading = searching ? searchQuery.isLoading : treeQuery.isLoading;
  const searchResults = searchQuery.data ?? [];

  return (
    <PageMotion>
      <PageHeader
        title="Knowledge base"
        description="Help articles and categories for /docs."
        actions={
          <>
            <Button variant="outline" onClick={() => openCreateCategory(null)}>
              New category
            </Button>
            <Button asChild>
              <Link href="/admin/knowledge/new">New article</Link>
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search articles by title, short description, or body…"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : searching ? (
        searchResults.length === 0 ? (
          <p className="text-muted-foreground">No articles match “{q}”.</p>
        ) : (
          <div className="space-y-3">
            {searchResults.map((article) => (
              <Card key={article.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    <Link
                      className="hover:underline"
                      href={`/admin/knowledge/${article.number}`}
                    >
                      {article.title}
                    </Link>
                  </CardTitle>
                  <Badge>
                    {article.published ? "Published" : "Draft"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {article.category ? (
                    <p className="text-xs text-muted-foreground">
                      Category: {article.category.name}
                    </p>
                  ) : null}
                  {article.shortDescription ? (
                    <p className="text-sm text-muted-foreground">
                      {article.shortDescription}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/knowledge/${article.number}`}>Edit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteArticleId(article.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : !tree ||
        (tree.categories.length === 0 && tree.uncategorized.length === 0) ? (
        <EmptyState
          title="No articles yet"
          description="Create a category or article to build your help docs."
          actionHref="/admin/knowledge/new"
          actionLabel="New article"
        />
      ) : (
        <div className="space-y-6">
          {tree.categories.length > 0
            ? renderCategoryList(tree.categories, null, 0)
            : null}

          <Card
            onDragOver={(e) => {
              const from = parseDrag(dragPayload);
              if (from?.type !== "article") return;
              e.preventDefault();
              setDragOverKey("drop-cat:null");
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseDrag(
                e.dataTransfer.getData("text/plain") || dragPayload,
              );
              if (from?.type === "article" && from.parentId !== null) {
                moveArticle.mutate({ id: from.id, categoryId: null });
              }
              setDragPayload(null);
              setDragOverKey(null);
            }}
            className={cn(
              dragOverKey === "drop-cat:null" && "ring-2 ring-primary/40",
            )}
          >
            <CardHeader>
              <CardTitle className="text-base">Uncategorized</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tree.uncategorized.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Articles without a category appear here. Drop an article here
                  to remove its category.
                </p>
              ) : (
                tree.uncategorized.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    parentId={null}
                    siblingIds={tree.uncategorized.map((a) => a.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <FormDialog
        open={Boolean(categoryDialog)}
        title={
          categoryDialog?.mode === "edit" ? "Edit category" : "New category"
        }
        onClose={() => setCategoryDialog(null)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label required>Name</Label>
            <Input
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
            />
          </div>
          {categoryDialog?.mode === "edit" ? (
            <div className="space-y-2">
              <Label>Parent category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={categoryForm.parentId}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    parentId: e.target.value,
                  })
                }
              >
                <option value="">None (top level)</option>
                {categoryOptions
                  .filter((opt) => opt.id !== categoryDialog.category?.id)
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {"—".repeat(opt.depth)} {opt.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : categoryDialog?.parentId ? (
            <p className="text-sm text-muted-foreground">
              Creating a subcategory under this category.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={saveCategory.isPending || !categoryForm.name.trim()}
              onClick={() => saveCategory.mutate()}
            >
              {saveCategory.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteCategoryId)}
        title="Delete category?"
        description="Subcategories will also be deleted. Articles in this category become uncategorized."
        confirmLabel="Delete"
        onCancel={() => setDeleteCategoryId(null)}
        onConfirm={() => {
          if (deleteCategoryId) removeCategory.mutate(deleteCategoryId);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteArticleId)}
        title="Delete article?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleteArticleId(null)}
        onConfirm={() => {
          if (deleteArticleId) removeArticle.mutate(deleteArticleId);
        }}
      />
    </PageMotion>
  );
}
