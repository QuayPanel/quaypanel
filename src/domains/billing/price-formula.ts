import { ValidationError } from "@/src/core/errors";

const LIMIT_KEYS = new Set([
  "memory",
  "swap",
  "disk",
  "io",
  "cpu",
  "threads",
]);
const FEATURE_LIMIT_KEYS = new Set(["databases", "backups", "allocations"]);
const TOP_LEVEL_NUMBER_KEYS = new Set([
  "eggId",
  "nestId",
  "nodeId",
  "locationId",
]);

type SelectionChoice = { envKey?: string | null };
type SelectionLike = {
  envKey?: string | null;
  type?: string | null;
  value?: string | null;
  choices?: SelectionChoice[];
};

function setVar(
  vars: Record<string, number>,
  key: string,
  value: unknown,
) {
  const n = Number(value);
  if (Number.isFinite(n)) vars[key] = n;
}

function selectionNumericValue(selection: SelectionLike): number | null {
  const type = String(selection.type ?? "").toUpperCase();
  if (type === "TEXT" || type === "NUMBER") {
    const n = Number(selection.value);
    return Number.isFinite(n) ? n : null;
  }
  const choices = selection.choices ?? [];
  const values = choices
    .map((c) => String(c.envKey ?? "").trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  // CHECKBOX with multiple: use sum (useful for additive allocations); else first
  if (type === "CHECKBOX" && values.length > 1) {
    return values.reduce((a, b) => a + b, 0);
  }
  return values[0];
}

/** Build `{server.*}` values from product provisionConfig defaults. */
export function serverVarsFromProvisionConfig(
  provisionConfig: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const vars: Record<string, number> = {};
  if (!provisionConfig || typeof provisionConfig !== "object") return vars;

  const limits =
    provisionConfig.limits && typeof provisionConfig.limits === "object"
      ? (provisionConfig.limits as Record<string, unknown>)
      : {};
  const features =
    provisionConfig.featureLimits &&
    typeof provisionConfig.featureLimits === "object"
      ? (provisionConfig.featureLimits as Record<string, unknown>)
      : {};

  for (const key of LIMIT_KEYS) {
    if (key === "threads") continue;
    setVar(vars, `server.${key}`, limits[key]);
  }
  for (const key of FEATURE_LIMIT_KEYS) {
    setVar(vars, `server.${key}`, features[key]);
  }
  for (const key of TOP_LEVEL_NUMBER_KEYS) {
    setVar(vars, `server.${key}`, provisionConfig[key]);
  }
  return vars;
}

/** Overlay config-option selections onto server vars (selections win). */
export function applySelectionServerVars(
  base: Record<string, number>,
  selections: SelectionLike[] | undefined,
): Record<string, number> {
  const vars = { ...base };
  for (const selection of selections ?? []) {
    const envKey = String(selection.envKey ?? "").trim();
    if (!envKey) continue;
    const value = selectionNumericValue(selection);
    if (value == null) continue;
    vars[`server.${envKey}`] = value;
    vars[envKey] = value;
  }
  return vars;
}

export function resolveServerPriceVars(
  provisionConfig: Record<string, unknown> | null | undefined,
  selections?: SelectionLike[],
): Record<string, number> {
  return applySelectionServerVars(
    serverVarsFromProvisionConfig(provisionConfig),
    selections,
  );
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (/\d/.test(ch) || ch === ".") {
      let j = i + 1;
      while (j < expr.length && /[\d.]/.test(expr[j])) j += 1;
      tokens.push(expr.slice(i, j));
      i = j;
      continue;
    }
    throw new ValidationError(`Invalid character "${ch}" in price formula`);
  }
  return tokens;
}

function parseExpression(tokens: string[]): number {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function consume() {
    return tokens[pos++];
  }

  function parsePrimary(): number {
    const t = peek();
    if (t === "(") {
      consume();
      const v = parseAdd();
      if (consume() !== ")") {
        throw new ValidationError("Mismatched parentheses in price formula");
      }
      return v;
    }
    if (t === "-") {
      consume();
      return -parsePrimary();
    }
    if (t === "+") {
      consume();
      return parsePrimary();
    }
    const num = consume();
    if (num == null || !/^\d+(\.\d+)?$/.test(num)) {
      throw new ValidationError("Invalid number in price formula");
    }
    return Number(num);
  }

  function parseMul(): number {
    let v = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parsePrimary();
      if (op === "*") v *= right;
      else {
        if (right === 0) {
          throw new ValidationError("Division by zero in price formula");
        }
        v /= right;
      }
    }
    return v;
  }

  function parseAdd(): number {
    let v = parseMul();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseMul();
      if (op === "+") v += right;
      else v -= right;
    }
    return v;
  }

  const value = parseAdd();
  if (pos !== tokens.length) {
    throw new ValidationError("Unexpected trailing tokens in price formula");
  }
  return value;
}

/**
 * Evaluate a dollar-amount formula with `{server.memory}`-style placeholders.
 * Returns a dollar amount (not minor units).
 */
export function evaluatePriceFormula(
  formula: string,
  vars: Record<string, number>,
): number {
  const trimmed = formula.trim();
  if (!trimmed) {
    throw new ValidationError("Price formula is empty");
  }

  const substituted = trimmed.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, key: string) => {
    if (!(key in vars) || !Number.isFinite(vars[key])) {
      throw new ValidationError(
        `Missing value for placeholder {${key}} in price formula`,
      );
    }
    return String(vars[key]);
  });

  if (/[{}]/.test(substituted)) {
    throw new ValidationError("Unresolved placeholders in price formula");
  }

  const tokens = tokenize(substituted);
  const dollars = parseExpression(tokens);
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new ValidationError("Price formula evaluated to an invalid amount");
  }
  return dollars;
}

/** True when the string is a plain number (no operators/placeholders). */
export function isPlainPriceInput(input: string): boolean {
  return /^\d+(\.\d+)?$/.test(input.trim());
}

/** Evaluate formula (or plain dollars) to minor units. */
export function priceInputToMinor(
  input: string,
  vars: Record<string, number>,
): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError("Price is required");
  }
  const dollars = isPlainPriceInput(trimmed)
    ? Number(trimmed)
    : evaluatePriceFormula(trimmed, vars);
  return Math.round(dollars * 100);
}

export function planPriceMinor(input: {
  price: number;
  priceFormula?: string | null;
  vars: Record<string, number>;
}): number {
  if (input.priceFormula && input.priceFormula.trim()) {
    return Math.round(evaluatePriceFormula(input.priceFormula, input.vars) * 100);
  }
  return input.price;
}
