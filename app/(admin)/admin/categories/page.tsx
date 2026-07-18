"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Category = {
  id: string;
  number: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
  parent?: { id: string; name: string } | null;
};

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Category[]>(
    ["admin-categories"],
    "/api/v1/categories",
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);

  const allSelected = useMemo(
    () => data.length > 0 && selected.length === data.length,
    [data.length, selected.length],
  );

  const remove = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch("/api/v1/categories", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelected([]);
      setConfirmOpen(false);
      setPendingDeleteIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                setPendingDeleteIds(selected);
                setConfirmOpen(true);
              }}
            >
              Delete selected ({selected.length})
            </Button>
          )}
          <Button asChild>
            <Link href="/admin/categories/new">Add category</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : data.map((c) => c.number))
                      }
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(cat.number)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(cat.number)
                              ? prev.filter((id) => id !== cat.number)
                              : [...prev, cat.number],
                          )
                        }
                        aria-label={`Select ${cat.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{cat.number}</TableCell>
                    <TableCell>
                      {cat.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.parent?.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cat.slug}</TableCell>
                    <TableCell>{cat.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/categories/${cat.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setPendingDeleteIds([cat.number]);
                          setConfirmOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete categories?"
        description={`This will permanently delete ${pendingDeleteIds.length} categor${pendingDeleteIds.length === 1 ? "y" : "ies"}.`}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={() => remove.mutate(pendingDeleteIds)}
        loading={remove.isPending}
      />
    </PageMotion>
  );
}
