import {
  getPublicSettings,
  getSettingsMap,
} from "@/src/domains/settings/service";
import { buildThemeCss } from "@/src/domains/settings/theme-css";
import {
  ensureThemeLoaded,
  getActiveThemeCssHrefs,
  getRuntimeThemeTokens,
} from "@/src/addons/theme-runtime";

/** Server-rendered theme variables so the first paint matches configured colors. */
export async function ThemeCss() {
  await ensureThemeLoaded().catch(() => undefined);
  const map = getPublicSettings(await getSettingsMap());
  const themeTokens = getRuntimeThemeTokens();
  const light = {
    ...(themeTokens.light ?? {}),
    ...((map["theme.colors.light"] as Record<string, string>) ?? {}),
  };
  const dark = {
    ...(themeTokens.dark ?? {}),
    ...((map["theme.colors.dark"] as Record<string, string>) ?? {}),
  };
  const css = buildThemeCss(light, dark);
  const favicon = String(map["brand.faviconUrl"] || "").trim();
  const faviconHref = favicon
    ? favicon.includes("?")
      ? `${favicon}&v=${encodeURIComponent(favicon)}`
      : `${favicon}?v=${encodeURIComponent(favicon)}`
    : "";
  const cssHrefs = getActiveThemeCssHrefs();

  return (
    <>
      <style
        id="quaypanel-theme-vars"
        dangerouslySetInnerHTML={{ __html: css }}
      />
      {cssHrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {faviconHref ? <link rel="icon" href={faviconHref} /> : null}
    </>
  );
}
