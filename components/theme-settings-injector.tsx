"use client";

import { useEffect } from "react";
import { useApiQuery } from "@/components/api";
import { DEFAULT_THEME_COLORS } from "@/src/domains/settings/defaults";

function applyColors(prefix: string, colors: Record<string, string>) {
  const root = document.documentElement;
  const map: Record<string, string> = {
    primary: "--primary",
    secondary: "--secondary",
    border: "--border",
    accent: "--accent",
    text: "--foreground",
    muted: "--muted-foreground",
    inverted: "--primary-foreground",
    bg: "--background",
    bgSecondary: "--card",
  };
  for (const [key, cssVar] of Object.entries(map)) {
    if (colors[key]) {
      root.style.setProperty(
        prefix ? `${cssVar}` : cssVar,
        colors[key],
      );
    }
  }
}

export function ThemeSettingsInjector() {
  const { data } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  useEffect(() => {
    if (!data) return;
    const light = {
      ...DEFAULT_THEME_COLORS.light,
      ...((data["theme.colors.light"] as Record<string, string>) ?? {}),
    };
    const dark = {
      ...DEFAULT_THEME_COLORS.dark,
      ...((data["theme.colors.dark"] as Record<string, string>) ?? {}),
    };
    const isDark = document.documentElement.classList.contains("dark");
    applyColors("", isDark ? dark : light);

    const favicon = String(data["brand.faviconUrl"] || "");
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
