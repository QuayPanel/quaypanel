"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { useApiQuery } from "@/components/api";
import { StoreMarkdown } from "@/components/store-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/src/core/utils";
import {
  planPriceMinor,
  resolveServerPriceVars,
} from "@/src/domains/billing/price-formula";
import {
  addCartLine,
  type CartConfigSelection,
} from "@/src/store/cart";

type Choice = {
  id: string;
  name: string;
  envKey?: string;
  price: number;
  pricingType: string;
};

type ConfigOption = {
  id: string;
  name: string;
  description: string | null;
  envKey?: string;
  type: string;
  hidden: boolean;
  choices: Choice[];
};

type Plan = {
  id: string;
  name: string;
  price: number;
  priceFormula?: string | null;
  currency: string;
  setupFee?: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allowQuantity?: "NO" | "SEPARATED" | "COMBINED";
  provisionConfig?: Record<string, unknown> | null;
  plans: Plan[];
  configOptions?: ConfigOption[];
};

function choiceExtra(choice: Choice | undefined) {
  if (!choice || choice.pricingType === "FREE") return 0;
  return choice.price;
}

export default function ConfigureProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useApiQuery<Product>(
    ["product", params.slug, "configure"],
    `/api/v1/catalog?type=product&slug=${params.slug}`,
  );

  const options = useMemo(
    () => (product?.configOptions ?? []).filter((o) => !o.hidden),
    [product],
  );

  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [singleChoice, setSingleChoice] = useState<Record<string, string>>({});
  const [multiChoice, setMultiChoice] = useState<Record<string, string[]>>({});
  const [sliderIndex, setSliderIndex] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!options.length) return;
    setSingleChoice((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const option of options) {
        if (option.type !== "SELECT" && option.type !== "RADIO") continue;
        const first = option.choices[0]?.id;
        if (!first) continue;
        if (!next[option.id] || !option.choices.some((c) => c.id === next[option.id])) {
          next[option.id] = first;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [options]);

  const configSelections: CartConfigSelection[] = useMemo(() => {
    if (!product) return [];
    const out: CartConfigSelection[] = [];

    for (const option of options) {
      if (option.type === "TEXT" || option.type === "NUMBER") {
        out.push({
          configOptionId: option.id,
          type: option.type,
          name: option.name,
          value: textValues[option.id] ?? "",
          extraMinor: 0,
        });
        continue;
      }

      if (option.type === "CHECKBOX") {
        const ids = multiChoice[option.id] ?? [];
        const choices = option.choices.filter((c) => ids.includes(c.id));
        out.push({
          configOptionId: option.id,
          type: option.type,
          name: option.name,
          choiceIds: ids,
          choiceLabels: choices.map((c) => c.name),
          extraMinor: choices.reduce((sum, c) => sum + choiceExtra(c), 0),
        });
        continue;
      }

      if (option.type === "SLIDER") {
        const idx = sliderIndex[option.id] ?? 0;
        const choice = option.choices[idx];
        out.push({
          configOptionId: option.id,
          type: option.type,
          name: option.name,
          choiceIds: choice ? [choice.id] : [],
          choiceLabels: choice ? [choice.name] : [],
          extraMinor: choiceExtra(choice),
        });
        continue;
      }

      const choiceId =
        singleChoice[option.id] ?? option.choices[0]?.id ?? "";
      const choice = option.choices.find((c) => c.id === choiceId);
      out.push({
        configOptionId: option.id,
        type: option.type,
        name: option.name,
        choiceIds: choiceId ? [choiceId] : [],
        choiceLabels: choice ? [choice.name] : [],
        extraMinor: choiceExtra(choice),
      });
    }

    return out;
  }, [product, options, textValues, multiChoice, singleChoice, sliderIndex]);

  const formulaSelections = useMemo(() => {
    return configSelections.map((sel) => {
      const option = options.find((o) => o.id === sel.configOptionId);
      const choiceIds = sel.choiceIds ?? [];
      const choices = (option?.choices ?? [])
        .filter((c) => choiceIds.includes(c.id))
        .map((c) => ({ envKey: c.envKey }));
      return {
        envKey: option?.envKey,
        type: sel.type,
        value: sel.value ?? null,
        choices,
      };
    });
  }, [configSelections, options]);

  const sortedPlans = useMemo(() => {
    if (!product?.plans?.length) return [];
    const vars = resolveServerPriceVars(
      product.provisionConfig,
      formulaSelections,
    );
    return [...product.plans]
      .map((plan) => {
        let amount = plan.price;
        try {
          amount = planPriceMinor({
            price: plan.price,
            priceFormula: plan.priceFormula,
            vars,
          });
        } catch {
          /* keep stored price */
        }
        return { plan, amount };
      })
      .sort((a, b) => a.amount - b.amount);
  }, [product, formulaSelections]);

  const effectivePlanId = planId || sortedPlans[0]?.plan.id || "";
  const selectedPlan =
    product?.plans.find((p) => p.id === effectivePlanId) ??
    sortedPlans[0]?.plan;

  const effectivePlanPrice = useMemo(() => {
    if (!selectedPlan || !product) return 0;
    const fromSorted = sortedPlans.find((p) => p.plan.id === selectedPlan.id);
    if (fromSorted) return fromSorted.amount;
    try {
      const vars = resolveServerPriceVars(
        product.provisionConfig,
        formulaSelections,
      );
      return planPriceMinor({
        price: selectedPlan.price,
        priceFormula: selectedPlan.priceFormula,
        vars,
      });
    } catch {
      return selectedPlan.price;
    }
  }, [selectedPlan, product, formulaSelections, sortedPlans]);

  const pricedExtras = useMemo(
    () => configSelections.filter((c) => c.extraMinor > 0),
    [configSelections],
  );

  const lineTotal = useMemo(() => {
    if (!selectedPlan) return 0;
    const extras = configSelections.reduce((s, c) => s + c.extraMinor, 0);
    const qty = Math.max(1, quantity);
    return (
      effectivePlanPrice * qty + (selectedPlan.setupFee ?? 0) + extras * qty
    );
  }, [selectedPlan, configSelections, quantity, effectivePlanPrice]);

  function validate(): boolean {
    if (!selectedPlan) {
      toast.error("Select a plan");
      return false;
    }
    const next: Record<string, string> = {};
    for (const option of options) {
      if (option.type === "TEXT" || option.type === "NUMBER") {
        if (!(textValues[option.id] ?? "").trim()) {
          next[option.id] = `${option.name} is required`;
        }
        continue;
      }
      if (option.type === "CHECKBOX") {
        if ((multiChoice[option.id] ?? []).length === 0) {
          next[option.id] = `Select at least one option for ${option.name}`;
        }
        continue;
      }
      if (option.type === "SLIDER") {
        if (option.choices.length === 0) {
          next[option.id] = `${option.name} has no available choices`;
        }
        continue;
      }
      // SELECT / RADIO — default to first choice
      if (
        !(singleChoice[option.id] ?? option.choices[0]?.id) ||
        option.choices.length === 0
      ) {
        next[option.id] = `${option.name} has no available choices`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please fill in all required options");
      return false;
    }
    return true;
  }

  function addToCart() {
    if (!product || !selectedPlan) {
      toast.error("Select a plan");
      return;
    }
    if (!validate()) return;

    addCartLine({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      currency: selectedPlan.currency,
      quantity: Math.max(1, quantity),
      planPriceMinor: effectivePlanPrice,
      setupFeeMinor: selectedPlan.setupFee ?? 0,
      config: configSelections,
      lineTotalMinor: lineTotal,
    });
    toast.success("Added to cart");
    router.push("/store/cart");
  }

  if (isLoading || !product) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (product.plans.length === 0) {
    return (
      <p className="text-destructive">No pricing plans for this product.</p>
    );
  }

  const currency = selectedPlan?.currency ?? "USD";

  return (
    <PageMotion>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">Configure {product.name}</h1>
            {product.description ? (
              <div className="mt-4">
                <StoreMarkdown>{product.description}</StoreMarkdown>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label required>Select a plan</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={effectivePlanId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {sortedPlans.map(({ plan, amount }) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatMoney(amount, plan.currency)}
                </option>
              ))}
            </select>
          </div>

          {product.allowQuantity && product.allowQuantity !== "NO" ? (
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
          ) : null}

          {options.map((option) => (
            <div key={option.id} className="space-y-2">
              <Label required>{option.name}</Label>
              {option.description ? (
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              ) : null}

              {option.type === "TEXT" || option.type === "NUMBER" ? (
                <Input
                  type={option.type === "NUMBER" ? "number" : "text"}
                  value={textValues[option.id] ?? ""}
                  onChange={(e) => {
                    setTextValues((prev) => ({
                      ...prev,
                      [option.id]: e.target.value,
                    }));
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next[option.id];
                      return next;
                    });
                  }}
                />
              ) : null}

              {option.type === "SELECT" ? (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={
                    singleChoice[option.id] ?? option.choices[0]?.id ?? ""
                  }
                  onChange={(e) => {
                    setSingleChoice((prev) => ({
                      ...prev,
                      [option.id]: e.target.value,
                    }));
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next[option.id];
                      return next;
                    });
                  }}
                >
                  {option.choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.pricingType !== "FREE"
                        ? ` (+${formatMoney(c.price)})`
                        : ""}
                    </option>
                  ))}
                </select>
              ) : null}

              {option.type === "RADIO" ? (
                <div className="space-y-2">
                  {option.choices.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name={`opt-${option.id}`}
                        checked={
                          (singleChoice[option.id] ??
                            option.choices[0]?.id) === c.id
                        }
                        onChange={() => {
                          setSingleChoice((prev) => ({
                            ...prev,
                            [option.id]: c.id,
                          }));
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next[option.id];
                            return next;
                          });
                        }}
                      />
                      <span>
                        {c.name}
                        {c.pricingType !== "FREE"
                          ? ` (+${formatMoney(c.price)})`
                          : ""}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}

              {option.type === "CHECKBOX" ? (
                <div className="space-y-2">
                  {option.choices.map((c) => {
                    const selected = multiChoice[option.id] ?? [];
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={(e) => {
                            setMultiChoice((prev) => {
                              const cur = prev[option.id] ?? [];
                              return {
                                ...prev,
                                [option.id]: e.target.checked
                                  ? [...cur, c.id]
                                  : cur.filter((id) => id !== c.id),
                              };
                            });
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next[option.id];
                              return next;
                            });
                          }}
                        />
                        <span>
                          {c.name}
                          {c.pricingType !== "FREE"
                            ? ` (+${formatMoney(c.price)})`
                            : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {option.type === "SLIDER" && option.choices.length > 0 ? (
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, option.choices.length - 1)}
                    value={sliderIndex[option.id] ?? 0}
                    onChange={(e) => {
                      setSliderIndex((prev) => ({
                        ...prev,
                        [option.id]: Number(e.target.value),
                      }));
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next[option.id];
                        return next;
                      });
                    }}
                    className="w-full"
                  />
                  <p className="text-sm">
                    {option.choices[sliderIndex[option.id] ?? 0]?.name}
                    {option.choices[sliderIndex[option.id] ?? 0]
                      ?.pricingType !== "FREE"
                      ? ` (+${formatMoney(option.choices[sliderIndex[option.id] ?? 0]?.price ?? 0)})`
                      : ""}
                  </p>
                </div>
              ) : null}

              {errors[option.id] ? (
                <p className="text-xs text-destructive">{errors[option.id]}</p>
              ) : null}
            </div>
          ))}
        </div>

        <Card className="self-start lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedPlan ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>{selectedPlan.name}</span>
                  <span>{formatMoney(effectivePlanPrice, currency)}</span>
                </div>
                {(selectedPlan.setupFee ?? 0) > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span>Setup fee</span>
                    <span>
                      {formatMoney(selectedPlan.setupFee ?? 0, currency)}
                    </span>
                  </div>
                ) : null}
                {pricedExtras.map((c) => (
                  <div
                    key={c.configOptionId}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {c.name}
                      {c.choiceLabels?.length
                        ? ` (${c.choiceLabels.join(", ")})`
                        : ""}
                    </span>
                    <span>{formatMoney(c.extraMinor, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(lineTotal, currency)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a plan</p>
            )}
            <Button className="w-full" onClick={addToCart}>
              Add to cart
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
