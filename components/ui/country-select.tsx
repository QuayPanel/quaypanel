"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/src/core/countries";
import { cn } from "@/src/core/utils";

export function CountrySelect({
  id,
  value,
  onChange,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Keeps native required validation when used inside a form */}
      <input
        id={id}
        tabIndex={-1}
        className="sr-only"
        value={value}
        readOnly
        required={required}
        aria-hidden
      />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground",
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{value || "Select…"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-card p-2 shadow-md">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries…"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[0]) select(filtered[0]);
              }
            }}
          />
          <ul
            role="listbox"
            className="mt-2 max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                No countries found.
              </li>
            ) : (
              filtered.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === name}
                    className={cn(
                      "flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                      value === name && "bg-muted font-medium",
                    )}
                    onClick={() => select(name)}
                  >
                    {name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
