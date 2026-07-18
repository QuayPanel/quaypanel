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

type ConfigOptionRow = {
  id: string;
  number: number;
  name: string;
  envKey: string;
  type: string;
  hidden: boolean;
  sortOrder: number;
  _count: { products: number; choices: number };
};

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  SELECT: "Select",
  RADIO: "Radio",
  CHECKBOX: "Checkbox",
  SLIDER: "Slider",
};

export default function AdminConfigOptionsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<ConfigOptionRow[]>(
    ["config-options"],
    "/api/v1/config-options",
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
      apiFetch("/api/v1/config-options", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelected([]);
      setConfirmOpen(false);
      setPendingDeleteIds([]);
      queryClient.invalidateQueries({ queryKey: ["config-options"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Config Options</h1>
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
            <Link href="/admin/config-options/new">New config option</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All config options</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No config options yet.
            </p>
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
                          allSelected ? [] : data.map((row) => row.number),
                        )
                      }
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Env Variable</TableHead>
                  <TableHead>Hidden</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(row.number)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(row.number)
                              ? prev.filter((n) => n !== row.number)
                              : [...prev, row.number],
                          )
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>{row.sortOrder ?? 0}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {TYPE_LABELS[row.type] ?? row.type}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.envKey}
                    </TableCell>
                    <TableCell>{row.hidden ? "Yes" : "No"}</TableCell>
                    <TableCell>{row._count.products}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/config-options/${row.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setPendingDeleteIds([row.number]);
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
        title="Delete config option(s)?"
        description="This will permanently delete the selected config option(s)."
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
