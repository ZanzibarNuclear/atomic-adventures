import { markRaw, reactive, toRaw } from "vue";

export function createCharacterState(definitions = {}) {
  const state = reactive({
    definitions: cloneDefinitions(definitions),
    holdings: { items: {} },
    stats: {},
    knowledge: {},
    skills: {},
    quests: {},
    documents: {},
    orphanItemIds: [],
    inventory: null,
  });
  state.inventory = markRaw(createInventoryAdapter(state));
  initializeDefinitionDefaults(state);
  return state;
}

export function syncCharacterDefinitions(state, definitions = {}) {
  const previousOrphans = new Set(state.orphanItemIds);
  state.definitions = cloneDefinitions(definitions);
  initializeDefinitionDefaults(state);
  state.orphanItemIds = Object.keys(state.holdings.items)
    .filter((id) => !itemDefinitionById(state)[id]);
  if (import.meta.env.DEV) {
    for (const id of state.orphanItemIds) {
      if (!previousOrphans.has(id)) {
        console.warn(`Saved character item "${id}" has no authored definition.`);
      }
    }
  }
}

export function resetCharacterState(state) {
  state.holdings = { items: {} };
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
  state.holdings = normalizeHoldings(snapshot.holdings);
  state.stats = plainObject(snapshot.stats);
  state.knowledge = plainObject(snapshot.knowledge);
  state.skills = plainObject(snapshot.skills);
  state.quests = plainObject(snapshot.quests);
  state.documents = plainObject(snapshot.documents);
  syncCharacterDefinitions(state, state.definitions);
}

export function migrateLegacyInventory(state, ids = []) {
  state.holdings = { items: {} };
  for (const id of ids) {
    if (!id) continue;
    state.holdings.items[id] = { quantity: 1 };
  }
  syncCharacterDefinitions(state, state.definitions);
}

export function characterItems(state, fallbackCatalog = {}, { includeOrphans = false } = {}) {
  const catalog = {
    ...fallbackCatalog,
    ...itemDefinitionById(state),
  };
  return [...state.inventory]
    .map((id) => ({
      ...(catalog[id] ?? { id, label: id }),
      quantity: state.holdings.items[id]?.quantity ?? 0,
      orphan: !itemDefinitionById(state)[id],
    }))
    .filter((item) => includeOrphans || !item.orphan);
}

function createInventoryAdapter(state) {
  return {
    has(id) {
      return (state.holdings.items[id]?.quantity ?? 0) > 0;
    },
    add(id) {
      if (!id) return this;
      const existing = state.holdings.items[id]?.quantity ?? 0;
      state.holdings.items[id] = { quantity: Math.max(1, existing) };
      syncCharacterDefinitions(state, state.definitions);
      return this;
    },
    delete(id) {
      if (!this.has(id)) return false;
      delete state.holdings.items[id];
      syncCharacterDefinitions(state, state.definitions);
      return true;
    },
    clear() {
      state.holdings = { items: {} };
      state.orphanItemIds = [];
    },
    get size() {
      return Object.values(state.holdings.items)
        .filter((entry) => (entry?.quantity ?? 0) > 0).length;
    },
    *values() {
      for (const [id, entry] of Object.entries(state.holdings.items)) {
        if ((entry?.quantity ?? 0) > 0) yield id;
      }
    },
    [Symbol.iterator]() {
      return this.values();
    },
  };
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

function normalizeHoldings(value) {
  const items = plainObject(value?.items);
  return {
    items: Object.fromEntries(
      Object.entries(items)
        .filter(([id, entry]) => id && Number(entry?.quantity) > 0)
        .map(([id, entry]) => [id, { quantity: Number(entry.quantity) }]),
    ),
  };
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
