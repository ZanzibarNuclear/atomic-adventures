import { itemQuantity } from "./holdings.js";

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
  const byId = Object.fromEntries(allCharacterStats(character).map((stat) => [stat.id, stat]));
  const derivedHealth = derivedHealthVital(byId);
  return {
    health: derivedHealth,
    vitals: [
      vitalFromStat(byId.satiety ?? reserveFromPressureStat(byId.hunger, {
        id: "satiety",
        label: "Satiety",
        fallback: 100,
      }), {
        id: "satiety",
        label: "Satiety",
        fallback: 100,
        states: [
          [90, "Stuffed", "positive"],
          [55, "Full", "positive"],
          [40, "Peckish", "warning"],
          [10, "Hungry", "warning"],
          [0, "Starving", "error"],
        ],
      }),
      vitalFromStat(byId.hydration ?? reserveFromPressureStat(byId.thirst, {
        id: "hydration",
        label: "Hydration",
        fallback: 100,
      }), {
        id: "hydration",
        label: "Hydration",
        fallback: 100,
        states: [
          [60, "Hydrated", "positive"],
          [30, "Thirsty", "warning"],
          [10, "Parched", "error"],
          [0, "Dehydrated", "error"],
        ],
      }),
      vitalFromStat(byId.energy, {
        id: "energy",
        label: "Energy",
        fallback: 100,
        states: [
          [50, "Energized", "positive"],
          [25, "Tired", "warning"],
          [10, "Exhausted", "error"],
          [1, "Dozing", "error"],
          [0, "Spent", "error"],
        ],
      }),
      vitalFromStat(byId.composure, {
        id: "composure",
        label: "Composure",
        fallback: 80,
        states: [
          [90, "Calm", "positive"],
          [60, "Normal", "positive"],
          [40, "Concerned", "warning"],
          [10, "Nervous", "warning"],
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

export function derivedHealthValue(character) {
  const byId = Object.fromEntries(allCharacterStats(character).map((stat) => [stat.id, stat]));
  return derivedHealthVital(byId).value;
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
  const displayStates = displayStatesForStat(stat, options.states);
  return {
    id: options.id,
    label: options.label,
    value,
    min,
    max,
    displayStates: displayStates.map(([at, state, tone]) => ({ at, state, tone })),
    ...stateForValue(value, displayStates),
    description: stat?.description ?? null,
  };
}

function derivedHealthVital(byId) {
  const healthStat = byId.health;
  const min = finiteNumber(healthStat?.min, 0);
  const max = finiteNumber(healthStat?.max, 100);
  const base = clamp(finiteNumber(healthStat?.value, healthStat?.default ?? max), min, max);
  const value = clamp(base - derivedHealthPenalty(byId), min, max);
  const displayStates = displayStatesForStat(healthStat, [
    [80, "Healthy", "positive"],
    [50, "Stable", "positive"],
    [25, "Weak", "warning"],
    [1, "Critical", "error"],
    [0, "Collapsed", "error"],
  ]);
  return {
    id: "health",
    label: "Health",
    value,
    min,
    max,
    displayStates: displayStates.map(([at, state, tone]) => ({ at, state, tone })),
    ...stateForValue(value, displayStates),
    description: healthStat?.description ??
      "Overall physical condition calculated from survival pressures and injuries.",
    derived: true,
  };
}

function derivedHealthPenalty(byId) {
  return reservePenalty(byId.hydration, [
    [0, 100],
    [5, 35],
    [15, 15],
  ]) +
    reservePenalty(byId.satiety, [
      [0, 100],
      [5, 20],
      [10, 8],
    ]) +
    conditionPenalty(byId.injured ?? byId.injury, 0.9) +
    conditionPenalty(byId.poisoned ?? byId.poison, 1) +
    conditionPenalty(byId.sick ?? byId.illness, 0.8);
}

function reservePenalty(stat, bands) {
  if (!stat) return 0;
  const min = finiteNumber(stat.min, 0);
  const max = finiteNumber(stat.max, 100);
  const value = clamp(finiteNumber(stat.value, stat.default ?? max), min, max);
  for (const [at, penalty] of bands) {
    if (value <= at) return penalty;
  }
  return 0;
}

function conditionPenalty(stat, multiplier) {
  if (!stat) return 0;
  const value = Math.max(0, finiteNumber(stat.value, stat.default ?? 0));
  return value * multiplier;
}

function reserveFromPressureStat(stat, options) {
  if (!stat) return null;
  const min = finiteNumber(stat.min, 0);
  const max = finiteNumber(stat.max, 100);
  const pressure = clamp(finiteNumber(stat.value, stat.default ?? min), min, max);
  return {
    id: options.id,
    label: options.label,
    type: "meter",
    min,
    max,
    value: max - (pressure - min),
    default: options.fallback,
    description: stat.description ?? null,
  };
}

function displayStatesForStat(stat, fallback) {
  const states = (stat?.displayStates ?? [])
    .map((state) => [
      Number(state.at),
      String(state.state ?? "").trim(),
      String(state.tone ?? "positive").trim() || "positive",
    ])
    .filter(([at, state]) => Number.isFinite(at) && state)
    .sort((a, b) => b[0] - a[0]);
  return states.length ? states : fallback;
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

function allCharacterStats(character) {
  return ordered(character.definitions?.stats)
    .map((definition) => ({
      ...definition,
      value: character.stats?.[definition.id] ?? definition.default ?? null,
    }));
}

function ordered(items = []) {
  return [...(items ?? [])].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0) ||
      String(left.label ?? left.title ?? left.id).localeCompare(
        String(right.label ?? right.title ?? right.id),
      ),
  );
}
