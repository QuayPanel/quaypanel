"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export function MarkdownEditor({
  label = "Description",
  value,
  onChange,
  hint = "Markdown is shown on the storefront. Single newlines are preserved as line breaks.",
  required,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const colorMode =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div className="apex-md-editor space-y-2" data-color-mode={colorMode}>
      <Label required={required}>{label}</Label>
      <div className="overflow-hidden rounded-md border border-input bg-card">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={280}
          preview="edit"
          visibleDragbar={false}
        />
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
