import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";
import { addItem, itemQuantity, removeItem } from "./holdings.js";

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
  const portion = resolveConsumptionPortion(gameState.character, itemId, action, {
    holderId,
    recordId,
    optionId,
  });
  if (!portion.ok) return portion;
  const sourceHolderId = holderId && itemQuantity(gameState.character.holdings, itemId, { holderId }) > 0
    ? holderId
    : null;
  const effects = [
    ...(action.consume > 0 && !portion.instance
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
    view: action.view && typeof action.view === "object" ? { ...action.view } : null,
  };
}

function resolveConsumptionPortion(character, itemId, action, {
  holderId = null,
  recordId = null,
  optionId = null,
} = {}) {
  const options = action.consumeOptions ?? [];
  if (!options.length) return { ok: true, scale: 1, instance: null };
  const instance = resolveSourceInstance(character.holdings, itemId, { holderId, recordId });
  if (!instance) return { ok: false, error: "Item instance is not available." };
  const remaining = clampFraction(instance.record.remaining ?? 1);
  if (remaining <= 0) return { ok: false, error: "Nothing remains to consume." };
  const option = options.find((entry) => entry.id === optionId) ??
    options.find((entry) => entry.remaining) ??
    options.at(-1);
  if (!option) return { ok: false, error: "Consumption option is not available." };
  const requested = option.remaining ? remaining : clampFraction(option.portion);
  const spent = Math.min(remaining, requested);
  if (!(spent > 0)) return { ok: false, error: "Consumption amount must be positive." };
  return {
    ok: true,
    scale: spent,
    instance,
    remaining,
    nextRemaining: Math.max(0, remaining - spent),
  };
}

function resolveSourceInstance(holdings, itemId, { holderId = null, recordId = null } = {}) {
  if (recordId && holdings.instances?.[recordId]?.item === itemId) {
    const record = holdings.instances[recordId];
    if (!holderId || record.holder === holderId) return { id: recordId, record };
  }
  return Object.entries(holdings.instances ?? {})
    .filter(([, record]) => record.item === itemId)
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
  if (!portion.instance) return { ok: true };
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
