"use client";

import { useEffect } from "react";
import { useApiQuery } from "@/components/api";
import { buildThemeCss } from "@/src/domains/settings/theme-css";

/** Keeps the SSR theme stylesheet in sync after settings load / update. */
export function ThemeSettingsInjector() {
  const { data } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  useEffect(() => {
    if (!data) return;
    const css = buildThemeCss(
      (data["theme.colors.light"] as Record<string, string>) ?? null,
      (data["theme.colors.dark"] as Record<string, string>) ?? null,
    );
    let style = document.getElementById(
      "quaypanel-theme-vars",
    ) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "quaypanel-theme-vars";
      document.head.appendChild(style);
    }
    style.textContent = css;

    // Clear any legacy inline overrides from older injectors
    const root = document.documentElement;
    for (const prop of [
      "--primary",
      "--secondary",
      "--border",
      "--accent",
      "--foreground",
      "--muted-foreground",
      "--primary-foreground",
      "--background",
      "--card",
      "--ring",
      "--card-foreground",
    ]) {
      root.style.removeProperty(prop);
    }

    const favicon = String(data["brand.faviconUrl"] || "").trim();
    if (favicon) {
      let link = document.querySelector(
        "link[rel='icon']",
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [data]);

  return null;
}
