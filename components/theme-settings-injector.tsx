"use client";

import { useEffect } from "react";
import { useApiQuery } from "@/components/api";
import { buildThemeCss } from "@/src/domains/settings/theme-css";

function setFaviconHref(href: string) {
  const links = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
    link.href = href;
    return;
  }
  links.forEach((node) => {
    (node as HTMLLinkElement).href = href;
  });
}

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
      // Bust aggressive browser favicon caching
      const bust = favicon.includes("?")
        ? `${favicon}&v=${encodeURIComponent(favicon)}`
        : `${favicon}?v=${encodeURIComponent(favicon)}`;
      setFaviconHref(bust);
    }
  }, [data]);

  return null;
}
