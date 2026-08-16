/**
 * Kitchen procedure skills: purify water, then eat-and-drink.
 *
 * First visit uses the fixture/item steps. Completing those awards skills.
 * Later shortcuts skip the busywork.
 */

import { applyEffectsAtomically } from "./effects.js";
import { characterHasSkill } from "./requirements.js";
import {
  accessibleHolderIds,
  characterHolderId,
  itemQuantity,
} from "./holdings.js";
import { listConsumeCandidates, performQuickConsume } from "./quickConsume.js";
import { isVesselDefinition, vesselIsEmpty } from "./vessels.js";
import {
  drinkFromKitchenPurifier,
  fixtureRuntime,
  listProcessFixtures,
  performPurifyWaterShortcut,
} from "../maps/composables/indoor/roomFixtures.js";

export const WATER_PURIFICATION_SKILL = "water-purification";
export const EAT_AND_DRINK_SKILL = "eat-and-drink";
export const TASTEE_TACK_THIRST_KNOWLEDGE = "tastee-tack-thirst";

/** Combined meal+drink target: upper end of satisfied. */
export const SATISFIED_THRESHOLD = 80;

export const PURIFY_WATER_ACTION_ID = "kitchen:purify-water";
export const EAT_AND_DRINK_ACTION_ID = "kitchen:eat-and-drink";

export function characterKnowsWaterPurification(character) {
  return characterHasSkill(character, WATER_PURIFICATION_SKILL);
}

export function characterKnowsEatAndDrink(character) {
  return characterHasSkill(character, EAT_AND_DRINK_SKILL);
}

export function awardWaterPurification(character, flags) {
  if (!hasSkillDefinition(character, WATER_PURIFICATION_SKILL)) return { ok: true, awarded: false };
  if (characterKnowsWaterPurification(character)) return { ok: true, awarded: false };
  const result = applyEffectsAtomically(
    [{ op: "skill.acquire", id: WATER_PURIFICATION_SKILL }],
    { character, flags },
  );
  if (!result.ok) return result;
  return { ok: true, awarded: true };
}

export function buildKitchenSkillActions(indoor) {
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  if (roomId !== "kitchen") return [];
  const character = indoor.character;
  const actions = [];

  if (characterKnowsEatAndDrink(character)) {
    actions.push({
      id: EAT_AND_DRINK_ACTION_ID,
      label: "Eat and drink",
      kind: "action",
      hint: "Eat Tastee Tack with water until you are satisfied.",
    });
  }

  return actions;
}

export function performKitchenSkillAction(indoor, actionId, gameState = null) {
  if (actionId === EAT_AND_DRINK_ACTION_ID) {
    return performEatAndDrinkShortcut(indoor, gameState);
  }
  if (actionId === PURIFY_WATER_ACTION_ID) {
    return performPurifyWaterShortcut(indoor, gameState);
  }
  return { ok: false, error: "Unknown kitchen skill action." };
}

export function performEatAndDrinkShortcut(indoor, gameState = null, selection = null) {
  const state = resolveGameState(indoor, gameState);
  const character = state.character ?? indoor.character;
  if (!character) return { ok: false, error: "Character is unavailable." };
  if (!characterKnowsEatAndDrink(character)) {
    return { ok: false, error: "You have not learned that combination yet." };
  }

  const startSat = meterValue(character, "satiety");
  const startHyd = meterValue(character, "hydration");
  if (startSat > SATISFIED_THRESHOLD && startHyd > SATISFIED_THRESHOLD) {
    return { ok: true, notice: "You're already satisfied." };
  }

  const needFood = startSat <= SATISFIED_THRESHOLD;
  const needDrink = startHyd <= SATISFIED_THRESHOLD;
  const options = listEatAndDrinkOptions(indoor, state);
  if (needFood && !options.food.length) {
    return { ok: false, error: "No food in reach." };
  }
  if (needDrink && !options.drink.length) {
    return { ok: false, error: "No drink in reach." };
  }

  if (!selection) {
    if (needsEatAndDrinkPicker(options, needFood, needDrink)) {
      return {
        ok: true,
        eatAndDrinkPicker: {
          food: options.food,
          drink: options.drink,
          needFood,
          needDrink,
        },
      };
    }
    selection = {
      foodId: needFood ? options.food[0]?.id ?? null : null,
      drinkId: needDrink ? options.drink[0]?.id ?? null : null,
    };
  }

  return consumeEatAndDrink(indoor, state, selection);
}

export function listEatAndDrinkOptions(indoor, gameState = null) {
  const state = resolveGameState(indoor, gameState);
  const character = state.character ?? indoor.character;
  const nearbyHolderIds = kitchenRoomHolderIds(character, indoor);
  return {
    food: groupFoodOptions(listConsumeCandidates(state, "eat", { nearbyHolderIds })),
    drink: listDrinkOptions(indoor, state, nearbyHolderIds),
  };
}

function needsEatAndDrinkPicker(options, needFood, needDrink) {
  return (needFood && options.food.length > 1) || (needDrink && options.drink.length > 1);
}

function consumeEatAndDrink(indoor, state, selection) {
  const character = state.character ?? indoor.character;
  const nearbyHolderIds = kitchenRoomHolderIds(character, indoor);
  let ate = 0;
  let drank = 0;
  let purified = false;
  const foodLabel = selection.foodId
    ? listEatAndDrinkOptions(indoor, state).food.find((entry) => entry.id === selection.foodId)?.label
    : null;

  for (let step = 0; step < 12; step += 1) {
    const satiety = meterValue(character, "satiety");
    const hydration = meterValue(character, "hydration");
    if (satiety > SATISFIED_THRESHOLD && hydration > SATISFIED_THRESHOLD) break;

    if (satiety <= SATISFIED_THRESHOLD && selection.foodId) {
      const eaten = performQuickConsume(state, "eat", {
        nearbyHolderIds,
        matchItem: (candidate) => candidate.itemId === selection.foodId,
      });
      if (eaten.ok) {
        ate += 1;
        continue;
      }
      if (ate === 0 && hydration > SATISFIED_THRESHOLD) {
        return { ok: false, error: eaten.error || "No food in reach." };
      }
    }

    if (meterValue(character, "hydration") <= SATISFIED_THRESHOLD && selection.drinkId) {
      const drunk = consumeChosenDrink(indoor, state, nearbyHolderIds, selection.drinkId);
      if (drunk.purified) purified = true;
      if (drunk.ok) {
        drank += 1;
        continue;
      }
      if (ate === 0 && drank === 0) return drunk;
      break;
    }

    break;
  }

  markKitchenMealFlags(state.flags ?? indoor.indoor?.flags ?? indoor.flags);

  const satiety = meterValue(character, "satiety");
  const hydration = meterValue(character, "hydration");
  if (ate === 0 && drank === 0) {
    return { ok: false, error: "Nothing in reach to eat or drink." };
  }

  return {
    ok: true,
    notice: eatAndDrinkNotice({ ate, drank, purified, satiety, hydration, foodLabel }),
    characterChanged: true,
    ate,
    drank,
    purified,
  };
}

function consumeChosenDrink(indoor, state, nearbyHolderIds, drinkId) {
  if (drinkId === "purifier:refill") {
    const filled = performPurifyWaterShortcut(indoor, state);
    if (!filled.ok) {
      return { ok: false, error: filled.notice || filled.error || "Could not purify water." };
    }
    const poured = drinkFromKitchenPurifier(indoor, state);
    if (poured.ok) return { ok: true, purified: true };
    return { ok: false, error: poured.notice || poured.error || "No drink in reach.", purified: true };
  }

  if (drinkId === "purifier:pour" || drinkId === "purifier:drink") {
    const poured = drinkFromKitchenPurifier(indoor, state);
    if (poured.ok) return poured;
    return { ok: false, error: poured.notice || poured.error || "No drink in reach." };
  }

  if (String(drinkId).startsWith("vessel:")) {
    const itemId = drinkId.slice("vessel:".length);
    const drunk = performQuickConsume(state, "drink", {
      nearbyHolderIds,
      matchItem: (candidate) => candidate.itemId === itemId,
    });
    if (drunk.ok) return drunk;
    return { ok: false, error: drunk.error || "No drink in reach." };
  }

  return { ok: false, error: "Unknown drink." };
}

function groupFoodOptions(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidate.itemId;
    const existing = groups.get(key) ?? {
      id: key,
      itemId: key,
      label: candidate.label,
      quantity: 0,
      places: [],
    };
    existing.quantity += candidate.quantity;
    existing.places.push({
      label: candidate.placeLabel,
      quantity: candidate.quantity,
    });
    groups.set(key, existing);
  }
  return [...groups.values()].map((entry) => ({
    id: entry.id,
    itemId: entry.itemId,
    label: entry.label,
    detail: formatPlaceDetail(entry.places, entry.quantity),
    quantity: entry.quantity,
  }));
}

function listDrinkOptions(indoor, state, nearbyHolderIds) {
  const character = state.character ?? indoor.character;
  const options = [];
  const vessels = groupDrinkVessels(listConsumeCandidates(state, "drink", { nearbyHolderIds }));
  const glasses = vessels.filter((entry) => entry.itemId === "drinking-glass");
  const bottles = vessels.filter((entry) => entry.itemId === "water-bottle");
  const other = vessels.filter((entry) =>
    entry.itemId !== "drinking-glass" && entry.itemId !== "water-bottle");
  options.push(...glasses);

  const purifier = kitchenPurifierState(indoor);
  const emptyGlass = emptyVesselAvailable(character, nearbyHolderIds, "drinking-glass");
  if (purifier.ready && emptyGlass) {
    options.push({
      id: "purifier:pour",
      itemId: null,
      label: "Pour a glass from the purifier",
      detail: purifier.servingsLeft === 1
        ? "About one glass remains"
        : `About ${purifier.servingsLeft} glasses remain`,
    });
  }
  if (!purifier.ready && emptyGlass && canRefillPurifier(indoor, character)) {
    options.push({
      id: "purifier:refill",
      itemId: null,
      label: "Purify a fresh container of tap water",
      detail: "Then drink a glass",
    });
  }

  options.push(...bottles, ...other);
  return options;
}

function groupDrinkVessels(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = `vessel:${candidate.itemId}`;
    const existing = groups.get(key) ?? {
      id: key,
      itemId: candidate.itemId,
      label: drinkVesselLabel(candidate),
      quantity: 0,
      places: [],
    };
    existing.quantity += candidate.quantity;
    existing.places.push({
      label: candidate.placeLabel,
      quantity: candidate.quantity,
    });
    groups.set(key, existing);
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    detail: formatPlaceDetail(entry.places, entry.quantity),
  }));
}

function drinkVesselLabel(candidate) {
  if (candidate.itemId === "drinking-glass") {
    return candidate.label && !/^drinking glass$/i.test(candidate.label)
      ? `Glass of ${candidate.label}`
      : "Glass of water";
  }
  if (candidate.itemId === "water-bottle") {
    return candidate.label && !/^water bottle$/i.test(candidate.label)
      ? `Water bottle (${candidate.label})`
      : "Water bottle";
  }
  return candidate.label || candidate.itemId;
}

function kitchenPurifierState(indoor) {
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  const facility = indoor.indoor?.facility ?? indoor.facility;
  const fixture = listProcessFixtures(indoor.building).find(
    (entry) => entry.room === roomId && entry.kind === "water-purifier",
  );
  if (!fixture || !facility) return { ready: false, servingsLeft: 0 };
  const state = fixtureRuntime(facility, fixture.id, "water-purifier");
  const servingsLeft = Number(state?.servingsLeft) || 0;
  return {
    ready: state?.stage === "ready" && servingsLeft > 0,
    servingsLeft,
    tabletId: fixture.requiresTabletItem || "purifier-tablet",
  };
}

function canRefillPurifier(indoor, character) {
  if (!characterKnowsWaterPurification(character)) return false;
  const purifier = kitchenPurifierState(indoor);
  const tabletId = purifier.tabletId || "purifier-tablet";
  if (itemQuantity(character.holdings, tabletId, { access: "carried" }) > 0) return true;
  const nearby = kitchenRoomHolderIds(character, indoor);
  return itemQuantity(character.holdings, tabletId, {
    access: "nearby",
    nearbyHolderIds: nearby,
  }) > 0;
}

function emptyVesselAvailable(character, nearbyHolderIds, vesselItemId) {
  if (!character?.holdings) return false;
  const def = (character.definitions?.items ?? []).find((item) => item.id === vesselItemId);
  if (!isVesselDefinition(def)) return false;
  const holders = new Set([
    characterHolderId(character.holdings),
    ...accessibleHolderIds(character.holdings, "nearby", nearbyHolderIds),
  ]);
  return Object.values(character.holdings.instances ?? {}).some((record) =>
    record.item === vesselItemId && holders.has(record.holder) && vesselIsEmpty(record));
}

function formatPlaceDetail(places, quantity) {
  const merged = new Map();
  for (const place of places) {
    const key = place.label || "nearby";
    merged.set(key, (merged.get(key) ?? 0) + Number(place.quantity || 0));
  }
  const parts = [...merged.entries()].map(([label, count]) => {
    if (count > 1) return `${count} in ${label}`;
    return `in ${label}`;
  });
  if (quantity > 1 && parts.length === 1) return parts[0];
  return parts.join(", ");
}

function eatAndDrinkNotice({ ate, drank, purified, satiety, hydration, foodLabel }) {
  const satisfied = satiety > SATISFIED_THRESHOLD && hydration > SATISFIED_THRESHOLD;
  const meal = foodLabel || "what you chose";
  const waterNote = purified ? " You purify a fresh container of tap water first." : "";
  if (ate && drank && satisfied) {
    return `You eat ${meal} and wash it down with water until you feel satisfied.${waterNote}`;
  }
  if (ate && drank) {
    return `You eat ${meal} and drink what you can.${waterNote}`;
  }
  if (ate && satisfied) return `You eat ${meal} until you feel satisfied.`;
  if (drank && satisfied) return `You drink until you feel satisfied.${waterNote}`;
  if (ate) return `You eat some of ${meal}.`;
  if (drank) return `You drink what you can.${waterNote}`;
  return "You finish the meal.";
}

function resolveGameState(indoor, gameState) {
  return gameState ?? indoor.gameState ?? {
    character: indoor.character,
    flags: indoor.indoor?.flags ?? indoor.flags,
  };
}

function kitchenRoomHolderIds(character, indoor) {
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  if (!roomId || !character?.holdings?.holders) return [];
  return Object.values(character.holdings.holders)
    .filter((holder) => holder.kind === "fixed" || holder.kind === "world")
    .filter((holder) => holder.location?.room === roomId)
    .map((holder) => holder.id);
}

function meterValue(character, statId) {
  const definition = (character?.definitions?.stats ?? []).find((stat) => stat.id === statId);
  const fallback = Number.isFinite(Number(definition?.default)) ? Number(definition.default) : 0;
  const value = Number(character?.stats?.[statId]);
  return Number.isFinite(value) ? value : fallback;
}

function hasSkillDefinition(character, skillId) {
  return (character?.definitions?.skills ?? []).some((skill) => skill.id === skillId);
}

function markKitchenMealFlags(flags) {
  if (!flags || typeof flags.add !== "function") return;
  flags.add("day1.found-food");
  flags.add("day1.found-water");
  flags.add("kitchen.found-rations");
  flags.add("kitchen.purified-water");
}
