import { reactive, toRaw } from "vue";
import {
  addItem,
  createHoldings,
  holdingRecords,
  itemQuantity,
  normalizeHoldings,
} from "../lib/character/holdings.js";

export function createCharacterState(definitions = {}, holderDefinitions = []) {
  const state = reactive({
    definitions: cloneDefinitions(definitions),
    holderDefinitions: clonePlain(holderDefinitions),
    holdings: createHoldings(definitions.profile?.id, holderDefinitions),
    stats: {},
    knowledge: {},
    skills: {},
    quests: {},
    documents: {},
    orphanItemIds: [],
  });
  initializeDefinitionDefaults(state);
  return state;
}

export function syncCharacterDefinitions(state, definitions = {}) {
  const previousOrphans = new Set(state.orphanItemIds);
  state.definitions = cloneDefinitions(definitions);
  initializeDefinitionDefaults(state);
  refreshOrphanItems(state);
  if (import.meta.env.DEV) {
    for (const id of state.orphanItemIds) {
      if (!previousOrphans.has(id)) {
        console.warn(`Saved character item "${id}" has no authored definition.`);
      }
    }
  }
}

export function syncCharacterHolderDefinitions(state, holderDefinitions = []) {
  state.holderDefinitions = clonePlain(holderDefinitions);
  const next = normalizeHoldings(state.holdings, state.definitions, holderDefinitions);
  for (const holder of holderDefinitions) {
    next.holders[holder.id] = {
      ...next.holders[holder.id],
      ...clonePlain(holder),
    };
  }
  state.holdings = next;
}

export function resetCharacterState(state) {
  state.holdings = createHoldings(
    state.definitions.profile?.id,
    state.holderDefinitions,
  );
  state.stats = {};
  state.knowledge = {};
  state.skills = {};
  state.quests = {};
  state.documents = {};
  state.orphanItemIds = [];
  initializeDefinitionDefaults(state);
}

export function captureCharacterState(state) {
  return {
    holdings: clonePlain(state.holdings),
    stats: clonePlain(state.stats),
    knowledge: clonePlain(state.knowledge),
    skills: clonePlain(state.skills),
    quests: clonePlain(state.quests),
    documents: clonePlain(state.documents),
  };
}

export function applyCharacterState(state, snapshot = {}) {
  const definitions = cloneDefinitions(state.definitions);
  state.definitions = definitions;
  initializeDefinitionDefaults(state);
  state.holdings = normalizeHoldings(
    snapshot.holdings,
    definitions,
    state.holderDefinitions,
  );
  state.stats = plainObject(snapshot.stats);
  state.knowledge = plainObject(snapshot.knowledge);
  state.skills = plainObject(snapshot.skills);
  state.quests = plainObject(snapshot.quests);
  state.documents = plainObject(snapshot.documents);
  refreshOrphanItems(state);
}

export function migrateLegacyInventory(state, ids = []) {
  state.holdings = createHoldings(
    state.definitions.profile?.id,
    state.holderDefinitions,
  );
  for (const id of ids) {
    if (!id) continue;
    addItem(state.holdings, state.definitions, id, 1, {
      validateDefinition: false,
    });
  }
  syncCharacterDefinitions(state, state.definitions);
}

export function characterItems(state, fallbackCatalog = {}, { includeOrphans = false } = {}) {
  const catalog = {
    ...fallbackCatalog,
    ...itemDefinitionById(state),
  };
  const ids = [...new Set(holdingRecords(
    state.holdings,
    state.definitions,
  ).map((record) => record.item))];
  return ids
    .map((id) => ({
      ...(catalog[id] ?? { id, label: id }),
      quantity: itemQuantity(state.holdings, id),
      orphan: !itemDefinitionById(state)[id],
    }))
    .filter((item) => item.quantity > 0)
    .filter((item) => includeOrphans || !item.orphan);
}

function initializeDefinitionDefaults(state) {
  for (const stat of state.definitions.stats ?? []) {
    if (state.stats[stat.id] === undefined && stat.default !== undefined) {
      state.stats[stat.id] = structuredClone(stat.default);
    }
  }
}

function itemDefinitionById(state) {
  return Object.fromEntries(
    (state.definitions.items ?? []).filter((item) => item.id).map((item) => [item.id, item]),
  );
}

function refreshOrphanItems(state) {
  state.orphanItemIds = [...new Set(
    holdingRecords(state.holdings, state.definitions)
      .map((record) => record.item)
      .filter((id) => !itemDefinitionById(state)[id]),
  )];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clonePlain(value)
    : {};
}

function cloneDefinitions(value) {
  return value && typeof value === "object" ? clonePlain(value) : {};
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(toRaw(value)));
}
