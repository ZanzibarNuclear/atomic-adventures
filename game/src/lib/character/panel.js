import { itemQuantity } from "./holdings.js";

const DEFAULT_TABS = ["overview", "inventory"];

export function characterTabs(definitions = {}) {
  const tabs = definitions.panel?.tabs?.length
    ? definitions.panel.tabs
    : DEFAULT_TABS;
  return tabs.map((id) => ({
    id,
    label: labelForTab(id),
  }));
}

export function visibleCharacterStats(character) {
  return ordered(character.definitions?.stats)
    .filter((definition) => visibleDefinition(
      definition,
      character.stats?.[definition.id] !== undefined,
    ))
    .map((definition) => ({
      ...definition,
      value: character.stats?.[definition.id] ?? definition.default ?? null,
    }));
}

export function characterWellbeingOverview(character) {
  const stats = visibleCharacterStats(character);
  const byId = Object.fromEntries(stats.map((stat) => [stat.id, stat]));
  return {
    vitals: [
      vitalFromStat(byId.health, {
        id: "health",
        label: "Health",
        fallback: 100,
        states: [
          [80, "Healthy", "positive"],
          [50, "Stable", "positive"],
          [25, "Weak", "warning"],
          [1, "Critical", "error"],
          [0, "Collapsed", "error"],
        ],
      }),
      vitalFromStat(byId.satiety, {
        id: "satiety",
        label: "Satiety",
        fallback: 100,
        states: [
          [80, "Sated", "positive"],
          [50, "Fed", "positive"],
          [25, "Hungry", "warning"],
          [1, "Very hungry", "error"],
          [0, "Starving", "error"],
        ],
      }),
      vitalFromStat(byId.hydration, {
        id: "hydration",
        label: "Hydration",
        fallback: 100,
        states: [
          [80, "Hydrated", "positive"],
          [50, "Okay", "positive"],
          [25, "Thirsty", "warning"],
          [1, "Dehydrated", "error"],
          [0, "Severely dehydrated", "error"],
        ],
      }),
      vitalFromStat(byId.energy, {
        id: "energy",
        label: "Energy",
        fallback: 100,
        states: [
          [80, "Rested", "positive"],
          [50, "Tired", "warning"],
          [25, "Exhausted", "error"],
          [1, "Spent", "error"],
          [0, "Asleep on feet", "error"],
        ],
      }),
      vitalFromStat(byId.composure, {
        id: "composure",
        label: "Composure",
        fallback: 100,
        states: [
          [80, "Calm", "positive"],
          [50, "Alert", "positive"],
          [25, "Nervous", "warning"],
          [1, "Scared", "error"],
          [0, "Panicked", "error"],
        ],
      }),
    ],
    conditions: [
      conditionFromStat(byId.injured ?? byId.injury, {
        id: "injured",
        label: "Injured",
        clear: "No injuries",
        states: [
          [75, "Severe injury", "error"],
          [45, "Moderate injury", "error"],
          [15, "Minor injury", "warning"],
          [1, "Bruised", "warning"],
          [0, "No injuries", "positive"],
        ],
      }),
      conditionFromStat(byId.poisoned ?? byId.poison, {
        id: "poisoned",
        label: "Poisoned",
        clear: "No poison",
        states: [
          [70, "Dangerously poisoned", "error"],
          [35, "Poisoned", "error"],
          [1, "Mild poison", "warning"],
          [0, "No poison", "positive"],
        ],
      }),
      conditionFromStat(byId.sick ?? byId.illness, {
        id: "sick",
        label: "Sick",
        clear: "No sickness",
        states: [
          [70, "Severely sick", "error"],
          [35, "Sick", "error"],
          [1, "Under the weather", "warning"],
          [0, "No sickness", "positive"],
        ],
      }),
    ],
  };
}

export function visibleInventoryGroups(character) {
  const definitions = character.definitions ?? {};
  const groups = ordered(definitions.panel?.inventoryGroups);
  const groupById = Object.fromEntries(groups.map((group) => [group.id, {
    ...group,
    items: [],
  }]));
  const ungrouped = { id: "other", label: "Other", order: Number.MAX_SAFE_INTEGER, items: [] };

  for (const definition of ordered(definitions.items)) {
    const quantity = itemQuantity(character.holdings, definition.id);
    if (!visibleDefinition(definition, quantity > 0)) continue;
    const item = { ...definition, quantity };
    (groupById[definition.group] ?? ungrouped).items.push(item);
  }

  return [...Object.values(groupById), ungrouped]
    .filter((group) => group.items.length);
}

export function activeQuestSummaries(character) {
  const definitions = ordered(character.definitions?.quests);
  return definitions
    .map((definition) => ({
      ...definition,
      state: character.quests?.[definition.id],
    }))
    .filter((quest) => ["available", "active"].includes(quest.state?.status));
}

export function questSections(character) {
  const sections = {
    available: [],
    active: [],
    completed: [],
    failed: [],
  };
  for (const definition of ordered(character.definitions?.quests)) {
    const state = character.quests?.[definition.id];
    if (!state || !visibleDefinition(definition, true)) continue;
    const key = state.status === "abandoned" ? "failed" : state.status;
    if (!sections[key]) continue;
    sections[key].push({
      ...definition,
      state,
      objectives: ordered(definition.objectives).map((objective) => ({
        ...objective,
        state: state.objectives?.[objective.id] ?? { status: "pending", count: 0 },
      })),
    });
  }
  return sections;
}

export function acquiredEntries(character, domain) {
  const definitions = ordered(character.definitions?.[domain]);
  const state = character[domain] ?? {};
  return definitions
    .filter((definition) => visibleDefinition(definition, !!state[definition.id]))
    .map((definition) => ({ ...definition, state: state[definition.id] }));
}

export function formatStatValue(stat) {
  if (stat.value == null) return "—";
  if (stat.type === "boolean") return stat.value ? "Yes" : "No";
  if (stat.type === "meter" && Number.isFinite(Number(stat.max))) {
    return `${formatNumber(stat.value)} / ${formatNumber(stat.max)}`;
  }
  return formatNumber(stat.value);
}

export function formatVitalValue(vital) {
  if (vital.value == null || vital.max == null) return vital.state;
  return `${vital.state} · ${formatNumber(vital.value)} / ${formatNumber(vital.max)}`;
}

function vitalFromStat(stat, options) {
  const min = finiteNumber(stat?.min, 0);
  const max = finiteNumber(stat?.max, 100);
  const value = clamp(finiteNumber(stat?.value, options.fallback), min, max);
  return {
    id: options.id,
    label: options.label,
    value,
    min,
    max,
    ...stateForValue(value, options.states),
    description: stat?.description ?? null,
  };
}

function conditionFromStat(stat, options) {
  if (!stat) {
    return { id: options.id, label: options.label, state: options.clear, tone: "positive", active: false };
  }
  const value = Math.max(0, finiteNumber(stat.value, stat.default ?? 0));
  return {
    id: options.id,
    label: options.label,
    ...stateForValue(value, options.states),
    active: value > 0,
  };
}

function stateForValue(value, states) {
  for (const [minimum, label, tone = "positive"] of states) {
    if (value >= minimum) return { state: label, tone };
  }
  const fallback = states.at(-1);
  return { state: fallback?.[1] ?? String(value), tone: fallback?.[2] ?? "positive" };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(number);
}

function visibleDefinition(definition, acquired) {
  if (definition.visible === "hidden") return false;
  if (["when-acquired", "when-started"].includes(definition.visible)) return acquired;
  return true;
}

function ordered(items = []) {
  return [...(items ?? [])].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0) ||
      String(left.label ?? left.title ?? left.id).localeCompare(
        String(right.label ?? right.title ?? right.id),
      ),
  );
}

function labelForTab(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
