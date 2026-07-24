import {
  getPublicSettings,
  getSettingsMap,
} from "@/src/domains/settings/service";
import { buildThemeCss } from "@/src/domains/settings/theme-css";
import {
  ensureThemeLoaded,
  getActiveThemeCssHrefs,
  getLoadedThemeId,
  getRuntimeThemeTokens,
} from "@/src/addons/theme-runtime";

/** Server-rendered theme variables so the first paint matches configured colors. */
export async function ThemeCss() {
  await ensureThemeLoaded().catch(() => undefined);
  const map = getPublicSettings(await getSettingsMap());
  const themeTokens = getRuntimeThemeTokens();
  const settingsLight =
    (map["theme.colors.light"] as Record<string, string> | undefined) ?? {};
  const settingsDark =
    (map["theme.colors.dark"] as Record<string, string> | undefined) ?? {};

  // Active theme tokens are the base; Settings colors layer on top as overrides.
  const light = {
    ...(themeTokens.light ?? {}),
    ...settingsLight,
  };
  const dark = {
    ...(themeTokens.dark ?? {}),
    ...settingsDark,
  };
  const css = buildThemeCss(light, dark);
  const favicon = String(map["brand.faviconUrl"] || "").trim();
  const faviconHref = favicon
    ? favicon.includes("?")
      ? `${favicon}&v=${encodeURIComponent(favicon)}`
      : `${favicon}?v=${encodeURIComponent(favicon)}`
    : "";
  const cssHrefs = getActiveThemeCssHrefs();
  const themeId =
    getLoadedThemeId() ||
    String(map["theme.activeId"] || map["theme.id"] || "default");

  return (
    <>
      <style
        id="quaypanel-theme-vars"
        data-theme={themeId}
        dangerouslySetInnerHTML={{ __html: css }}
      />
      {cssHrefs.map((href) => (
        <link
          key={`${themeId}:${href}`}
          rel="stylesheet"
          href={`${href}${href.includes("?") ? "&" : "?"}t=${encodeURIComponent(themeId)}`}
        />
      ))}
      {faviconHref ? <link rel="icon" href={faviconHref} /> : null}
    </>
  );
}
