"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slugify } from "@/src/core/utils";

type Category = {
  id: string;
  number: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
};

type CategoryFormProps = {
  mode: "create" | "edit";
  categoryNumber?: string;
};

export function CategoryFormPage({ mode, categoryNumber }: CategoryFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: category, isLoading } = useApiQuery<Category>(
    ["category", categoryNumber ?? "new"],
    `/api/v1/categories/${categoryNumber}`,
    { enabled: mode === "edit" && Boolean(categoryNumber) },
  );
  const { data: allCategories = [] } = useApiQuery<Category[]>(
    ["admin-categories"],
    "/api/v1/categories",
  );

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    active: true,
    sortOrder: "0",
    parentId: "",
  });
  const [uploading, setUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !category) return;
    setSlugManual(true);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
      active: category.active,
      sortOrder: String(category.sortOrder),
      parentId: category.parentId ?? "",
    });
  }, [mode, category]);

  function setName(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugManual ? prev.slug : slugify(name),
    }));
  }

  function setSlug(value: string) {
    setSlugManual(true);
    setForm((prev) => ({
      ...prev,
      slug: slugify(value, { keepTrailingDash: true }),
    }));
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/uploads", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed");
      setForm((prev) => ({ ...prev, imageUrl: json.data.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug ? slugify(form.slug) : undefined,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
        parentId: form.parentId || null,
      };
      if (mode === "edit" && categoryNumber) {
        return apiFetch<Category>(`/api/v1/categories/${categoryNumber}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Category>("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => {
      toast.success(mode === "edit" ? "Category updated" : "Category created");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      if (mode === "create") {
        router.push(`/admin/categories/${result.number}/edit`);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["category", categoryNumber ?? "new"],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/categories/${categoryNumber}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      router.push("/admin/categories");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (mode === "edit" && isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (mode === "edit" && !category) {
    return <p className="text-destructive">Category not found</p>;
  }

  const parentOptions = allCategories.filter((c) => c.id !== category?.id);

  return (
    <EditPageChrome
      title={
        mode === "edit"
          ? `Edit ${form.name || category?.name || "category"}`
          : "Add category"
      }
      backHref="/admin/categories"
      backLabel="Back to categories"
      onCancel={() => router.push("/admin/categories")}
      onSave={() => {
        if (!form.name.trim()) {
          toast.error("Name is required");
          return;
        }
        save.mutate();
      }}
      saving={save.isPending}
      showDelete={mode === "edit"}
      onDelete={() => setConfirmOpen(true)}
      confirmOpen={confirmOpen}
      onCancelDelete={() => setConfirmOpen(false)}
      onConfirmDelete={() => remove.mutate()}
      deleting={remove.isPending}
      deleteTitle="Delete category?"
      deleteDescription="This will permanently delete the category."
    >
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label required>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Parent category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.parentId}
              onChange={(e) =>
                setForm({ ...form, parentId: e.target.value })
              }
            >
              <option value="">— None —</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt=""
                className="mt-2 h-24 w-24 rounded object-cover"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Sort order</Label>
            <Input
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
