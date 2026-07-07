import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";
import { itemQuantity } from "./holdings.js";

export function availableItemActions(character, itemId) {
  const item = (character.definitions?.items ?? []).find((entry) => entry.id === itemId);
  if (!item || itemQuantity(character.holdings, itemId) <= 0) return [];
  return item.actions ?? [];
}

export function performItemAction(gameState, itemId, actionId, {
  holderId = null,
} = {}) {
  const action = availableItemActions(gameState.character, itemId)
    .find((entry) => entry.id === actionId);
  if (!action) return { ok: false, error: "Item action is not available." };
  if (action.timeMinutes > 0 && !ACTIVITY_PROFILES.includes(action.activity ?? "light")) {
    return { ok: false, error: "Item action has an invalid activity profile." };
  }
  const sourceHolderId = holderId && itemQuantity(gameState.character.holdings, itemId, { holderId }) > 0
    ? holderId
    : null;
  const effects = [
    ...(action.consume > 0
      ? [{
          op: "item.remove",
          id: itemId,
          quantity: action.consume,
          ...(sourceHolderId ? { holder: sourceHolderId } : {}),
        }]
      : []),
    ...(action.effects ?? []).map((effect) => sourceAwareEffect(effect, sourceHolderId)),
  ];
  const result = applyEffectsAtomically(effects, {
    character: gameState.character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;
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

function sourceAwareEffect(effect, sourceHolderId) {
  if (!sourceHolderId || effect?.holder !== "$source") return effect;
  return {
    ...effect,
    holder: sourceHolderId,
  };
}
