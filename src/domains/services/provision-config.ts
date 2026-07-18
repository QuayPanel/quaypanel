type SelectionChoice = {
  id?: string;
  name?: string;
  envKey?: string | null;
};

type OrderSelection = {
  configOptionId?: string;
  type?: string;
  name?: string;
  envKey?: string | null;
  value?: string | null;
  choiceIds?: string[];
  choices?: SelectionChoice[];
};

type OrderItemConfig = {
  selections?: OrderSelection[];
};

const TOP_LEVEL_STRING_KEYS = new Set(["dockerImage", "startup"]);
const TOP_LEVEL_NUMBER_KEYS = new Set([
  "eggId",
  "nestId",
  "nodeId",
  "locationId",
]);
const TOP_LEVEL_BOOL_KEYS = new Set([
  "skipScripts",
  "dedicatedIp",
  "startOnCompletion",
  "oomKiller",
]);
const LIMIT_KEYS = new Set([
  "memory",
  "swap",
  "disk",
  "io",
  "cpu",
  "threads",
]);
const FEATURE_LIMIT_KEYS = new Set(["databases", "backups", "allocations"]);

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

function resolveSelectionValue(selection: OrderSelection): string | null {
  const type = String(selection.type ?? "").toUpperCase();
  if (type === "TEXT" || type === "NUMBER") {
    const value = selection.value;
    if (value == null || String(value).trim() === "") return null;
    return String(value);
  }

  const choices = selection.choices ?? [];
  const envValues = choices
    .map((c) => (c.envKey == null ? "" : String(c.envKey).trim()))
    .filter(Boolean);

  if (type === "CHECKBOX") {
    if (envValues.length === 0) return null;
    if (envValues.length === 1) return envValues[0];
    return envValues.join(",");
  }

  // SELECT / RADIO / SLIDER / default: first choice envKey
  return envValues[0] ?? null;
}

function applyReservedOverride(
  config: Record<string, unknown>,
  key: string,
  raw: string,
) {
  if (TOP_LEVEL_NUMBER_KEYS.has(key)) {
    const n = Number(raw);
    if (Number.isFinite(n)) config[key] = n;
    return;
  }
  if (TOP_LEVEL_STRING_KEYS.has(key)) {
    config[key] = raw;
    return;
  }
  if (TOP_LEVEL_BOOL_KEYS.has(key)) {
    const b = parseBool(raw);
    if (b != null) config[key] = b;
    return;
  }
  if (LIMIT_KEYS.has(key)) {
    const limits =
      config.limits && typeof config.limits === "object"
        ? { ...(config.limits as Record<string, unknown>) }
        : {};
    if (key === "threads") {
      limits.threads = raw;
    } else {
      const n = Number(raw);
      if (Number.isFinite(n)) limits[key] = n;
    }
    config.limits = limits;
    return;
  }
  if (FEATURE_LIMIT_KEYS.has(key)) {
    const featureLimits =
      config.featureLimits && typeof config.featureLimits === "object"
        ? { ...(config.featureLimits as Record<string, unknown>) }
        : {};
    const n = Number(raw);
    if (Number.isFinite(n)) {
      featureLimits[key] = n;
      config.featureLimits = featureLimits;
    }
  }
}

function isReservedKey(key: string) {
  return (
    TOP_LEVEL_NUMBER_KEYS.has(key) ||
    TOP_LEVEL_STRING_KEYS.has(key) ||
    TOP_LEVEL_BOOL_KEYS.has(key) ||
    LIMIT_KEYS.has(key) ||
    FEATURE_LIMIT_KEYS.has(key)
  );
}

/**
 * Merge order-item config option selections onto product provisionConfig.
 * Reserved option envKeys override provision fields; all others become environment vars.
 */
export function mergeProvisionConfigFromSelections(
  base: Record<string, unknown> | null | undefined,
  orderItemConfig: unknown,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    ...(base && typeof base === "object" ? structuredClone(base) : {}),
  };

  const parsed =
    orderItemConfig && typeof orderItemConfig === "object"
      ? (orderItemConfig as OrderItemConfig)
      : null;
  const selections = Array.isArray(parsed?.selections) ? parsed.selections : [];
  if (!selections.length) return config;

  const environment: Record<string, string> = {
    ...(config.environment && typeof config.environment === "object"
      ? (config.environment as Record<string, string>)
      : {}),
  };

  for (const selection of selections) {
    const key = String(selection.envKey ?? "").trim();
    if (!key) continue;
    const value = resolveSelectionValue(selection);
    if (value == null) continue;

    if (isReservedKey(key)) {
      applyReservedOverride(config, key, value);
    } else {
      environment[key] = value;
    }
  }

  if (Object.keys(environment).length > 0) {
    config.environment = environment;
  }

  return config;
}
