"use client";

import type { ComponentType, ReactNode } from "react";
import type { ThemeViewId } from "@/src/addons/sdk";

/**
 * Client-safe slot: overrides are applied on the server via theme-runtime
 * when pages pass an overridden component. For v1, ThemeSlot renders the
 * provided fallback (core UI). Server layouts may swap fallback using
 * getThemeView() before passing children.
 */
export function ThemeSlot({
  id: _id,
  fallback,
  children,
  ...props
}: {
  id: ThemeViewId;
  fallback?: ComponentType<Record<string, unknown>>;
  children?: ReactNode;
} & Record<string, unknown>) {
  if (fallback) {
    const Comp = fallback;
    return <Comp {...props}>{children}</Comp>;
  }
  return <>{children}</>;
}
