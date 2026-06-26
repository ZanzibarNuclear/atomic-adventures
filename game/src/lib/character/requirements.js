const NUMERIC_OPERATORS = {
  eq: (actual, expected) => actual === expected,
  ne: (actual, expected) => actual !== expected,
  gt: (actual, expected) => actual > expected,
  gte: (actual, expected) => actual >= expected,
  lt: (actual, expected) => actual < expected,
  lte: (actual, expected) => actual <= expected,
};

export function normalizeRequirements(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    flags: normalizeGroups(source.flags ?? {
      all: source.all,
      any: source.any,
      not: source.not,
    }),
    items: normalizeItemGroups(source.items),
    stats: array(source.stats),
    knowledge: normalizeGroups(source.knowledge),
    skills: array(source.skills),
    evidence: array(source.evidence),
    quests: array(source.quests),
    documents: normalizeGroups(source.documents),
  };
}

export function evaluateRequirements(input, {
  character,
  flags = new Set(),
  nearbyHolderIds = [],
} = {}) {
  const require = normalizeRequirements(input);
  const reasons = [];
  evaluateGroups(require.flags, (id) => flags.has(id), "flags", reasons);
  evaluateItemGroups(require.items, character, reasons, nearbyHolderIds);
  evaluateConditions(require.stats, (condition) => character.stats?.[condition.id], "stats", reasons);
  evaluateGroups(
    require.knowledge,
    (id) => !!character.knowledge?.[id],
    "knowledge",
    reasons,
  );
  evaluateConditions(
    require.skills,
    (condition) => character.skills?.[condition.id]?.rank ?? 0,
    "skills",
    reasons,
    "rank",
  );
  evaluateConditions(
    require.evidence,
    (condition) => character.skills?.[condition.skill]?.evidence?.[condition.id] ?? 0,
    "evidence",
    reasons,
  );
  for (const condition of require.quests) {
    const actual = character.quests?.[condition.id]?.status ?? "unavailable";
    if (actual !== condition.status) {
      reasons.push({ domain: "quests", id: condition.id, expected: condition.status, actual });
    }
  }
  evaluateGroups(
    require.documents,
    (id) => !!character.documents?.[id],
    "documents",
    reasons,
  );
  return { ok: reasons.length === 0, reasons, require };
}

function evaluateItemGroups(groups, character, reasons, nearbyHolderIds) {
  const quantity = (entry) => itemQuantity(character.holdings, entry.id, {
    access: entry.access ?? "carried",
    nearbyHolderIds,
  });
  for (const entry of groups.all) {
    const actual = quantity(entry);
    if (actual < entry.quantity) reasons.push({ domain: "items", id: entry.id, expected: entry.quantity, actual });
  }
  if (groups.any.length && !groups.any.some((entry) => quantity(entry) >= entry.quantity)) {
    reasons.push({ domain: "items", code: "any", ids: groups.any.map((entry) => entry.id) });
  }
  for (const entry of groups.not) {
    const actual = quantity(entry);
    if (actual >= entry.quantity) reasons.push({ domain: "items", id: entry.id, code: "not", actual });
  }
}

function evaluateGroups(groups, has, domain, reasons) {
  for (const id of groups.all) if (!has(id)) reasons.push({ domain, id, code: "all" });
  if (groups.any.length && !groups.any.some(has)) {
    reasons.push({ domain, code: "any", ids: groups.any });
  }
  for (const id of groups.not) if (has(id)) reasons.push({ domain, id, code: "not" });
}

function evaluateConditions(conditions, read, domain, reasons, valueField = "value") {
  for (const condition of conditions) {
    const actual = read(condition);
    const expected = condition[valueField] ?? condition.value;
    const op = condition.op ?? "eq";
    if (!NUMERIC_OPERATORS[op]?.(actual, expected)) {
      reasons.push({ domain, id: condition.id, op, expected, actual });
    }
  }
}

function normalizeItemGroups(value) {
  if (Array.isArray(value)) return { all: value.map(normalizeItem), any: [], not: [] };
  return {
    all: array(value?.all).map(normalizeItem),
    any: array(value?.any).map(normalizeItem),
    not: array(value?.not).map(normalizeItem),
  };
}

function normalizeItem(value) {
  if (typeof value === "string") return { id: value, quantity: 1, access: "carried" };
  return {
    id: String(value?.id ?? "").trim(),
    quantity: Math.max(1, Number(value?.quantity) || 1),
    access: value?.access ?? "carried",
  };
}

function normalizeGroups(value) {
  if (Array.isArray(value)) return { all: value.map(String), any: [], not: [] };
  return {
    all: stringList(value?.all),
    any: stringList(value?.any),
    not: stringList(value?.not),
  };
}

function stringList(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
import { itemQuantity } from "./holdings.js";
