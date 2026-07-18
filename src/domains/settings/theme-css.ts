import { DEFAULT_THEME_COLORS } from "@/src/domains/settings/defaults";

const COLOR_TO_CSS: Record<string, string> = {
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

function blockFromColors(
  selector: string,
  colors: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const [key, cssVar] of Object.entries(COLOR_TO_CSS)) {
    if (colors[key]) {
      lines.push(`  ${cssVar}: ${colors[key]};`);
    }
  }
  // Keep ring in sync with primary for focus states
  if (colors.primary) {
    lines.push(`  --ring: ${colors.primary};`);
  }
  if (colors.bgSecondary && !colors.card) {
    // card already mapped from bgSecondary
  }
  if (colors.text) {
    lines.push(`  --card-foreground: ${colors.text};`);
  }
  return `${selector} {\n${lines.join("\n")}\n}`;
}

export function buildThemeCss(
  lightInput?: Record<string, string> | null,
  darkInput?: Record<string, string> | null,
): string {
  const light = {
    ...DEFAULT_THEME_COLORS.light,
    ...(lightInput ?? {}),
  };
  const dark = {
    ...DEFAULT_THEME_COLORS.dark,
    ...(darkInput ?? {}),
  };
  return [
    blockFromColors(":root", light),
    blockFromColors(".dark", dark),
  ].join("\n");
}
