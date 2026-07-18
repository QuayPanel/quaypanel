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

type Product = {
  id: string;
  number: number;
  name: string;
  slug: string;
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Product[]>(
    ["products"],
    "/api/v1/products",
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
      apiFetch("/api/v1/products", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelected([]);
      setConfirmOpen(false);
      setPendingDeleteIds([]);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
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
            <Link href="/admin/products/new">Add product</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
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
                        setSelected(
                          allSelected ? [] : data.map((p) => p.number),
                        )
                      }
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(product.number)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(product.number)
                              ? prev.filter((id) => id !== product.number)
                              : [...prev, product.number],
                          )
                        }
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{product.number}</TableCell>
                    <TableCell>
                      <div>{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.slug}
                      </div>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/products/${product.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setPendingDeleteIds([product.number]);
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
        title="Delete products?"
        description={`This will permanently delete ${pendingDeleteIds.length} product${pendingDeleteIds.length === 1 ? "" : "s"} and related plans/services.`}
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
