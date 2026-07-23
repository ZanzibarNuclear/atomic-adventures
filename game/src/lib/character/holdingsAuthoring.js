/**
 * Authoring helpers for starting character holdings (instances, stacks, fixed holders).
 * Used by Content Builder to stock containers without hand-editing JSON.
 */

export function ensureHoldings(draft, profileId = "player") {
  if (!draft || typeof draft !== "object") {
    throw new Error("Character draft is required.");
  }
  const characterId = `character:${draft.profile?.id || profileId}`;
  draft.holdings ??= {
    holders: {},
    stacks: {},
    instances: {},
    nextId: 1,
  };
  const holdings = draft.holdings;
  holdings.holders ??= {};
  holdings.stacks ??= {};
  holdings.instances ??= {};
  holdings.nextId = Math.max(1, Number(holdings.nextId) || 1);
  if (!holdings.holders[characterId]) {
    holdings.holders[characterId] = {
      id: characterId,
      kind: "character",
      label: "Holding",
    };
  }
  return holdings;
}

export function characterHolderIdFrom(holdings) {
  return Object.keys(holdings.holders ?? {}).find((id) => id.startsWith("character:"))
    ?? "character:player";
}

export function listItemInstances(holdings, itemId) {
  return Object.entries(holdings?.instances ?? {})
    .filter(([, instance]) => instance.item === itemId)
    .map(([id, instance]) => ({ id, ...instance }));
}

export function listHolderContents(holdings, holderId, itemsById = {}) {
  const stacks = Object.entries(holdings?.stacks ?? {})
    .filter(([, stack]) => stack.holder === holderId)
    .map(([id, stack]) => ({
      type: "stack",
      id,
      item: stack.item,
      quantity: Number(stack.quantity) || 0,
      label: itemsById[stack.item]?.label ?? stack.item,
    }));
  const instances = Object.entries(holdings?.instances ?? {})
    .filter(([, instance]) => instance.holder === holderId)
    .map(([id, instance]) => ({
      type: "instance",
      id,
      item: instance.item,
      quantity: 1,
      label: itemsById[instance.item]?.label ?? instance.item,
    }));
  return [...stacks, ...instances];
}

export function listPlacementHolders(holdings) {
  return Object.values(holdings?.holders ?? {})
    .filter((holder) => holder.kind === "character" || holder.kind === "fixed" || holder.kind === "vehicle")
    .map((holder) => ({
      id: holder.id,
      kind: holder.kind,
      label: holder.label || holder.id,
      location: holder.location ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function containerHolderId(instanceId) {
  return `container:${instanceId}`;
}

export function ensureContainerHolder(holdings, instanceId, itemDefinition) {
  const holderId = containerHolderId(instanceId);
  const capacity = itemDefinition?.container?.capacity ?? {};
  const accepts = itemDefinition?.container?.accepts ?? {};
  holdings.holders[holderId] = {
    id: holderId,
    kind: "container",
    label: itemDefinition?.label ?? itemDefinition?.id ?? instanceId,
    instance: instanceId,
    capacity: clonePlain(capacity),
    accepts: clonePlain(accepts),
    nesting: itemDefinition?.container?.nesting === true,
  };
  return holderId;
}

export function nextHoldingsId(holdings, prefix) {
  let id;
  do {
    id = `${prefix}-${holdings.nextId}`;
    holdings.nextId += 1;
  } while (holdings.stacks[id] || holdings.instances[id] || holdings.holders[id]);
  return id;
}

/**
 * Create a starting instance of a (usually container) item in a placement holder.
 */
export function addStartingInstance(holdings, itemDefinition, {
  holderId = characterHolderIdFrom(holdings),
} = {}) {
  if (!itemDefinition?.id) throw new Error("Item definition is required.");
  if (!holdings.holders[holderId]) throw new Error(`Unknown holder "${holderId}".`);
  const instanceId = nextHoldingsId(holdings, itemDefinition.id);
  holdings.instances[instanceId] = {
    item: itemDefinition.id,
    holder: holderId,
  };
  if (itemDefinition.container) {
    ensureContainerHolder(holdings, instanceId, itemDefinition);
  }
  return instanceId;
}

export function removeStartingInstance(holdings, instanceId) {
  const containerId = containerHolderId(instanceId);
  const contents = listHolderContents(holdings, containerId);
  if (contents.length) {
    throw new Error("Empty the container before removing this instance.");
  }
  delete holdings.holders[containerId];
  delete holdings.instances[instanceId];
}

/**
 * Add quantity of an item into a holder (stack merge or unique instances).
 */
export function stockIntoHolder(holdings, itemDefinition, {
  holderId,
  quantity = 1,
} = {}) {
  if (!itemDefinition?.id) throw new Error("Item definition is required.");
  if (!holdings.holders[holderId]) throw new Error(`Unknown holder "${holderId}".`);
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  const itemId = itemDefinition.id;

  if (itemDefinition.carrying === "stack") {
    const existingEntry = Object.entries(holdings.stacks)
      .find(([, stack]) => stack.item === itemId && stack.holder === holderId);
    if (existingEntry) {
      const [id, existing] = existingEntry;
      existing.quantity = Number(existing.quantity) + amount;
      return { type: "stack", id };
    }
    const id = nextHoldingsId(holdings, `stack-${itemId}`);
    holdings.stacks[id] = { item: itemId, quantity: amount, holder: holderId };
    return { type: "stack", id };
  }

  const created = [];
  for (let i = 0; i < amount; i += 1) {
    const id = nextHoldingsId(holdings, itemId);
    holdings.instances[id] = { item: itemId, holder: holderId };
    if (itemDefinition.container) {
      ensureContainerHolder(holdings, id, itemDefinition);
    }
    created.push(id);
  }
  return { type: "instance", ids: created };
}

export function removeStockRecord(holdings, type, id) {
  if (type === "stack") {
    delete holdings.stacks[id];
    return;
  }
  if (type === "instance") {
    removeStartingInstance(holdings, id);
  }
}

export function setStackQuantity(holdings, stackId, quantity) {
  const stack = holdings.stacks?.[stackId];
  if (!stack) throw new Error(`Unknown stack "${stackId}".`);
  const next = Math.floor(Number(quantity));
  if (!Number.isFinite(next) || next <= 0) {
    delete holdings.stacks[stackId];
    return;
  }
  stack.quantity = next;
}

export function createFixedHolder(holdings, {
  id,
  label,
  room = null,
  stand = null,
  exteriorNode = null,
  slots = 8,
  acceptsKinds = [],
} = {}) {
  const holderId = String(id || "").trim();
  if (!holderId) throw new Error("Fixed holder id is required.");
  const normalizedId = holderId.startsWith("fixed:") ? holderId : `fixed:${holderId}`;
  if (holdings.holders[normalizedId]) {
    throw new Error(`Holder "${normalizedId}" already exists.`);
  }
  holdings.holders[normalizedId] = {
    id: normalizedId,
    kind: "fixed",
    label: label || normalizedId.replace(/^fixed:/, ""),
    location: {
      ...(room ? { room } : {}),
      ...(stand ? { stand } : {}),
      ...(exteriorNode ? { exteriorNode } : {}),
    },
    capacity: {
      ...(Number.isFinite(Number(slots)) && Number(slots) > 0 ? { slots: Number(slots) } : {}),
    },
    accepts: {
      kinds: Array.isArray(acceptsKinds) ? [...acceptsKinds] : [],
    },
  };
  return normalizedId;
}

/**
 * Ensure a fixed world holder for a room/stand pair (ids from building geometry).
 * Reuses an existing holder at the same location when present.
 */
export function ensureFixedHolderAt(holdings, {
  room,
  stand = null,
  roomLabel = null,
  standLabel = null,
  acceptsKinds = ["container", "consumable", "tool", "key", "part", "card", "book"],
  slots = 12,
} = {}) {
  const roomId = String(room || "").trim();
  if (!roomId) throw new Error("Room is required.");
  const standId = stand ? String(stand).trim() : null;

  const existing = Object.values(holdings.holders ?? {}).find((holder) => {
    if (holder.kind !== "fixed") return false;
    const location = holder.location ?? {};
    if (location.room !== roomId) return false;
    return standId ? location.stand === standId : !location.stand;
  });
  if (existing) return existing.id;

  const slug = standId ? `${roomId}-${standId}` : roomId;
  const label = standId
    ? (standLabel || standId)
    : (roomLabel || roomId);
  return createFixedHolder(holdings, {
    id: slug,
    label,
    room: roomId,
    stand: standId,
    slots,
    acceptsKinds,
  });
}

/**
 * Place one container instance at a room/stand and optionally stock contents.
 * One-shot authoring helper — hides fixed-holder bookkeeping from the UI.
 */
export function placeContainerAt(holdings, containerDefinition, {
  room,
  stand = null,
  roomLabel = null,
  standLabel = null,
  contentItem = null,
  contentQuantity = 0,
} = {}) {
  if (!containerDefinition?.container) {
    throw new Error("Item is not a container.");
  }
  const accepts = [
    "container",
    ...(containerDefinition.container.accepts?.kinds ?? []),
  ];
  const holderId = ensureFixedHolderAt(holdings, {
    room,
    stand,
    roomLabel,
    standLabel,
    acceptsKinds: [...new Set(accepts)],
    slots: Math.max(
      4,
      Number(containerDefinition.container.capacity?.slots) || 12,
    ),
  });
  const instanceId = addStartingInstance(holdings, containerDefinition, { holderId });
  if (contentItem && contentQuantity > 0) {
    stockIntoHolder(holdings, contentItem, {
      holderId: containerHolderId(instanceId),
      quantity: contentQuantity,
    });
  }
  return { holderId, instanceId };
}

export function moveInstanceToHolder(holdings, instanceId, holderId) {
  const instance = holdings.instances?.[instanceId];
  if (!instance) throw new Error(`Unknown instance "${instanceId}".`);
  if (!holdings.holders[holderId]) throw new Error(`Unknown holder "${holderId}".`);
  instance.holder = holderId;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
