import { reactive, toRaw } from "vue";
import {
  createHoldings,
  holdingRecords,
  itemQuantity,
  normalizeHoldings,
  totalItemQuantity,
} from "../lib/character/holdings.js";

export function createCharacterState(definitions = {}, holderDefinitions = []) {
  const state = reactive({
    definitions: cloneDefinitions(definitions),
    holderDefinitions: clonePlain(holderDefinitions),
    holdings: normalizeHoldings(
      definitions.holdings,
      definitions,
      holderDefinitions,
    ),
    stats: {},
    knowledge: {},
    skills: {},
    quests: {},
    documents: {},
    orphanItemIds: [],
    revision: 0,
  });
  initializeDefinitionDefaults(state);
  return state;
}

export function markCharacterChanged(state) {
  state.revision = Number(state.revision ?? 0) + 1;
}

export function syncCharacterDefinitions(state, definitions = {}) {
  const previousOrphans = new Set(state.orphanItemIds);
  state.definitions = cloneDefinitions(definitions);
  initializeDefinitionDefaults(state);
  mergeAuthoredHoldings(state);
  refreshOrphanItems(state);
  markCharacterChanged(state);
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
  markCharacterChanged(state);
}

export function resetCharacterState(state) {
  state.holdings = createHoldings(
    state.definitions.profile?.id,
    state.holderDefinitions,
  );
  state.holdings = normalizeHoldings(
    state.definitions.holdings,
    state.definitions,
    state.holderDefinitions,
  );
  state.stats = {};
  state.knowledge = {};
  state.skills = {};
  state.quests = {};
  state.documents = {};
  state.orphanItemIds = [];
  initializeDefinitionDefaults(state);
  markCharacterChanged(state);
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
  mergeAuthoredHoldings(state);
  state.stats = plainObject(snapshot.stats);
  state.knowledge = plainObject(snapshot.knowledge);
  state.skills = plainObject(snapshot.skills);
  state.quests = plainObject(snapshot.quests);
  state.documents = plainObject(snapshot.documents);
  refreshOrphanItems(state);
  markCharacterChanged(state);
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

function mergeAuthoredHoldings(state) {
  const authored = state.definitions?.holdings;
  if (!authored || !state.holdings) return;
  const next = normalizeHoldings(state.holdings, state.definitions, state.holderDefinitions);
  let changed = false;

  for (const [id, holder] of Object.entries(authored.holders ?? {})) {
    if (next.holders[id]) continue;
    next.holders[id] = clonePlain(holder);
    changed = true;
  }

  for (const [id, stack] of Object.entries(authored.stacks ?? {})) {
    if (next.stacks[id]) continue;
    if (!next.holders[stack.holder]) continue;
    if (totalItemQuantity(next, stack.item) > 0) continue;
    next.stacks[id] = clonePlain(stack);
    changed = true;
  }

  for (const [id, instance] of Object.entries(authored.instances ?? {})) {
    if (next.instances[id]) continue;
    if (!next.holders[instance.holder]) continue;
    if (totalItemQuantity(next, instance.item) > 0) continue;
    next.instances[id] = clonePlain(instance);
    changed = true;
  }

  if (!changed) return;
  next.nextId = Math.max(Number(next.nextId) || 1, Number(authored.nextId) || 1);
  state.holdings = normalizeHoldings(next, state.definitions, state.holderDefinitions);
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
