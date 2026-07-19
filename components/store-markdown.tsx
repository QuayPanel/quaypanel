"use client";

import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import {
  STORE_PROSE_CLASS,
  STORE_PROSE_COMPACT_CLASS,
} from "@/components/store-prose";
import { cn } from "@/src/core/utils";

type StoreMarkdownProps = {
  children: string;
  compact?: boolean;
  className?: string;
};

/** Storefront markdown with soft line breaks (single newlines become line breaks). */
export function StoreMarkdown({
  children,
  compact = false,
  className,
}: StoreMarkdownProps) {
  return (
    <div
      className={cn(
        compact ? STORE_PROSE_COMPACT_CLASS : STORE_PROSE_CLASS,
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkBreaks]}>{children}</Markdown>
    </div>
  );
}
