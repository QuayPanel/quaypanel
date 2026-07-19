"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { FieldHint } from "@/components/admin/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ProductMultiSelect } from "@/components/ui/product-multi-select";
import { dollarsToMinor, minorToDollars, slugify } from "@/src/core/utils";
import {
  isPlainPriceInput,
  priceInputToMinor,
  resolveServerPriceVars,
} from "@/src/domains/billing/price-formula";
import {
  buildPteroProvisionConfig,
  defaultPteroServerForm,
  pteroServerFormFromConfig,
  PterodactylServerTab,
  type PteroServerForm,
} from "./_pterodactyl-server-tab";

type Category = { id: string; name: string };

type PlanDraft = {
  key: string;
  id?: string;
  name: string;
  type: "FREE" | "ONE_TIME" | "RECURRING";
  intervalCount: string;
  billingPeriod: "DAY" | "WEEK" | "MONTH" | "YEAR";
  price: string;
  currency: string;
  setupFee: string;
  active: boolean;
};

type ProductDetail = {
  id: string;
  number: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  hidden: boolean;
  featured: boolean;
  stock: number | null;
  perUserLimit: number | null;
  allowQuantity: "NO" | "SEPARATED" | "COMBINED";
  categoryId: string | null;
  provisionProvider: string;
  provisionConfig: Record<string, unknown> | null;
  plans: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    priceFormula: string | null;
    currency: string;
    type: "FREE" | "ONE_TIME" | "RECURRING";
    intervalCount: number;
    billingPeriod: "DAY" | "WEEK" | "MONTH" | "YEAR";
    setupFee: number;
    active: boolean;
  }>;
  upgrades: Array<{ targetProductId: string }>;
};

type ListProduct = {
  id: string;
  number: number;
  name: string;
  slug: string;
};

function emptyPlan(): PlanDraft {
  return {
    key: `new-${crypto.randomUUID()}`,
    name: "Default",
    type: "RECURRING",
    intervalCount: "1",
    billingPeriod: "MONTH",
    price: "9.99",
    currency: "USD",
    setupFee: "",
    active: true,
  };
}

type ProductFormProps = {
  mode: "create" | "edit";
  productNumber?: string;
};

export function ProductFormPage({ mode, productNumber }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useApiQuery<Category[]>(
    ["admin-categories"],
    "/api/v1/categories",
  );
  const { data: allProducts = [] } = useApiQuery<ListProduct[]>(
    ["products"],
    "/api/v1/products",
  );
  const { data: product, isLoading } = useApiQuery<ProductDetail>(
    ["product", productNumber ?? "new"],
    `/api/v1/products/${productNumber}`,
    { enabled: mode === "edit" && Boolean(productNumber) },
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    slug: "",
    categoryId: "",
    imageUrl: "",
    featured: false,
    hidden: false,
    stock: "",
    perUserLimit: "",
    allowQuantity: "NO" as "NO" | "SEPARATED" | "COMBINED",
    provisionProvider: "noop",
  });
  const [pteroServer, setPteroServer] = useState<PteroServerForm>(
    defaultPteroServerForm(),
  );
  const [plans, setPlans] = useState<PlanDraft[]>(() => [emptyPlan()]);
  const [openPlanKeys, setOpenPlanKeys] = useState<Set<string>>(new Set());
  const [upgradeProductIds, setUpgradeProductIds] = useState<string[]>([]);
  const [slugManual, setSlugManual] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (mode === "create" && plans.length > 0) {
      setOpenPlanKeys(new Set([plans[0].key]));
    }
    // only on mount for create default expand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !product) return;
    setSlugManual(true);
    setForm({
      name: product.name,
      description: product.description ?? "",
      slug: product.slug,
      categoryId: product.categoryId ?? "",
      imageUrl: product.imageUrl ?? "",
      featured: product.featured,
      hidden: product.hidden,
      stock: product.stock != null ? String(product.stock) : "",
      perUserLimit:
        product.perUserLimit != null ? String(product.perUserLimit) : "",
      allowQuantity: product.allowQuantity,
      provisionProvider: product.provisionProvider || "noop",
    });
    setPteroServer(pteroServerFormFromConfig(product.provisionConfig));
    setPlans(
      product.plans.length > 0
        ? product.plans.map((plan) => ({
            key: plan.id,
            id: plan.id,
            name: plan.name,
            type: plan.type,
            intervalCount: String(plan.intervalCount),
            billingPeriod: plan.billingPeriod,
            price: plan.priceFormula?.trim()
              ? plan.priceFormula
              : minorToDollars(plan.price),
            currency: plan.currency || "USD",
            setupFee: plan.setupFee ? minorToDollars(plan.setupFee) : "",
            active: plan.active,
          }))
        : [emptyPlan()],
    );
    setUpgradeProductIds(product.upgrades.map((u) => u.targetProductId));
  }, [mode, product]);

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

  function updatePlan(key: string, patch: Partial<PlanDraft>) {
    setPlans((prev) =>
      prev.map((plan) => (plan.key === key ? { ...plan, ...patch } : plan)),
    );
  }

  function buildPayload() {
    let provisionConfig: Record<string, unknown> = {};
    if (form.provisionProvider === "pterodactyl") {
      provisionConfig = buildPteroProvisionConfig(pteroServer);
    }
    const priceVars = resolveServerPriceVars(provisionConfig);
    return {
      name: form.name,
      description: form.description || null,
      slug: form.slug ? slugify(form.slug) : undefined,
      categoryId: form.categoryId || null,
      imageUrl: form.imageUrl || null,
      featured: form.featured,
      hidden: form.hidden,
      stock: form.stock.trim() === "" ? null : Number(form.stock),
      perUserLimit:
        form.perUserLimit.trim() === "" ? null : Number(form.perUserLimit),
      allowQuantity: form.allowQuantity,
      provisionProvider: form.provisionProvider,
      provisionConfig,
      plans: plans.map((plan) => {
        const priceInput = plan.price.trim();
        let priceMinor = 0;
        let priceFormula: string | null = null;
        if (plan.type !== "FREE") {
          if (isPlainPriceInput(priceInput)) {
            priceMinor = dollarsToMinor(priceInput || "0");
          } else {
            priceFormula = priceInput;
            priceMinor = priceInputToMinor(priceInput, priceVars);
          }
        }
        return {
          id: plan.id,
          name: plan.name,
          description: null,
          type: plan.type,
          intervalCount: Number(plan.intervalCount) || 1,
          billingPeriod: plan.billingPeriod,
          currency: plan.currency || "USD",
          price: priceMinor,
          priceFormula,
          setupFee: plan.setupFee.trim()
            ? dollarsToMinor(plan.setupFee)
            : 0,
          active: plan.active,
        };
      }),
      upgradeProductIds,
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (mode === "edit" && productNumber) {
        return apiFetch<ProductDetail>(`/api/v1/products/${productNumber}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<ProductDetail>("/api/v1/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => {
      toast.success(mode === "edit" ? "Product updated" : "Product created");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["product", productNumber ?? "new"],
      });
      if (mode === "create") {
        router.push(`/admin/products/${result.number}/edit`);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["product", String(result.number)],
        });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${productNumber}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Product deleted");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/admin/products");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (mode === "edit" && isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (mode === "edit" && !product) {
    return <p className="text-destructive">Product not found</p>;
  }

  return (
    <EditPageChrome
      title={
        mode === "edit"
          ? `Edit ${form.name || product?.name || "product"}`
          : "Add product"
      }
      description="Sellable items with plans, pricing, and optional provisioning."
      backHref="/admin/products"
      backLabel="Back to products"
      onCancel={() => router.push("/admin/products")}
      onSave={() => {
        if (!form.name.trim()) {
          toast.error("Name is required");
          return;
        }
        if (form.provisionProvider === "pterodactyl") {
          if (!pteroServer.nestId || !pteroServer.eggId) {
            toast.error("Select a Nest and Egg on the Server tab");
            return;
          }
          try {
            buildPteroProvisionConfig(pteroServer);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Invalid Port Array",
            );
            return;
          }
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
      deleteTitle="Delete product?"
      deleteDescription="This will permanently delete the product, its plans, and related services."
    >
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {form.provisionProvider === "pterodactyl" ? (
            <TabsTrigger value="server">Server</TabsTrigger>
          ) : null}
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label required>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <FieldHint>
                  URL path segment in the store (e.g. /store/products/your-slug).
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Unlimited"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
                <FieldHint>Leave blank for unlimited inventory.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Per user limit</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Unlimited"
                  value={form.perUserLimit}
                  onChange={(e) =>
                    setForm({ ...form, perUserLimit: e.target.value })
                  }
                />
                <FieldHint>
                  Max active services per client; blank = unlimited.
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label required>Allow Quantity</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.allowQuantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      allowQuantity: e.target.value as
                        | "NO"
                        | "SEPARATED"
                        | "COMBINED",
                    })
                  }
                >
                  <option value="NO">No</option>
                  <option value="SEPARATED">Separated</option>
                  <option value="COMBINED">Combined</option>
                </select>
                <FieldHint>
                  How customers can buy multiple quantities of this product.
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <MarkdownEditor
                  value={form.description}
                  onChange={(description) => setForm({ ...form, description })}
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
                <Label>Provision provider</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.provisionProvider}
                  onChange={(e) =>
                    setForm({ ...form, provisionProvider: e.target.value })
                  }
                >
                  <option value="noop">None (noop)</option>
                  <option value="pterodactyl">Pterodactyl</option>
                  <option value="proxmox">Proxmox VE</option>
                </select>
                <FieldHint>
                  Which provider creates the service after payment (noop logs
                  only).
                </FieldHint>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hidden}
                  onChange={(e) =>
                    setForm({ ...form, hidden: e.target.checked })
                  }
                />
                Hide product
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) =>
                    setForm({ ...form, featured: e.target.checked })
                  }
                />
                Featured
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        {form.provisionProvider === "pterodactyl" ? (
          <TabsContent value="server">
            <PterodactylServerTab
              server={pteroServer}
              onChange={setPteroServer}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plans.map((plan, index) => (
                <details
                  key={plan.key}
                  open={openPlanKeys.has(plan.key)}
                  onToggle={(e) => {
                    const isOpen = e.currentTarget.open;
                    setOpenPlanKeys((prev) => {
                      const next = new Set(prev);
                      if (isOpen) next.add(plan.key);
                      else next.delete(plan.key);
                      return next;
                    });
                  }}
                  className="rounded-md border border-border bg-card"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      <span>{plan.name.trim() || `Plan ${index + 1}`}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Expand
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <div className="flex justify-end">
                      {plans.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setPlans((prev) =>
                              prev.filter((p) => p.key !== plan.key),
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label required>Name</Label>
                        <Input
                          value={plan.name}
                          onChange={(e) =>
                            updatePlan(plan.key, { name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label required>Type</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                          value={plan.type}
                          onChange={(e) =>
                            updatePlan(plan.key, {
                              type: e.target.value as PlanDraft["type"],
                              price:
                                e.target.value === "FREE" ? "0" : plan.price,
                            })
                          }
                        >
                          <option value="FREE">Free</option>
                          <option value="ONE_TIME">One Time</option>
                          <option value="RECURRING">Recurring</option>
                        </select>
                        <FieldHint>
                          FREE / ONE_TIME / RECURRING billing behavior.
                        </FieldHint>
                      </div>
                      {plan.type === "RECURRING" && (
                        <>
                          <div className="space-y-2">
                            <Label required>Time interval</Label>
                            <Input
                              inputMode="numeric"
                              value={plan.intervalCount}
                              onChange={(e) =>
                                updatePlan(plan.key, {
                                  intervalCount: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label required>Billing period</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                              value={plan.billingPeriod}
                              onChange={(e) =>
                                updatePlan(plan.key, {
                                  billingPeriod: e.target
                                    .value as PlanDraft["billingPeriod"],
                                })
                              }
                            >
                              <option value="DAY">Day</option>
                              <option value="WEEK">Week</option>
                              <option value="MONTH">Month</option>
                              <option value="YEAR">Year</option>
                            </select>
                            <FieldHint>
                              How often recurring plans renew.
                            </FieldHint>
                          </div>
                        </>
                      )}
                      <div className="space-y-2 md:col-span-2">
                        <Label required>Price</Label>
                        <Input
                          placeholder='9.99 or 2.99 * ({server.memory} / 1024)'
                          disabled={plan.type === "FREE"}
                          value={plan.type === "FREE" ? "0.00" : plan.price}
                          onChange={(e) =>
                            updatePlan(plan.key, { price: e.target.value })
                          }
                        />
                        <FieldHint>
                          Fixed amount in major currency units, or a formula
                          using config placeholders.
                        </FieldHint>
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Input
                          maxLength={3}
                          value={plan.currency}
                          onChange={(e) =>
                            updatePlan(plan.key, {
                              currency: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Setup fee (optional)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={plan.setupFee}
                          onChange={(e) =>
                            updatePlan(plan.key, { setupFee: e.target.value })
                          }
                        />
                        <FieldHint>
                          One-time fee charged at purchase in addition to the
                          plan price.
                        </FieldHint>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const plan = emptyPlan();
                  setPlans((prev) => [...prev, plan]);
                  setOpenPlanKeys((prev) => new Set(prev).add(plan.key));
                }}
              >
                Add plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upgrades">
          <Card>
            <CardHeader>
              <CardTitle>Upgrades</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductMultiSelect
                products={allProducts}
                excludeId={product?.id}
                selectedIds={upgradeProductIds}
                onChange={setUpgradeProductIds}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EditPageChrome>
  );
}
