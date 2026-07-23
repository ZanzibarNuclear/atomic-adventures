import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";
import {
  addItem,
  characterHolderId,
  createPartialItemInstance,
  itemQuantity,
  removeItem,
} from "./holdings.js";

export function availableItemActions(character, itemId) {
  const item = (character.definitions?.items ?? []).find((entry) => entry.id === itemId);
  if (!item || itemQuantity(character.holdings, itemId) <= 0) return [];
  return item.actions ?? [];
}

export function performItemAction(gameState, itemId, actionId, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const action = availableItemActions(gameState.character, itemId)
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
 * Block further food/drink when already at the top wellbeing band (e.g. Stuffed)
 * or at the meter max.
 */
export function consumptionWellbeingGate(character, action, portionScale = 1) {
  const effects = (action.effects ?? [])
    .map((effect) => scaledEffect(effect, portionScale))
    .filter((effect) => effect?.op === "stat.add" && Number(effect.value) > 0);

  for (const effect of effects) {
    const definition = (character.definitions?.stats ?? [])
      .find((stat) => stat.id === effect.id);
    if (!definition || definition.type !== "meter") continue;

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
