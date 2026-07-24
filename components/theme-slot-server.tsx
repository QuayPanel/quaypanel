import type { ComponentType, ReactNode } from "react";
import type { ThemeViewId } from "@/src/addons/sdk";
import {
  ensureThemeLoaded,
  getThemeView,
} from "@/src/addons/theme-runtime";

/** Server component: resolves theme override or core fallback. */
export async function ThemeSlotServer({
  id,
  fallback: Fallback,
  children,
  ...props
}: {
  id: ThemeViewId;
  fallback: ComponentType<Record<string, unknown>>;
  children?: ReactNode;
} & Record<string, unknown>) {
  await ensureThemeLoaded().catch(() => undefined);
  const Override = getThemeView(id);
  const Comp = Override ?? Fallback;
  return <Comp {...props}>{children}</Comp>;
}
