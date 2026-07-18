import { getPublicSettings, getSettingsMap } from "@/src/domains/settings/service";
import { buildThemeCss } from "@/src/domains/settings/theme-css";

/** Server-rendered theme variables so the first paint matches configured colors. */
export async function ThemeCss() {
  const map = getPublicSettings(await getSettingsMap());
  const css = buildThemeCss(
    (map["theme.colors.light"] as Record<string, string>) ?? null,
    (map["theme.colors.dark"] as Record<string, string>) ?? null,
  );
  const favicon = String(map["brand.faviconUrl"] || "").trim();

  return (
    <>
      <style
        id="quaypanel-theme-vars"
        dangerouslySetInnerHTML={{ __html: css }}
      />
      {favicon ? (
        <link rel="icon" href={favicon} />
      ) : null}
    </>
  );
}
