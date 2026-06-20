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
    return `${stat.value} / ${stat.max}`;
  }
  return String(stat.value);
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
