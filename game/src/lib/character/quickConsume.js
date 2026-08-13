import {
  isConsumeOptionOffered,
  performItemAction,
} from "./itemActions.js";
import {
  accessibleHolderIds,
  characterHolderId,
  holdingRecords,
  transferHolding,
} from "./holdings.js";
import {
  isVesselDefinition,
  normalizeContents,
  vesselIsEmpty,
} from "./vessels.js";

/**
 * Hurried Eat / Drink from the character health card.
 * Scans carried inventory first (hands, then packs/containers), then nearby
 * holders. Consumes the first matching food or drink found.
 */

/**
 * Whether the health-card Eat/Drink shortcut should be offered.
 * Hidden until the player has found kitchen supplies (or already carries food/drink),
 * so Day-1 discovery isn't spoiled by a generic button.
 */
export function isQuickConsumeReady(gameState, kind, { nearbyHolderIds = [] } = {}) {
  const mode = kind === "drink" ? "drink" : "eat";
  const character = gameState?.character;
  const flags = gameState?.flags;
  if (!character?.holdings) return false;

  if (mode === "eat") {
    if (flagHas(flags, "day1.found-food")) return true;
    return hasCarriedConsumableMatch(character, "eat");
  }
  if (flagHas(flags, "day1.found-water")) return true;
  return hasCarriedConsumableMatch(character, "drink");
}

function flagHas(flags, id) {
  if (!flags) return false;
  if (typeof flags.has === "function") return flags.has(id);
  if (Array.isArray(flags)) return flags.includes(id);
  return Boolean(flags[id]);
}

function hasCarriedConsumableMatch(character, mode) {
  const heldId = characterHolderId(character.holdings);
  const carried = [...accessibleHolderIds(character.holdings, "carried")];
  const ordered = [heldId, ...carried.filter((id) => id !== heldId)];
  for (const holderId of ordered) {
    const records = holdingRecords(character.holdings, character.definitions, [holderId]);
    for (const record of records) {
      if (matchConsumeCandidate(character, record, mode)) return true;
    }
  }
  return false;
}

export function performQuickConsume(gameState, kind, { nearbyHolderIds = [] } = {}) {
  const mode = kind === "drink" ? "drink" : "eat";
  const character = gameState?.character;
  if (!character?.holdings) {
    return { ok: false, error: nothingFoundMessage(mode) };
  }

  if (isPrimaryMeterMaxed(character, mode)) {
    return {
      ok: false,
      error: mode === "eat"
        ? "You're not hungry right now."
        : "You're not thirsty right now.",
    };
  }

  const heldId = characterHolderId(character.holdings);
  const carried = [...accessibleHolderIds(character.holdings, "carried")];
  const nearby = [...accessibleHolderIds(character.holdings, "nearby", nearbyHolderIds)]
    .filter((id) => !carried.includes(id));

  // Hands first, then other carried containers, then surroundings.
  const orderedHolders = [
    heldId,
    ...carried.filter((id) => id !== heldId),
    ...nearby,
  ];

  for (const holderId of orderedHolders) {
    const records = holdingRecords(character.holdings, character.definitions, [holderId]);
    for (const record of records) {
      const candidate = matchConsumeCandidate(character, record, mode);
      if (!candidate) continue;

      const sourceHolderId = record.holder;
      const sourceLabel = holderDisplayLabel(character.holdings, sourceHolderId);

      if (sourceHolderId !== heldId) {
        try {
          transferHolding(character.holdings, character.definitions, {
            type: record.type,
            id: record.id,
            quantity: 1,
            toHolder: heldId,
          });
        } catch (error) {
          // Try the next item if this one cannot be picked up.
          continue;
        }
      }

      const live = resolveHeldCandidate(character, candidate, heldId);
      if (!live) continue;

      const result = performItemAction(gameState, live.itemId, live.actionId, {
        holderId: heldId,
        recordId: live.recordId,
        optionId: live.optionId,
      });
      if (!result.ok) {
        // Soft wellbeing refusal is final; other failures try the next item.
        if (isSoftWellbeingRefusal(result.error)) return result;
        continue;
      }

      const itemLabel = live.label;
      const placePhrase = sourceHolderId === heldId
        ? "from what you're holding"
        : `from ${sourceLabel}`;
      const verb = mode === "eat" ? "eat" : "drink";
      const detail = result.notice ? ` ${result.notice}` : "";
      return {
        ok: true,
        notice: `You ${verb} the ${itemLabel} ${placePhrase}.${detail}`.replace(/\.\s*\./, "."),
        itemId: live.itemId,
        actionId: live.actionId,
        sourceHolderId,
      };
    }
  }

  return { ok: false, error: nothingFoundMessage(mode) };
}

function matchConsumeCandidate(character, record, mode) {
  const definition = record.definition
    ?? (character.definitions?.items ?? []).find((item) => item.id === record.item);
  if (!definition) return null;

  const recordId = record.type === "instance" ? record.id : null;
  const actions = actionsForRecord(character, definition, record);
  for (const action of actions) {
    if (!isConsumptiveLike(action)) continue;
    if (!actionMatchesMode(character, action, mode)) continue;
    const optionId = pickDefaultOptionId(action, record);
    const label = consumeDisplayLabel(character, definition, record);
    return {
      itemId: record.item,
      actionId: action.id,
      optionId,
      recordId,
      recordType: record.type,
      label,
    };
  }
  return null;
}

/**
 * Actions for a holding even if it is not currently carried.
 * Vessel instances expose content-item consume actions when filled.
 */
function actionsForRecord(character, definition, record) {
  if (isVesselDefinition(definition) && record.type === "instance") {
    const instance = character.holdings.instances?.[record.id];
    if (instance && !vesselIsEmpty(instance)) {
      const contents = normalizeContents(instance.contents);
      const liquid = (character.definitions?.items ?? [])
        .find((item) => item.id === contents?.item);
      return (liquid?.actions ?? []).filter((action) => isConsumptiveLike(action));
    }
    return [];
  }
  return definition.actions ?? [];
}

function actionMatchesMode(character, action, mode) {
  const id = String(action?.id ?? "").toLowerCase();
  const label = String(action?.label ?? "").toLowerCase();
  if (mode === "eat") {
    if (/^drink|sip|gulp|quaff/.test(id) || /\bdrink\b|\bsip\b/.test(label)) return false;
    if (/^eat|nibble|chew|feed/.test(id) || /\beat\b|\bnibble\b/.test(label)) return true;
    return primaryMeterForAction(character, action) === "satiety";
  }
  if (/^eat|nibble|chew|feed/.test(id) || /\beat\b|\bnibble\b/.test(label)) return false;
  if (/^drink|sip|gulp|quaff/.test(id) || /\bdrink\b|\bsip\b/.test(label)) return true;
  return primaryMeterForAction(character, action) === "hydration";
}

function isConsumptiveLike(action) {
  return Number(action?.consume ?? 0) > 0 || (action?.consumeOptions ?? []).length > 0;
}
function primaryMeterForAction(character, action) {
  const meters = (action.effects ?? [])
    .filter((effect) => effect?.op === "stat.add" && Number(effect.value) > 0)
    .map((effect) => {
      const definition = (character.definitions?.stats ?? [])
        .find((stat) => stat.id === effect.id);
      return definition?.type === "meter"
        ? { id: effect.id, value: Number(effect.value) }
        : null;
    })
    .filter(Boolean);
  if (!meters.length) return null;
  return meters.reduce((best, entry) => (entry.value > best.value ? entry : best)).id;
}

function pickDefaultOptionId(action, record) {
  const options = action.consumeOptions ?? [];
  if (!options.length) return null;
  const remaining = Number(record.remaining ?? 1);
  const offered = options.filter((option) => isConsumeOptionOffered(option, remaining));
  const pick = offered.find((option) => option.remaining)
    ?? offered[0]
    ?? options.find((option) => option.remaining)
    ?? options.at(-1);
  return pick?.id ?? null;
}

function resolveHeldCandidate(character, candidate, heldId) {
  if (candidate.recordType === "instance") {
    const instance = character.holdings.instances?.[candidate.recordId];
    if (!instance || instance.holder !== heldId) return null;
    return {
      ...candidate,
      recordId: candidate.recordId,
    };
  }
  // Stack: find a stack of this item on the character after transfer.
  const stack = Object.entries(character.holdings.stacks ?? {})
    .find(([, entry]) => entry.item === candidate.itemId && entry.holder === heldId
      && Number(entry.quantity) > 0);
  if (!stack) return null;
  return {
    ...candidate,
    recordId: null,
  };
}

function consumeDisplayLabel(character, definition, record) {
  if (isVesselDefinition(definition) && record.type === "instance") {
    const instance = character.holdings.instances?.[record.id];
    const contents = normalizeContents(instance?.contents);
    if (contents?.item) {
      const contentDef = (character.definitions?.items ?? [])
        .find((item) => item.id === contents.item);
      return contentDef?.label ?? contents.item;
    }
  }
  return definition?.label ?? record.item;
}

function holderDisplayLabel(holdings, holderId) {
  const holder = holdings.holders?.[holderId];
  if (!holder) return "nearby";
  if (holder.kind === "character") return "what you're holding";
  if (holder.kind === "world") return holder.label || "the ground";
  if (String(holderId).startsWith("container:")) {
    return holder.label || holder.shortLabel || "your pack";
  }
  return holder.label || holder.shortLabel || "nearby";
}

function isPrimaryMeterMaxed(character, mode) {
  const statId = mode === "eat" ? "satiety" : "hydration";
  const definition = (character.definitions?.stats ?? []).find((stat) => stat.id === statId);
  if (!definition) return false;
  const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : 100;
  const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : 0;
  const current = Number(character.stats?.[statId] ?? definition.default ?? min);
  return current >= max - 1e-9;
}

function isSoftWellbeingRefusal(error) {
  return /not hungry|not thirsty|well rested|calm enough|top off/i.test(String(error ?? ""));
}

function nothingFoundMessage(mode) {
  return mode === "eat"
    ? "No food in reach."
    : "No drink in reach.";
}
