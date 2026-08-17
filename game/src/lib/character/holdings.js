export function createHoldings(profileId = "player", holderDefinitions = []) {
  const characterId = `character:${profileId || "player"}`;
  return {
    holders: {
      [characterId]: {
        id: characterId,
        kind: "character",
        label: "Holding",
      },
      ...Object.fromEntries(
        holderDefinitions.map((holder) => [holder.id, clonePlain(holder)]),
      ),
    },
    stacks: {},
    instances: {},
    nextId: 1,
  };
}

export function normalizeHoldings(value, definitions = {}, holderDefinitions = []) {
  const profileId = definitions.profile?.id ?? "player";
  const normalized = createHoldings(profileId, holderDefinitions);
  if (value?.stacks || value?.instances || value?.holders) {
    normalized.holders = {
      ...normalized.holders,
      ...plainObject(value.holders),
    };
    normalized.stacks = plainObject(value.stacks);
    normalized.instances = plainObject(value.instances);
    normalized.nextId = Math.max(1, Number(value.nextId) || 1);
    ensureContainerHolders(normalized, definitions);
    return normalized;
  }
  for (const [itemId, entry] of Object.entries(value?.items ?? {})) {
    const quantity = Number(entry?.quantity);
    if (quantity > 0) {
      addItem(normalized, definitions, itemId, quantity, {
        holderId: characterHolderId(normalized),
        validateDefinition: false,
      });
    }
  }
  return normalized;
}

export function characterHolderId(holdings) {
  return Object.keys(holdings.holders ?? {}).find((id) => id.startsWith("character:"))
    ?? "character:player";
}

export function addItem(holdings, definitions, itemId, quantity = 1, {
  holderId = characterHolderId(holdings),
  validateDefinition = true,
} = {}) {
  const definition = itemDefinition(definitions, itemId);
  if (!definition && validateDefinition) throw new Error(`Unknown item "${itemId}".`);
  const item = definition ?? { id: itemId, carrying: "unique", maxQuantity: 1 };
  const amount = positiveQuantity(quantity);
  requireHolder(holdings, holderId);
  if (totalItemQuantity(holdings, itemId) + amount > Number(item.maxQuantity ?? Infinity)) {
    throw new Error(`Adding ${itemId} exceeds its maximum quantity.`);
  }
  assertHolderAccepts(holdings, definitions, holderId, item, amount);

  if (item.carrying === "stack") {
    const existing = Object.values(holdings.stacks)
      .find((stack) => stack.item === itemId && stack.holder === holderId);
    if (existing) existing.quantity += amount;
    else {
      const id = nextRecordId(holdings, `stack-${itemId}`);
      holdings.stacks[id] = { item: itemId, quantity: amount, holder: holderId };
    }
    return;
  }

  if (!Number.isInteger(amount)) throw new Error("Unique item quantity must be an integer.");
  for (let index = 0; index < amount; index += 1) {
    const id = nextRecordId(holdings, itemId);
    holdings.instances[id] = { item: itemId, holder: holderId };
    if (item.container) {
      const containerId = `container:${id}`;
      holdings.holders[containerId] = {
        id: containerId,
        kind: "container",
        label: item.label ?? itemId,
        instance: id,
        capacity: clonePlain(item.container.capacity ?? {}),
        accepts: clonePlain(item.container.accepts ?? {}),
        nesting: item.container.nesting === true,
      };
    }
  }
}

export function removeItem(holdings, definitions, itemId, quantity = 1, {
  access = "carried",
  nearbyHolderIds = [],
  holderId = null,
} = {}) {
  let remaining = positiveQuantity(quantity);
  const accessible = holderId
    ? new Set([holderId])
    : accessibleHolderIds(holdings, access, nearbyHolderIds);
  if (itemQuantity(holdings, itemId, { access, nearbyHolderIds, holderId }) < remaining) {
    throw new Error(`Not enough ${itemId} to remove.`);
  }
  for (const [id, stack] of Object.entries(holdings.stacks)) {
    if (stack.item !== itemId || !accessible.has(stack.holder) || remaining <= 0) continue;
    const removed = Math.min(stack.quantity, remaining);
    stack.quantity -= removed;
    remaining -= removed;
    if (stack.quantity <= 0) delete holdings.stacks[id];
  }
  for (const [id, instance] of Object.entries(holdings.instances)) {
    if (instance.item !== itemId || !accessible.has(instance.holder) || remaining <= 0) continue;
    deleteInstance(holdings, id);
    remaining -= 1;
  }
}

export function transferHolding(holdings, definitions, {
  type,
  id,
  quantity = 1,
  toHolder,
}) {
  requireHolder(holdings, toHolder);
  if (type === "instance") {
    const instance = holdings.instances[id];
    if (!instance) throw new Error(`Unknown item instance "${id}".`);
    if (instance.holder === toHolder) return;
    const definition = itemDefinition(definitions, instance.item);
    if (definition?.portable === false) throw new Error(`${instance.item} is not portable.`);
    if (definition?.properties?.bound === true) {
      throw new Error("Those pages stay in the binder.");
    }
    assertNoHolderCycle(holdings, id, toHolder);
    assertHolderAccepts(holdings, definitions, toHolder, definition, 1);
    instance.holder = toHolder;
    return;
  }
  if (type === "stack") {
    const stack = holdings.stacks[id];
    if (!stack) throw new Error(`Unknown item stack "${id}".`);
    if (stack.holder === toHolder) return;
    const amount = positiveQuantity(quantity);
    if (amount > stack.quantity) throw new Error("Not enough items in the source stack.");
    const definition = itemDefinition(definitions, stack.item);
    if (definition?.portable === false) throw new Error(`${stack.item} is not portable.`);
    if (definition?.properties?.bound === true) {
      throw new Error("Those pages stay in the binder.");
    }
    assertHolderAccepts(holdings, definitions, toHolder, definition, amount);
    const target = Object.values(holdings.stacks)
      .find((entry) => entry.item === stack.item && entry.holder === toHolder);
    if (target) target.quantity += amount;
    else {
      const nextId = nextRecordId(holdings, `stack-${stack.item}`);
      holdings.stacks[nextId] = { item: stack.item, quantity: amount, holder: toHolder };
    }
    stack.quantity -= amount;
    if (stack.quantity <= 0) delete holdings.stacks[id];
    return;
  }
  throw new Error(`Unknown holding type "${type}".`);
}

export function ensureWorldHolder(holdings, location) {
  const key = [
    location.place ?? "world",
    location.hex ?? location.room ?? location.exteriorNode ?? "unknown",
    location.stand ?? "",
  ].filter(Boolean).join(":");
  const id = `world:${key}`;
  holdings.holders[id] ??= {
    id,
    kind: "world",
    label: "Within reach",
    location: clonePlain(location),
  };
  return id;
}

export function moveHolder(holdings, holderId, location) {
  const holder = requireHolder(holdings, holderId);
  if (!["vehicle", "fixed", "world"].includes(holder.kind)) {
    throw new Error(`Holder "${holderId}" does not have a world location.`);
  }
  holder.location = clonePlain(location);
}

export function accessibleHolderIds(holdings, access = "carried", nearbyHolderIds = []) {
  if (access === "anywhere") return new Set(Object.keys(holdings.holders ?? {}));
  const roots = [characterHolderId(holdings)];
  if (access === "nearby") roots.push(...nearbyHolderIds);
  const result = new Set();
  const queue = roots.filter((id) => holdings.holders?.[id]);
  while (queue.length) {
    const holderId = queue.shift();
    if (result.has(holderId)) continue;
    result.add(holderId);
    for (const [instanceId, instance] of Object.entries(holdings.instances ?? {})) {
      if (instance.holder === holderId && holdings.holders[`container:${instanceId}`]) {
        queue.push(`container:${instanceId}`);
      }
    }
  }
  return result;
}

export function itemQuantity(holdings, itemId, {
  access = "carried",
  nearbyHolderIds = [],
  holderId = null,
} = {}) {
  if (holdings?.items && !holdings.holders) {
    return Number(holdings.items[itemId]?.quantity ?? 0);
  }
  const holders = holderId
    ? new Set([holderId])
    : accessibleHolderIds(holdings, access, nearbyHolderIds);
  return [
    ...Object.values(holdings.stacks ?? {})
      .filter((entry) => entry.item === itemId && holders.has(entry.holder))
      .map((entry) => Number(entry.quantity) || 0),
    ...Object.values(holdings.instances ?? {})
      .filter((entry) => entry.item === itemId && holders.has(entry.holder))
      .map(() => 1),
  ].reduce((sum, value) => sum + value, 0);
}

export function totalItemQuantity(holdings, itemId) {
  return itemQuantity(holdings, itemId, { access: "anywhere" });
}

export function holdingRecords(holdings, definitions, holderIds = null) {
  const allowed = holderIds ? new Set(holderIds) : null;
  return [
    ...Object.entries(holdings.stacks ?? {})
      .filter(([, record]) => !allowed || allowed.has(record.holder))
      .map(([id, record]) => ({
        type: "stack",
        id,
        ...record,
        definition: itemDefinition(definitions, record.item),
      })),
    ...Object.entries(holdings.instances ?? {})
      .filter(([, record]) => !allowed || allowed.has(record.holder))
      .map(([id, record]) => ({
        type: "instance",
        id,
        quantity: 1,
        ...record,
        definition: itemDefinition(definitions, record.item),
      })),
  ];
}

function assertHolderAccepts(holdings, definitions, holderId, item, quantity) {
  const holder = requireHolder(holdings, holderId);
  if (!item) throw new Error("Item definition is required.");
  if (holder.kind === "container" && item.container && holder.nesting !== true) {
    throw new Error("Nested containers are not allowed.");
  }
  const kinds = holder.accepts?.kinds ?? [];
  if (kinds.length && !kinds.includes(item.kind)) {
    throw new Error(`${holder.label ?? holderId} does not accept ${item.kind}.`);
  }
  const records = holdingRecords(holdings, definitions, [holderId]);
  const slotsUsed = records.length;
  const addsSlot = item.carrying === "stack" &&
    records.some((record) => record.type === "stack" && record.item === item.id)
    ? 0
    : quantity;
  if (
    Number.isFinite(Number(holder.capacity?.slots)) &&
    slotsUsed + addsSlot > Number(holder.capacity.slots)
  ) {
    throw new Error(`${holder.label ?? holderId} has no free slots.`);
  }
  if (Number.isFinite(Number(holder.capacity?.massKg))) {
    const used = records.reduce(
      (sum, record) => sum + Number(record.definition?.massKg ?? 0) * record.quantity,
      0,
    );
    const added = Number(item.massKg ?? 0) * quantity;
    if (used + added > Number(holder.capacity.massKg)) {
      throw new Error(`${holder.label ?? holderId} exceeds its mass capacity.`);
    }
  }
}

function assertNoHolderCycle(holdings, instanceId, toHolder) {
  const ownHolder = `container:${instanceId}`;
  if (toHolder === ownHolder) throw new Error("A container cannot contain itself.");
  const descendants = accessibleHolderIdsFrom(holdings, ownHolder);
  if (descendants.has(toHolder)) throw new Error("Container holder cycles are not allowed.");
}

function accessibleHolderIdsFrom(holdings, root) {
  const result = new Set();
  const queue = holdings.holders[root] ? [root] : [];
  while (queue.length) {
    const holderId = queue.shift();
    if (result.has(holderId)) continue;
    result.add(holderId);
    for (const [instanceId, instance] of Object.entries(holdings.instances ?? {})) {
      if (instance.holder === holderId && holdings.holders[`container:${instanceId}`]) {
        queue.push(`container:${instanceId}`);
      }
    }
  }
  return result;
}

function deleteInstance(holdings, instanceId) {
  const containerId = `container:${instanceId}`;
  if (holdingRecords(holdings, {}, [containerId]).length) {
    throw new Error("Cannot remove a non-empty container.");
  }
  delete holdings.holders[containerId];
  delete holdings.instances[instanceId];
}

function ensureContainerHolders(holdings, definitions) {
  for (const [id, instance] of Object.entries(holdings.instances)) {
    const definition = itemDefinition(definitions, instance.item);
    if (!definition?.container) continue;
    holdings.holders[`container:${id}`] ??= {
      id: `container:${id}`,
      kind: "container",
      label: definition.label ?? definition.id,
      instance: id,
      capacity: clonePlain(definition.container.capacity ?? {}),
      accepts: clonePlain(definition.container.accepts ?? {}),
      nesting: definition.container.nesting === true,
    };
  }
}

function itemDefinition(definitions, id) {
  return (definitions.items ?? []).find((item) => item.id === id);
}

function requireHolder(holdings, id) {
  const holder = holdings.holders?.[id];
  if (!holder) throw new Error(`Unknown holder "${id}".`);
  return holder;
}

function nextRecordId(holdings, prefix) {
  let id;
  do {
    id = `${prefix}-${holdings.nextId}`;
    holdings.nextId += 1;
  } while (holdings.stacks[id] || holdings.instances[id]);
  return id;
}

/**
 * Create a partial-use instance (remaining 0..1) even for stack-defined items.
 * Used when the player nibbles part of one meal from a stack.
 */
export function createPartialItemInstance(holdings, itemId, {
  holderId = characterHolderId(holdings),
  remaining = 1,
} = {}) {
  requireHolder(holdings, holderId);
  const amount = Number(remaining);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1) {
    throw new Error("Partial remaining must be between 0 and 1.");
  }
  const id = nextRecordId(holdings, itemId);
  holdings.instances[id] = {
    item: itemId,
    holder: holderId,
    remaining: Number(amount.toFixed(4)),
  };
  return id;
}

function positiveQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Item quantity must be a positive number.");
  }
  return quantity;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clonePlain(value)
    : {};
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
