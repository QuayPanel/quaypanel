"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { FieldHint } from "@/components/admin/field-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dollarsToMinor, minorToDollars } from "@/src/core/utils";

type Coupon = {
  id: string;
  number: number;
  code: string;
  type: "PERCENT" | "FIXED" | string;
  value: number;
  maxUses: number | null;
  maxUsesPerClient: number | null;
  active: boolean;
};

type CouponFormProps = {
  mode: "create" | "edit";
  couponNumber?: string;
};

export function CouponFormPage({ mode, couponNumber }: CouponFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: coupon, isLoading } = useApiQuery<Coupon>(
    ["coupon", couponNumber ?? "new"],
    `/api/v1/coupons/${couponNumber}`,
    { enabled: mode === "edit" && Boolean(couponNumber) },
  );

  const [form, setForm] = useState({
    code: "",
    type: "PERCENT" as "PERCENT" | "FIXED",
    value: "10",
    maxUses: "",
    maxUsesPerClient: "",
    active: true,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !coupon) return;
    setForm({
      code: coupon.code,
      type: coupon.type === "FIXED" ? "FIXED" : "PERCENT",
      value:
        coupon.type === "FIXED"
          ? minorToDollars(coupon.value)
          : String(coupon.value),
      maxUses: coupon.maxUses != null ? String(coupon.maxUses) : "",
      maxUsesPerClient:
        coupon.maxUsesPerClient != null
          ? String(coupon.maxUsesPerClient)
          : "",
      active: coupon.active,
    });
  }, [mode, coupon]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        type: form.type,
        value:
          form.type === "FIXED"
            ? dollarsToMinor(form.value)
            : Number(form.value),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        maxUsesPerClient: form.maxUsesPerClient
          ? Number(form.maxUsesPerClient)
          : null,
        active: form.active,
      };
      if (mode === "edit" && couponNumber) {
        return apiFetch<Coupon>(`/api/v1/coupons/${couponNumber}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Coupon>("/api/v1/coupons", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => {
      toast.success(mode === "edit" ? "Coupon updated" : "Coupon created");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      if (mode === "create") {
        router.push(`/admin/coupons/${result.number}/edit`);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["coupon", couponNumber ?? "new"],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/coupons/${couponNumber}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Coupon deleted");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      router.push("/admin/coupons");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (mode === "edit" && isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (mode === "edit" && !coupon) {
    return <p className="text-destructive">Coupon not found</p>;
  }

  return (
    <EditPageChrome
      title={
        mode === "edit"
          ? `Edit ${form.code || coupon?.code || "coupon"}`
          : "Add coupon"
      }
      description="Discount codes for checkout (percent or fixed)."
      backHref="/admin/coupons"
      backLabel="Back to coupons"
      onCancel={() => router.push("/admin/coupons")}
      onSave={() => {
        if (!form.code.trim()) {
          toast.error("Code is required");
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
      deleteTitle="Delete coupon?"
      deleteDescription="This will permanently delete the coupon."
    >
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label required>Code</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label required>Type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value === "FIXED" ? "FIXED" : "PERCENT",
                })
              }
            >
              <option value="PERCENT">PERCENT</option>
              <option value="FIXED">FIXED (USD)</option>
            </select>
            <FieldHint>
              Percent off the subtotal, or a fixed amount in the order currency.
            </FieldHint>
          </div>
          <div className="space-y-2">
            <Label required>
              {form.type === "FIXED" ? "Amount (USD)" : "Percent"}
            </Label>
            <Input
              inputMode="decimal"
              placeholder={form.type === "FIXED" ? "10.98" : "10"}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <FieldHint>
              For percent use 1–100; for fixed use a currency amount.
            </FieldHint>
          </div>
          <div className="space-y-2">
            <Label>Max Uses (Global)</Label>
            <Input
              inputMode="numeric"
              placeholder="Unlimited"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <FieldHint>Leave blank for unlimited.</FieldHint>
          </div>
          <div className="space-y-2">
            <Label>Max Uses (Per Client)</Label>
            <Input
              inputMode="numeric"
              placeholder="Unlimited"
              value={form.maxUsesPerClient}
              onChange={(e) =>
                setForm({ ...form, maxUsesPerClient: e.target.value })
              }
            />
            <FieldHint>Leave blank for unlimited.</FieldHint>
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
