/**
 * Vessel + contents model.
 *
 * Vessels (glass, bottle, bowl, equipment hoppers) are reusable item instances
 * with a capacity in mL (or equivalent volume units for granular fills).
 * Contents are a catalog liquid/granular item id plus amountMl.
 *
 * Drink/eat of the contents uses the *content item's* actions and effects.
 * The vessel instance is not consumed.
 */

function resolveItemDefinition(definitions, itemId) {
  if (!itemId) return null;
  if (Array.isArray(definitions?.items)) {
    return definitions.items.find((entry) => entry.id === itemId) ?? null;
  }
  if (definitions?.items && typeof definitions.items === "object") {
    return definitions.items[itemId] ?? null;
  }
  if (definitions && typeof definitions === "object" && definitions.id === itemId) {
    return definitions;
  }
  return null;
}

export function isVesselDefinition(definition) {
  return Boolean(definition?.vessel && Number(definition.vessel.capacityMl) > 0);
}

export function isFillableForm(definition) {
  const form = definition?.properties?.form ?? definition?.form;
  return form === "liquid" || form === "granular";
}

export function vesselCapacityMl(definition) {
  const n = Number(definition?.vessel?.capacityMl);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Normalize instance contents; returns null when empty. */
export function normalizeContents(contents) {
  if (!contents || typeof contents !== "object") return null;
  const item = String(contents.item ?? "").trim();
  const amountMl = Number(contents.amountMl);
  if (!item || !(amountMl > 0)) return null;
  return { item, amountMl };
}

export function vesselIsEmpty(instance) {
  return !normalizeContents(instance?.contents);
}

export function vesselFillFraction(instance, vesselDefinition) {
  const contents = normalizeContents(instance?.contents);
  const capacity = vesselCapacityMl(vesselDefinition);
  if (!contents || !capacity) return 0;
  return Math.min(1, contents.amountMl / capacity);
}

export function vesselDisplayLabel(instance, vesselDefinition, contentDefinition) {
  const base = vesselDefinition?.label || instance?.item || "vessel";
  const contents = normalizeContents(instance?.contents);
  if (!contents) return base;
  const contentLabel = contentDefinition?.label || contents.item;
  const fraction = vesselFillFraction(instance, vesselDefinition);
  if (fraction >= 0.99) return `${base} of ${contentLabel}`;
  if (fraction <= 0.01) return base;
  const pct = Math.round(fraction * 100);
  return `${base} (${pct}% ${contentLabel})`;
}

/**
 * Fill a vessel instance from a source liquid/granular.
 * Replaces any previous contents (simple pour-out model for Part I).
 */
export function fillVesselInstance(instance, vesselDefinition, {
  liquidId,
  amountMl,
  liquidDefinition = null,
} = {}) {
  if (!instance) return { ok: false, error: "Vessel instance is required." };
  if (!isVesselDefinition(vesselDefinition)) {
    return { ok: false, error: "Item is not a vessel." };
  }
  const capacity = vesselCapacityMl(vesselDefinition);
  const amount = Number(amountMl);
  if (!(amount > 0)) return { ok: false, error: "Fill amount must be positive." };
  if (liquidDefinition && !isFillableForm(liquidDefinition) && liquidDefinition.kind !== "consumable") {
    // Allow consumable liquids without explicit form during migration.
  }
  const forms = vesselDefinition.vessel.forms ?? ["liquid", "granular"];
  const form = liquidDefinition?.properties?.form
    ?? liquidDefinition?.form
    ?? "liquid";
  if (forms.length && !forms.includes(form) && liquidDefinition?.properties?.form) {
    return { ok: false, error: `This vessel does not accept ${form} contents.` };
  }
  const fill = Math.min(capacity, amount);
  instance.contents = {
    item: String(liquidId),
    amountMl: Number(fill.toFixed(2)),
  };
  // Legacy partial-use field must not fight vessel contents.
  delete instance.remaining;
  return { ok: true, filledMl: fill, contents: { ...instance.contents } };
}

export function clearVesselContents(instance) {
  if (!instance) return;
  delete instance.contents;
  delete instance.remaining;
}

/**
 * Resolve a held empty vessel: prefer instances with no contents; otherwise
 * convert one stack unit of an empty vessel item into a unique instance.
 */
export function takeEmptyVesselInstance(holdings, definitions, vesselItemId, {
  holderId,
} = {}) {
  const definition = resolveItemDefinition(definitions, vesselItemId);
  if (!isVesselDefinition(definition)) {
    return { ok: false, error: `"${vesselItemId}" is not a vessel.` };
  }

  const emptyInstance = Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === vesselItemId)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .find(([, record]) => vesselIsEmpty(record));
  if (emptyInstance) {
    return {
      ok: true,
      instanceId: emptyInstance[0],
      instance: emptyInstance[1],
      created: false,
    };
  }

  // Stack of empty vessels (no per-unit contents).
  const stackEntry = Object.entries(holdings.stacks ?? {})
    .filter(([, stack]) => stack.item === vesselItemId && Number(stack.quantity) > 0)
    .filter(([, stack]) => !holderId || stack.holder === holderId)
    .at(0);
  if (!stackEntry) {
    return { ok: false, error: `No empty ${definition.label ?? vesselItemId} available.` };
  }
  const [stackId, stack] = stackEntry;
  stack.quantity -= 1;
  if (stack.quantity <= 0) delete holdings.stacks[stackId];

  const instanceId = nextInstanceId(holdings, vesselItemId);
  holdings.instances[instanceId] = {
    item: vesselItemId,
    holder: holderId ?? stack.holder,
  };
  return {
    ok: true,
    instanceId,
    instance: holdings.instances[instanceId],
    created: true,
  };
}

/**
 * Find any held vessel instance of this type that has room or is empty.
 * Used for "fill the bottle" when the bottle is already held (may be empty).
 */
export function findHeldVesselInstance(holdings, vesselItemId, { holderId = null, preferEmpty = true } = {}) {
  const entries = Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === vesselItemId)
    .filter(([, record]) => !holderId || record.holder === holderId);
  if (preferEmpty) {
    const empty = entries.find(([, record]) => vesselIsEmpty(record));
    if (empty) return { instanceId: empty[0], instance: empty[1] };
  }
  if (entries[0]) return { instanceId: entries[0][0], instance: entries[0][1] };
  return null;
}

/**
 * Drink/consume a portion of vessel contents using the content item's action.
 * Returns { ok, scale, spentMl, emptied, contentsItemId, action, notice? }
 * Caller applies effects and wellbeing gates.
 */
export function planVesselContentConsumption(instance, vesselDefinition, contentDefinition, action, {
  optionId = null,
} = {}) {
  const contents = normalizeContents(instance?.contents);
  if (!contents) return { ok: false, error: "The vessel is empty." };
  if (!contentDefinition) return { ok: false, error: "Unknown contents." };
  if (!action) return { ok: false, error: "No consume action for the contents." };

  const capacity = vesselCapacityMl(vesselDefinition);
  const remainingFraction = capacity > 0
    ? Math.min(1, contents.amountMl / capacity)
    : 1;
  if (!(remainingFraction > 0)) return { ok: false, error: "The vessel is empty." };

  const options = action.consumeOptions ?? [];
  let scale = 1;
  if (options.length) {
    const option = options.find((entry) => entry.id === optionId)
      ?? options.find((entry) => entry.remaining)
      ?? options.at(-1);
    if (!option) return { ok: false, error: "Consumption option is not available." };
    const requested = option.remaining
      ? remainingFraction
      : Math.min(remainingFraction, clamp01(option.portion));
    scale = requested;
  } else if (Number(action.consume) > 0) {
    // Whole-unit consume of contents relative to capacity.
    scale = remainingFraction;
  }

  if (!(scale > 0)) return { ok: false, error: "Nothing to consume." };
  const spentMl = Number((scale * capacity).toFixed(2));
  const nextMl = Math.max(0, Number((contents.amountMl - spentMl).toFixed(2)));
  return {
    ok: true,
    scale,
    spentMl,
    nextMl,
    emptied: nextMl <= 0.001,
    contentsItemId: contents.item,
    action,
  };
}

export function applyVesselContentConsumption(instance, plan) {
  if (!plan?.ok) return plan;
  if (plan.emptied) {
    clearVesselContents(instance);
  } else {
    instance.contents = {
      item: plan.contentsItemId,
      amountMl: plan.nextMl,
    };
  }
  return { ok: true };
}

function nextInstanceId(holdings, prefix) {
  let id;
  do {
    id = `${prefix}-${holdings.nextId ?? 1}`;
    holdings.nextId = (holdings.nextId ?? 1) + 1;
  } while (holdings.instances[id] || holdings.stacks[id] || holdings.holders[id]);
  return id;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

/** Default unit for scaling liquid drink effects when not using vessel capacity. */
export function contentUnitMl(contentDefinition) {
  const n = Number(
    contentDefinition?.properties?.unitMl
      ?? contentDefinition?.properties?.hydrationMl
      ?? contentDefinition?.vessel?.capacityMl,
  );
  return Number.isFinite(n) && n > 0 ? n : 250;
}
