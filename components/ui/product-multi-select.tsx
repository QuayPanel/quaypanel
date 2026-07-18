"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SelectableProduct = {
  id: string;
  number: number;
  name: string;
  slug: string;
};

export function ProductMultiSelect({
  label = "Upgrade targets",
  products,
  excludeId,
  selectedIds,
  onChange,
}: {
  label?: string;
  products: SelectableProduct[];
  excludeId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.id !== excludeId)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          String(p.number).includes(q),
      );
  }, [products, excludeId, query]);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <Input
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
        {options.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No products found.
          </p>
        )}
        {options.map((product) => (
          <label
            key={product.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(product.id)}
              onChange={() => toggle(product.id)}
            />
            <span>
              #{product.number} {product.name}
            </span>
            <span className="text-xs text-muted-foreground">{product.slug}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedIds.length} selected
      </p>
    </div>
  );
}
