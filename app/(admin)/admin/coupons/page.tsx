"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
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
import { formatMoney } from "@/src/core/utils";

type Coupon = {
  id: string;
  number: number;
  code: string;
  type: "PERCENT" | "FIXED" | string;
  value: number;
  uses: number;
  maxUses: number | null;
  maxUsesPerClient: number | null;
  active: boolean;
};

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Coupon[]>(
    ["coupons"],
    "/api/v1/coupons",
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
      apiFetch("/api/v1/coupons", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelected([]);
      setConfirmOpen(false);
      setPendingDeleteIds([]);
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Coupons"
        description="Discount codes for checkout (percent or fixed)."
        actions={
          <>
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
              <Link href="/admin/coupons/new">Add coupon</Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : data.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create a coupon to offer discounts at checkout."
          actionHref="/admin/coupons/new"
          actionLabel="Add coupon"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All coupons</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Per client</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(coupon.number)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(coupon.number)
                              ? prev.filter((id) => id !== coupon.number)
                              : [...prev, coupon.number],
                          )
                        }
                        aria-label={`Select ${coupon.code}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{coupon.number}</TableCell>
                    <TableCell className="font-mono">{coupon.code}</TableCell>
                    <TableCell>{coupon.type}</TableCell>
                    <TableCell>
                      {coupon.type === "FIXED"
                        ? formatMoney(coupon.value)
                        : `${coupon.value}%`}
                    </TableCell>
                    <TableCell>
                      {coupon.uses}
                      {coupon.maxUses != null ? `/${coupon.maxUses}` : ""}
                    </TableCell>
                    <TableCell>
                      {coupon.maxUsesPerClient != null
                        ? coupon.maxUsesPerClient
                        : "—"}
                    </TableCell>
                    <TableCell>{coupon.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/coupons/${coupon.number}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setPendingDeleteIds([coupon.number]);
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
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete coupons?"
        description={`This will permanently delete ${pendingDeleteIds.length} coupon${pendingDeleteIds.length === 1 ? "" : "s"}.`}
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
