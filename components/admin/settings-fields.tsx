"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProxyChipList({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((ip) => (
          <span
            key={ip}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-mono"
          >
            {ip}
            <button
              type="button"
              className="text-destructive"
              onClick={() => onChange(values.filter((v) => v !== ip))}
              aria-label={`Remove ${ip}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const raw = String(data.get("proxy") ?? "").trim();
          if (!raw || values.includes(raw)) return;
          onChange([...values, raw]);
          form.reset();
        }}
      >
        <Input name="proxy" placeholder="IP or CIDR (e.g. 10.0.0.0/8)" />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-10 w-12 cursor-pointer rounded border bg-card"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          className="font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
