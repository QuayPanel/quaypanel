"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { FieldHint } from "@/components/admin/field-hint";
import { ToggleField } from "@/components/admin/settings-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductMultiSelect } from "@/components/ui/product-multi-select";
import { dollarsToMinor, minorToDollars } from "@/src/core/utils";
import { cn } from "@/src/core/utils";

type ConfigOptionType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX"
  | "SLIDER";

type PricingType = "FREE" | "ONE_TIME" | "RECURRING";
type BillingPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";

type ChoiceDraft = {
  key: string;
  id?: string;
  name: string;
  envKey: string;
  pricingName: string;
  pricingType: PricingType;
  intervalCount: string;
  billingPeriod: BillingPeriod;
  price: string;
};

type ListProduct = {
  id: string;
  number: number;
  name: string;
  slug: string;
};

type ConfigOptionDetail = {
  id: string;
  number: number;
  name: string;
  description: string | null;
  envKey: string;
  type: ConfigOptionType;
  hidden: boolean;
  sortOrder: number;
  productIds: string[];
  options: Array<{
    id: string;
    name: string;
    envKey: string;
    pricingName: string;
    pricingType: PricingType;
    intervalCount: number;
    billingPeriod: BillingPeriod;
    price: number;
  }>;
};

const TYPES_WITH_OPTIONS = new Set<ConfigOptionType>([
  "SELECT",
  "RADIO",
  "CHECKBOX",
  "SLIDER",
]);

function emptyChoice(): ChoiceDraft {
  return {
    key: `new-${crypto.randomUUID()}`,
    name: "",
    envKey: "",
    pricingName: "Default",
    pricingType: "FREE",
    intervalCount: "1",
    billingPeriod: "MONTH",
    price: "0",
  };
}

type ConfigOptionFormProps = {
  mode: "create" | "edit";
  optionNumber?: string;
};

export function ConfigOptionFormPage({
  mode,
  optionNumber,
}: ConfigOptionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: allProducts = [] } = useApiQuery<ListProduct[]>(
    ["products"],
    "/api/v1/products",
  );
  const { data: option, isLoading } = useApiQuery<ConfigOptionDetail>(
    ["config-option", optionNumber ?? "new"],
    `/api/v1/config-options/${optionNumber}`,
    { enabled: mode === "edit" && Boolean(optionNumber) },
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    envKey: "",
    type: "TEXT" as ConfigOptionType,
    hidden: false,
    sortOrder: "0",
  });
  const [productIds, setProductIds] = useState<string[]>([]);
  const [choices, setChoices] = useState<ChoiceDraft[]>([]);
  const [openChoiceKeys, setOpenChoiceKeys] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const showOptionsTab = TYPES_WITH_OPTIONS.has(form.type);

  useEffect(() => {
    if (mode !== "edit" || !option) return;
    setForm({
      name: option.name,
      description: option.description ?? "",
      envKey: option.envKey,
      type: option.type,
      hidden: option.hidden,
      sortOrder: String(option.sortOrder ?? 0),
    });
    setProductIds(option.productIds ?? []);
    setChoices(
      (option.options ?? []).map((c) => ({
        key: c.id,
        id: c.id,
        name: c.name,
        envKey: c.envKey,
        pricingName: c.pricingName,
        pricingType: c.pricingType,
        intervalCount: String(c.intervalCount),
        billingPeriod: c.billingPeriod,
        price: minorToDollars(c.price),
      })),
    );
  }, [mode, option]);

  function updateChoice(key: string, patch: Partial<ChoiceDraft>) {
    setChoices((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  }

  function reorderChoices(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    setChoices((prev) => {
      const fromIndex = prev.findIndex((c) => c.key === fromKey);
      const toIndex = prev.findIndex((c) => c.key === toKey);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        envKey: form.envKey.trim(),
        type: form.type,
        hidden: form.hidden,
        sortOrder: Math.max(0, Math.floor(Number(form.sortOrder) || 0)),
        productIds,
        options: showOptionsTab
          ? choices.map((c, i) => ({
              id: c.id,
              name: c.name.trim(),
              envKey: c.envKey.trim(),
              sortOrder: i,
              pricingName: c.pricingName.trim() || "Default",
              pricingType: c.pricingType,
              price:
                c.pricingType === "FREE" ? 0 : dollarsToMinor(c.price || "0"),
              intervalCount: Number(c.intervalCount) || 1,
              billingPeriod: c.billingPeriod,
            }))
          : [],
      };
      if (mode === "edit" && optionNumber) {
        return apiFetch<ConfigOptionDetail>(
          `/api/v1/config-options/${optionNumber}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      }
      return apiFetch<ConfigOptionDetail>("/api/v1/config-options", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (result) => {
      toast.success(
        mode === "edit" ? "Config option updated" : "Config option created",
      );
      queryClient.invalidateQueries({ queryKey: ["config-options"] });
      if (mode === "create") {
        router.push(`/admin/config-options/${result.number}/edit`);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["config-option", optionNumber ?? "new"],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/config-options/${optionNumber}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Config option deleted");
      queryClient.invalidateQueries({ queryKey: ["config-options"] });
      router.push("/admin/config-options");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (mode === "edit" && isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (mode === "edit" && !option) {
    return <p className="text-destructive">Config option not found</p>;
  }

  return (
    <EditPageChrome
      title={
        mode === "edit"
          ? `Edit ${form.name || option?.name || "config option"}`
          : "New config option"
      }
      description="Checkout add-ons customers can choose with optional pricing."
      backHref="/admin/config-options"
      backLabel="Back to config options"
      onCancel={() => router.push("/admin/config-options")}
      onSave={() => {
        if (!form.name.trim()) {
          toast.error("Name is required");
          return;
        }
        if (!form.envKey.trim()) {
          toast.error("Environment Variable is required");
          return;
        }
        if (showOptionsTab) {
          if (choices.length < 1) {
            toast.error("At least one option is required");
            return;
          }
          for (const c of choices) {
            if (!c.name.trim() || !c.envKey.trim()) {
              toast.error("Each option needs a Name and Environment Variable");
              return;
            }
            if (!c.pricingName.trim()) {
              toast.error("Each option needs a Pricing Name");
              return;
            }
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
      deleteTitle="Delete config option?"
      deleteDescription="This will permanently delete the config option and its option values."
    >
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {showOptionsTab ? (
            <TabsTrigger value="options">Options</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label required>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label required>Environment Variable</Label>
                <Input
                  value={form.envKey}
                  onChange={(e) => setForm({ ...form, envKey: e.target.value })}
                />
                <FieldHint>
                  Key passed to provisioning (e.g. SERVER_MEMORY).
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label required>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as ConfigOptionType,
                    })
                  }
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="SELECT">Select (dropdown)</option>
                  <option value="RADIO">Radio</option>
                  <option value="CHECKBOX">Checkbox</option>
                  <option value="SLIDER">Slider</option>
                </select>
                <FieldHint>
                  Controls the checkout UI control for this option.
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  inputMode="numeric"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  0 = no order (shown after ordered options). 1 = first, 2 =
                  second, and so on.
                </p>
              </div>
              <ToggleField
                label="Hidden"
                checked={form.hidden}
                onChange={(v) => setForm({ ...form, hidden: v })}
              />
              <div className="space-y-2">
                <ProductMultiSelect
                  label="Products"
                  products={allProducts}
                  selectedIds={productIds}
                  onChange={setProductIds}
                />
                <FieldHint>
                  Which products show this option at configure/checkout.
                </FieldHint>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showOptionsTab ? (
          <TabsContent value="options">
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Drag options to set order. The first option is selected by
                  default for Select and Radio fields on the storefront.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {choices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No options yet. Add values for this config option.
                  </p>
                ) : (
                  choices.map((choice, index) => (
                    <details
                      key={choice.key}
                      open={openChoiceKeys.has(choice.key)}
                      onToggle={(e) => {
                        const isOpen = e.currentTarget.open;
                        setOpenChoiceKeys((prev) => {
                          const next = new Set(prev);
                          if (isOpen) next.add(choice.key);
                          else next.delete(choice.key);
                          return next;
                        });
                      }}
                      draggable
                      onDragStart={(e) => {
                        setDragKey(choice.key);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", choice.key);
                      }}
                      onDragEnd={() => {
                        setDragKey(null);
                        setDragOverKey(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverKey !== choice.key) {
                          setDragOverKey(choice.key);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverKey === choice.key) setDragOverKey(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from =
                          e.dataTransfer.getData("text/plain") || dragKey;
                        if (from) reorderChoices(from, choice.key);
                        setDragKey(null);
                        setDragOverKey(null);
                      }}
                      className={cn(
                        "rounded-md border border-border bg-card",
                        dragKey === choice.key && "opacity-60",
                        dragOverKey === choice.key &&
                          dragKey &&
                          dragKey !== choice.key &&
                          "border-primary",
                      )}
                    >
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                              title="Drag to reorder"
                              onClick={(e) => e.preventDefault()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <span className="truncate">
                              {choice.name.trim() || `Option ${index + 1}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">
                            Expand
                          </span>
                        </span>
                      </summary>
                      <div className="space-y-4 border-t border-border px-4 py-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label required>Name</Label>
                            <Input
                              value={choice.name}
                              onChange={(e) =>
                                updateChoice(choice.key, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label required>Environment Variable</Label>
                            <Input
                              value={choice.envKey}
                              onChange={(e) =>
                                updateChoice(choice.key, {
                                  envKey: e.target.value,
                                })
                              }
                            />
                            <FieldHint>
                              Value sent when this choice is selected.
                            </FieldHint>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-md border border-dashed p-3">
                          <p className="text-sm font-medium">Pricing</p>
                          <FieldHint>
                            Extra charge when the customer picks this choice.
                          </FieldHint>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label required>Name</Label>
                              <Input
                                value={choice.pricingName}
                                onChange={(e) =>
                                  updateChoice(choice.key, {
                                    pricingName: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label required>Type</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                                value={choice.pricingType}
                                onChange={(e) =>
                                  updateChoice(choice.key, {
                                    pricingType: e.target
                                      .value as PricingType,
                                    price:
                                      e.target.value === "FREE"
                                        ? "0"
                                        : choice.price,
                                  })
                                }
                              >
                                <option value="FREE">Free</option>
                                <option value="ONE_TIME">One Time</option>
                                <option value="RECURRING">Recurring</option>
                              </select>
                            </div>

                            {choice.pricingType === "RECURRING" ? (
                              <>
                                <div className="space-y-2">
                                  <Label required>Time interval</Label>
                                  <Input
                                    inputMode="numeric"
                                    value={choice.intervalCount}
                                    onChange={(e) =>
                                      updateChoice(choice.key, {
                                        intervalCount: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label required>Billing period</Label>
                                  <select
                                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                                    value={choice.billingPeriod}
                                    onChange={(e) =>
                                      updateChoice(choice.key, {
                                        billingPeriod: e.target
                                          .value as BillingPeriod,
                                      })
                                    }
                                  >
                                    <option value="DAY">Day</option>
                                    <option value="WEEK">Week</option>
                                    <option value="MONTH">Month</option>
                                    <option value="YEAR">Year</option>
                                  </select>
                                </div>
                              </>
                            ) : null}

                            {choice.pricingType === "ONE_TIME" ||
                            choice.pricingType === "RECURRING" ? (
                              <div className="space-y-2">
                                <Label required>Price (USD)</Label>
                                <Input
                                  inputMode="decimal"
                                  placeholder="10.98"
                                  value={choice.price}
                                  onChange={(e) =>
                                    updateChoice(choice.key, {
                                      price: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setChoices((prev) =>
                                prev.filter((c) => c.key !== choice.key),
                              )
                            }
                          >
                            Remove option
                          </Button>
                        </div>
                      </div>
                    </details>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const choice = emptyChoice();
                    setChoices((prev) => [...prev, choice]);
                    setOpenChoiceKeys((prev) => new Set(prev).add(choice.key));
                  }}
                >
                  Add option
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </EditPageChrome>
  );
}
