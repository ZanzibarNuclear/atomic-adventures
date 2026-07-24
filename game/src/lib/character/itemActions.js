import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";
import {
  addItem,
  characterHolderId,
  createPartialItemInstance,
  itemQuantity,
  removeItem,
} from "./holdings.js";
import {
  applyVesselContentConsumption,
  isVesselDefinition,
  normalizeContents,
  planVesselContentConsumption,
  vesselIsEmpty,
} from "./vessels.js";

function itemDef(character, itemId) {
  return (character.definitions?.items ?? []).find((entry) => entry.id === itemId) ?? null;
}

export function availableItemActions(character, itemId, { recordId = null } = {}) {
  const item = itemDef(character, itemId);
  if (!item) return [];
  if (itemQuantity(character.holdings, itemId) <= 0) return [];

  // Vessel with contents: expose the content item's consume actions.
  if (isVesselDefinition(item) && recordId) {
    const instance = character.holdings.instances?.[recordId];
    if (instance?.item === itemId && !vesselIsEmpty(instance)) {
      const contents = normalizeContents(instance.contents);
      const liquid = itemDef(character, contents.item);
      return (liquid?.actions ?? []).filter((action) => isConsumptiveAction(action));
    }
    // Empty vessel: no drink/eat actions.
    if (instance?.item === itemId && vesselIsEmpty(instance)) return [];
  }

  // Vessel without recordId: if any held instance has contents, still list actions
  // (inventory UI always passes recordId for instances).
  if (isVesselDefinition(item) && !recordId) {
    const filled = Object.entries(character.holdings.instances ?? {})
      .find(([, record]) => record.item === itemId && !vesselIsEmpty(record));
    if (filled) {
      const contents = normalizeContents(filled[1].contents);
      const liquid = itemDef(character, contents.item);
      return (liquid?.actions ?? []).filter((action) => isConsumptiveAction(action));
    }
    return [];
  }

  return item.actions ?? [];
}

export function performItemAction(gameState, itemId, actionId, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const vesselDef = itemDef(gameState.character, itemId);
  if (isVesselDefinition(vesselDef)) {
    return performVesselContentAction(gameState, itemId, actionId, {
      holderId,
      recordId,
      optionId,
    });
  }

  const action = availableItemActions(gameState.character, itemId, { recordId })
    .find((entry) => entry.id === actionId);
  if (!action) return { ok: false, error: "Item action is not available." };
  if (action.timeMinutes > 0 && !ACTIVITY_PROFILES.includes(action.activity ?? "light")) {
    return { ok: false, error: "Item action has an invalid activity profile." };
  }
  const consumptionSource = consumableActionSource(gameState.character, itemId, action, holderId);
  if (!consumptionSource.ok) return consumptionSource;
  const portion = resolveConsumptionPortion(gameState.character, itemId, action, {
    holderId: consumptionSource.holderId ?? holderId,
    recordId,
    optionId,
  });
  if (!portion.ok) return portion;

  const wellbeingGate = consumptionWellbeingGate(gameState.character, action, portion.scale);
  if (!wellbeingGate.ok) return wellbeingGate;

  const sourceHolderId = consumptionSource.holderId ??
    (holderId && itemQuantity(gameState.character.holdings, itemId, { holderId }) > 0
      ? holderId
      : null);
  const effects = [
    ...(action.consume > 0 && !portion.instance && !portion.stackUnit
      ? [{
          op: "item.remove",
          id: itemId,
          quantity: action.consume,
          ...(sourceHolderId ? { holder: sourceHolderId } : {}),
        }]
      : []),
    ...(action.effects ?? [])
      .map((effect) => scaledEffect(effect, portion.scale))
      .map((effect) => sourceAwareEffect(effect, sourceHolderId)),
  ];
  const result = applyEffectsAtomically(effects, {
    character: gameState.character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;
  const depletion = applyInstanceConsumption(gameState.character, itemId, action, portion, sourceHolderId);
  if (!depletion.ok) return depletion;
  if (action.timeMinutes > 0) {
    const timeResult = advanceGameTime(
      gameState,
      action.timeMinutes,
      action.activity ?? "light",
    );
    if (!timeResult.ok) return timeResult;
  }
  return {
    ok: true,
    notice: wellbeingGate.notice ?? null,
    view: action.view && typeof action.view === "object" ? { ...action.view } : null,
  };
}

function performVesselContentAction(gameState, vesselItemId, actionId, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const character = gameState.character;
  const vesselDef = itemDef(character, vesselItemId);
  const heldHolderId = characterHolderId(character.holdings);
  if (holderId && holderId !== heldHolderId) {
    return { ok: false, error: "Hold the vessel before using its contents." };
  }

  let instanceId = recordId;
  let instance = instanceId ? character.holdings.instances?.[instanceId] : null;
  if (!instance || instance.item !== vesselItemId) {
    const found = Object.entries(character.holdings.instances ?? {})
      .filter(([, record]) => record.item === vesselItemId)
      .filter(([, record]) => record.holder === heldHolderId)
      .find(([, record]) => !vesselIsEmpty(record));
    if (!found) return { ok: false, error: "No filled vessel is available." };
    instanceId = found[0];
    instance = found[1];
  }
  if (vesselIsEmpty(instance)) {
    return { ok: false, error: "The vessel is empty." };
  }

  const contents = normalizeContents(instance.contents);
  const contentDef = itemDef(character, contents.item);
  const action = (contentDef?.actions ?? []).find((entry) => entry.id === actionId);
  if (!action || !isConsumptiveAction(action)) {
    return { ok: false, error: "That action is not available for the contents." };
  }
  if (action.timeMinutes > 0 && !ACTIVITY_PROFILES.includes(action.activity ?? "light")) {
    return { ok: false, error: "Item action has an invalid activity profile." };
  }

  const plan = planVesselContentConsumption(instance, vesselDef, contentDef, action, { optionId });
  if (!plan.ok) return plan;

  const wellbeingGate = consumptionWellbeingGate(character, action, plan.scale);
  if (!wellbeingGate.ok) return wellbeingGate;

  const effects = (action.effects ?? [])
    .map((effect) => scaledEffect(effect, plan.scale))
    .map((effect) => sourceAwareEffect(effect, heldHolderId));
  const result = applyEffectsAtomically(effects, {
    character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;

  // applyEffects replaces holdings; re-resolve the live instance before mutating fill.
  const liveInstance = character.holdings.instances?.[instanceId];
  if (!liveInstance) {
    return { ok: false, error: "Vessel instance disappeared during consumption." };
  }
  applyVesselContentConsumption(liveInstance, plan);

  if (action.timeMinutes > 0) {
    const timeResult = advanceGameTime(
      gameState,
      action.timeMinutes * plan.scale,
      action.activity ?? "light",
    );
    if (!timeResult.ok) return timeResult;
  }

  const contentLabel = contentDef?.label ?? contents.item;
  const notice = plan.emptied
    ? `You finish the ${contentLabel}. The ${vesselDef.label ?? "vessel"} is empty.`
    : wellbeingGate.notice ?? null;

  return {
    ok: true,
    notice,
    view: action.view && typeof action.view === "object" ? { ...action.view } : null,
    vesselEmptied: plan.emptied,
  };
}

function consumableActionSource(character, itemId, action, holderId) {
  if (!isConsumptiveAction(action)) return { ok: true, holderId: null };
  const heldHolderId = characterHolderId(character.holdings);
  if (holderId && holderId !== heldHolderId) {
    return { ok: false, error: "Hold the item before consuming it." };
  }
  if (itemQuantity(character.holdings, itemId, { holderId: heldHolderId }) <= 0) {
    return { ok: false, error: "Hold the item before consuming it." };
  }
  return { ok: true, holderId: heldHolderId };
}

function isConsumptiveAction(action) {
  return Number(action.consume ?? 0) > 0 || (action.consumeOptions ?? []).length > 0;
}

/**
 * Block further food/drink when the *primary* recovery meter is already at the
 * top wellbeing band (e.g. Stuffed) or at the meter max.
 *
 * Meals often add a little hydration alongside satiety. Only the largest
 * positive meter effect gates the action — a full hydration bar must not
 * block eating food, and a stuffed satiety bar must not block pure drinks.
 */
export function consumptionWellbeingGate(character, action, portionScale = 1) {
  const effects = (action.effects ?? [])
    .map((effect) => scaledEffect(effect, portionScale))
    .filter((effect) => effect?.op === "stat.add" && Number(effect.value) > 0)
    .map((effect) => {
      const definition = (character.definitions?.stats ?? [])
        .find((stat) => stat.id === effect.id);
      return { effect, definition };
    })
    .filter(({ definition }) => definition?.type === "meter");

  if (!effects.length) return { ok: true };

  // Primary benefit = largest positive meter gain (satiety 55 beats hydration 4).
  const primary = effects.reduce((best, entry) =>
    Number(entry.effect.value) > Number(best.effect.value) ? entry : best
  );

  const { effect, definition } = primary;
  const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : 0;
  const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : 100;
  const current = Number(character.stats?.[effect.id] ?? definition.default ?? min);
  const band = topWellbeingBand(definition);

  if (band && current >= band.at) {
    return {
      ok: false,
      error: wellbeingRefusalMessage(definition, band.state, effect.id),
    };
  }
  if (current >= max) {
    return {
      ok: false,
      error: wellbeingRefusalMessage(definition, band?.state ?? "full", effect.id),
    };
  }
  return { ok: true };
}

function topWellbeingBand(definition) {
  const states = [...(definition.displayStates ?? [])]
    .filter((entry) => entry && entry.state != null && Number.isFinite(Number(entry.at)))
    .sort((a, b) => Number(b.at) - Number(a.at));
  if (!states.length) return null;
  // Prefer an explicit "Stuffed" (or similar) band when present.
  const stuffed = states.find((entry) => /stuffed|bloated|bursting/i.test(String(entry.state)));
  return stuffed ?? states[0];
}

function wellbeingRefusalMessage(definition, stateLabel, statId) {
  const label = String(stateLabel || "full");
  if (statId === "satiety" || /stuffed|full|hungry|satiety/i.test(definition.id + label)) {
    return `You're ${label.toLowerCase()}. Save the rest of that food for later.`;
  }
  if (statId === "hydration") {
    return `You're ${label.toLowerCase()}. No more water right now.`;
  }
  return `You're already ${label.toLowerCase()}.`;
}

function resolveConsumptionPortion(character, itemId, action, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const options = action.consumeOptions ?? [];
  if (!options.length) return { ok: true, scale: 1, instance: null, stackUnit: null };

  const instance = resolveSourceInstance(character.holdings, itemId, { holderId, recordId });
  if (instance) {
    const remaining = clampFraction(instance.record.remaining ?? 1);
    if (remaining <= 0) return { ok: false, error: "Nothing remains to consume." };
    const option = pickConsumeOption(options, optionId);
    if (!option) return { ok: false, error: "Consumption option is not available." };
    const requested = option.remaining ? remaining : clampFraction(option.portion);
    const spent = Math.min(remaining, requested);
    if (!(spent > 0)) return { ok: false, error: "Consumption amount must be positive." };
    return {
      ok: true,
      scale: spent,
      instance,
      stackUnit: null,
      remaining,
      nextRemaining: Math.max(0, remaining - spent),
    };
  }

  const stackUnit = resolveSourceStack(character.holdings, itemId, { holderId });
  if (!stackUnit) return { ok: false, error: "Item is not available." };
  const remaining = 1;
  const option = pickConsumeOption(options, optionId);
  if (!option) return { ok: false, error: "Consumption option is not available." };
  const requested = option.remaining ? remaining : clampFraction(option.portion);
  const spent = Math.min(remaining, requested);
  if (!(spent > 0)) return { ok: false, error: "Consumption amount must be positive." };
  return {
    ok: true,
    scale: spent,
    instance: null,
    stackUnit,
    remaining,
    nextRemaining: Math.max(0, remaining - spent),
  };
}

function pickConsumeOption(options, optionId) {
  return options.find((entry) => entry.id === optionId) ??
    options.find((entry) => entry.remaining) ??
    options.at(-1) ??
    null;
}

function resolveSourceInstance(holdings, itemId, { holderId = null, recordId = null } = {}) {
  if (recordId && holdings.instances?.[recordId]?.item === itemId) {
    const record = holdings.instances[recordId];
    if (!holderId || record.holder === holderId) return { id: recordId, record };
  }
  // Prefer partially eaten instances over whole stack units.
  const partial = Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === itemId)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .filter(([, record]) => Number(record.remaining ?? 1) < 1)
    .map(([id, record]) => ({ id, record }));
  if (partial.length) return partial[0];
  return Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === itemId)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .map(([id, record]) => ({ id, record }))
    .at(0) ?? null;
}

function resolveSourceStack(holdings, itemId, { holderId = null } = {}) {
  return Object.entries(holdings.stacks ?? {})
    .filter(([, record]) => record.item === itemId && Number(record.quantity) > 0)
    .filter(([, record]) => !holderId || record.holder === holderId)
    .map(([id, record]) => ({ id, record }))
    .at(0) ?? null;
}

function scaledEffect(effect, scale = 1) {
  if (effect?.scaleBy !== "portion") return effect;
  return {
    ...effect,
    value: Number(effect.value ?? 0) * scale,
  };
}

function applyInstanceConsumption(character, itemId, action, portion, sourceHolderId) {
  if (portion.instance) {
    const instance = character.holdings.instances?.[portion.instance.id];
    if (!instance) return { ok: false, error: "Consumed item instance is no longer available." };
    if (portion.nextRemaining > 0) {
      instance.remaining = Number(portion.nextRemaining.toFixed(4));
      return { ok: true };
    }
    try {
      removeItem(character.holdings, character.definitions, itemId, 1, {
        holderId: instance.holder,
      });
      if (action.depletedItem) {
        addItem(character.holdings, character.definitions, action.depletedItem, 1, {
          holderId: sourceHolderId ?? instance.holder,
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  if (portion.stackUnit) {
    try {
      removeItem(character.holdings, character.definitions, itemId, 1, {
        holderId: portion.stackUnit.record.holder,
      });
      if (portion.nextRemaining > 0) {
        createPartialItemInstance(character.holdings, itemId, {
          holderId: sourceHolderId ?? portion.stackUnit.record.holder,
          remaining: portion.nextRemaining,
        });
      } else if (action.depletedItem) {
        addItem(character.holdings, character.definitions, action.depletedItem, 1, {
          holderId: sourceHolderId ?? portion.stackUnit.record.holder,
        });
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

function sourceAwareEffect(effect, sourceHolderId) {
  if (!sourceHolderId || effect?.holder !== "$source") return effect;
  return {
    ...effect,
    holder: sourceHolderId,
  };
}

function clampFraction(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(1, Math.max(0, number));
}
