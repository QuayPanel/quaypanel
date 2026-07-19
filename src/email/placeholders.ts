/** Replace `{{key}}` placeholders. Unknown keys become empty strings. */
export function applyPlaceholders(
  input: string,
  vars: Record<string, unknown>,
): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value == null) return "";
    return String(value);
  });
}

export function buildEmailContext(
  settings: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const brand = String(
    settings["brand.name"] || payload.brand || payload.brandName || "QuayPanel",
  );
  const appUrl = String(
    settings["app.url"] || payload.appUrl || "http://localhost:3000",
  ).replace(/\/$/, "");

  return {
    brand,
    brandName: brand,
    appUrl,
    ...payload,
    name: payload.name ?? payload.clientName ?? "",
    clientName: payload.clientName ?? payload.name ?? "",
  };
}
