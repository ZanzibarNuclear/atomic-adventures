/**
 * Room process fixtures (sink, water purifier) — stand-scoped kitchen loop.
 * Distinct from map geometry fixtures (stairs) and poweredObjects (outlets).
 */

import { applyEffectsAtomically } from "../../../character/effects.js";
import { advanceGameTime } from "../../../character/gameTime.js";
import {
  characterHolderId,
  itemQuantity,
  removeItem,
} from "../../../character/holdings.js";
import {
  fillVesselInstance,
  findHeldVesselInstance,
  isVesselDefinition,
  takeEmptyVesselInstance,
  vesselIsEmpty,
} from "../../../character/vessels.js";
import { setFlags } from "../useFlags.js";

export const PROCESS_FIXTURE_KINDS = new Set(["sink", "water-purifier"]);

const DEFAULT_SINK = { flow: "off", cleared: false };
const DEFAULT_PURIFIER = {
  hasTablet: false,
  filled: false,
  stage: "idle", // idle | ready
  servingsLeft: 0,
};

const DEFAULT_OUTPUT_LIQUID = "purified-water";
const DEFAULT_OUTPUT_ML = 250;
/** Glasses of treated water from one fill + tablet charge. */
const DEFAULT_CAPACITY_SERVINGS = 4;

/** Collect process fixtures authored on rooms. */
export function listProcessFixtures(building) {
  const out = [];
  for (const room of building?.rooms ?? []) {
    for (const fixture of room.fixtures ?? []) {
      if (!fixture?.id || !PROCESS_FIXTURE_KINDS.has(fixture.kind)) continue;
      out.push({
        ...fixture,
        room: room.id,
        stand: fixture.stand ?? null,
        label: fixture.label || fixture.id,
        requiresTabletItem: fixture.requiresTabletItem || "purifier-tablet",
        outputLiquid: fixture.outputLiquid || DEFAULT_OUTPUT_LIQUID,
        outputMl: Number(fixture.outputMl) > 0 ? Number(fixture.outputMl) : DEFAULT_OUTPUT_ML,
        capacityServings: Number(fixture.capacityServings) > 0
          ? Number(fixture.capacityServings)
          : DEFAULT_CAPACITY_SERVINGS,
      });
    }
  }
  return out;
}

function defaultStateForKind(kind) {
  if (kind === "sink") return { ...DEFAULT_SINK };
  if (kind === "water-purifier") return { ...DEFAULT_PURIFIER };
  return null;
}

/**
 * Read fixture runtime without mutating reactive facility state.
 * Safe to call from computed/status builders.
 */
export function fixtureRuntime(facility, fixtureId, kind = null) {
  const existing = facility?.fixtures?.[fixtureId];
  if (existing) return existing;
  return kind ? defaultStateForKind(kind) : null;
}

/**
 * Ensure mutable facility state exists for process fixtures.
 * Only writes when a fixture entry is missing — never from render loops.
 */
export function ensureFixtureRuntime(facility, building) {
  if (!facility || typeof facility !== "object") return null;
  if (!facility.fixtures || typeof facility.fixtures !== "object") {
    facility.fixtures = {};
  }
  for (const fixture of listProcessFixtures(building)) {
    if (facility.fixtures[fixture.id]) continue;
    const defaults = defaultStateForKind(fixture.kind);
    if (defaults) facility.fixtures[fixture.id] = defaults;
  }
  return facility.fixtures;
}

/** Mutable state for an action handler (creates entry once if needed). */
function mutableFixtureState(facility, fixture) {
  if (!facility.fixtures || typeof facility.fixtures !== "object") {
    facility.fixtures = {};
  }
  if (!facility.fixtures[fixture.id]) {
    facility.fixtures[fixture.id] = defaultStateForKind(fixture.kind) ?? {};
    return facility.fixtures[fixture.id];
  }
  // Fill missing keys in place; do not replace the object (avoids reactive churn).
  const state = facility.fixtures[fixture.id];
  const defaults = defaultStateForKind(fixture.kind);
  if (defaults) {
    for (const [key, value] of Object.entries(defaults)) {
      if (state[key] === undefined) state[key] = value;
    }
  }
  return state;
}

function fixturesAtStand(building, roomId, standId) {
  return listProcessFixtures(building).filter((fixture) => {
    if (fixture.room !== roomId) return false;
    if (!fixture.stand) return true;
    return fixture.stand === standId;
  });
}

function heldQuantity(character, itemId) {
  if (!character?.holdings) return 0;
  return itemQuantity(character.holdings, itemId, {
    holderId: characterHolderId(character.holdings),
  });
}

function heldEmptyVesselCount(character, vesselItemId) {
  if (!character?.holdings) return 0;
  const holderId = characterHolderId(character.holdings);
  const def = (character.definitions?.items ?? []).find((item) => item.id === vesselItemId);
  if (!isVesselDefinition(def)) return heldQuantity(character, vesselItemId);

  let count = 0;
  for (const record of Object.values(character.holdings.instances ?? {})) {
    if (record.item === vesselItemId && record.holder === holderId && vesselIsEmpty(record)) {
      count += 1;
    }
  }
  for (const stack of Object.values(character.holdings.stacks ?? {})) {
    if (stack.item === vesselItemId && stack.holder === holderId) {
      count += Number(stack.quantity) || 0;
    }
  }
  return count;
}

function sinkInRoom(building, roomId) {
  return listProcessFixtures(building).find(
    (fixture) => fixture.room === roomId && fixture.kind === "sink",
  ) ?? null;
}

/**
 * Build play-panel actions for process fixtures at the player's stand.
 */
export function buildProcessFixtureActions(indoor) {
  const building = indoor.building;
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  const standId = indoor.indoor?.currentStand ?? null;
  if (!building || !roomId) return [];

  const facility = indoor.indoor?.facility ?? indoor.facility;
  if (!facility) return [];
  const character = indoor.character;
  const actions = [];

  for (const fixture of fixturesAtStand(building, roomId, standId)) {
    if (fixture.kind === "sink") {
      const state = fixtureRuntime(facility, fixture.id, "sink");
      if (state.flow === "off") {
        actions.push({
          id: `fixture:${fixture.id}:flow-on`,
          label: state.cleared ? "Turn on the faucet" : "Run the faucet",
          kind: "fixture",
        });
      } else {
        actions.push({
          id: `fixture:${fixture.id}:flow-off`,
          label: "Turn off the faucet",
          kind: "fixture",
        });
      }
      continue;
    }

    if (fixture.kind === "water-purifier") {
      const state = fixtureRuntime(facility, fixture.id, "water-purifier");
      const sink = sinkInRoom(building, roomId);
      const sinkState = sink
        ? fixtureRuntime(facility, sink.id, "sink")
        : null;
      const tabletId = fixture.requiresTabletItem;

      if (!state.filled) {
        const canFill = sinkState?.flow !== "off" && sinkState?.cleared;
        actions.push({
          id: `fixture:${fixture.id}:fill`,
          label: "Fill the purifier from the tap",
          kind: "fixture",
          disabled: !canFill,
          hint: canFill ? "" : "Run the faucet clear first.",
        });
      }
      if (!state.hasTablet && heldQuantity(character, tabletId) > 0) {
        actions.push({
          id: `fixture:${fixture.id}:add-tablet`,
          label: "Add a purification tablet",
          kind: "fixture",
        });
      }
      if (state.stage === "ready" && Number(state.servingsLeft) > 0) {
        const emptyGlassHeld = heldEmptyVesselCount(character, "drinking-glass") > 0;
        const emptyGlassNearby = nearbyEmptyVesselCount(character, indoor, "drinking-glass") > 0;
        if (emptyGlassHeld || emptyGlassNearby) {
          actions.push({
            id: `fixture:${fixture.id}:fill-glass`,
            label: "Fill a glass from the purifier",
            kind: "fixture",
          });
          actions.push({
            id: `fixture:${fixture.id}:pour-and-drink`,
            label: "Pour a glass and drink",
            kind: "fixture",
          });
        }
        if (heldEmptyVesselCount(character, "water-bottle") > 0) {
          actions.push({
            id: `fixture:${fixture.id}:fill-bottle`,
            label: "Fill the water bottle from the purifier",
            kind: "fixture",
          });
        }
        if (
          !emptyGlassHeld
          && !emptyGlassNearby
          && heldEmptyVesselCount(character, "water-bottle") <= 0
        ) {
          actions.push({
            id: `fixture:${fixture.id}:drink`,
            label: "Drink from the purifier",
            kind: "fixture",
          });
        }
      }
      // Drink a glass already filled and held — stays on the sink scene.
      if (heldFilledVesselCount(character, "drinking-glass", fixture.outputLiquid) > 0) {
        actions.push({
          id: `fixture:${fixture.id}:drink-glass`,
          label: "Drink from the glass",
          kind: "fixture",
        });
      }
    }
  }

  return actions;
}

export function processFixtureStatusLines(indoor) {
  const building = indoor.building;
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  const standId = indoor.indoor?.currentStand ?? null;
  if (!building || !roomId) return [];
  const facility = indoor.indoor?.facility ?? indoor.facility;
  if (!facility) return [];
  const lines = [];

  for (const fixture of fixturesAtStand(building, roomId, standId)) {
    // Sink open/close copy is action-notice only so first-clear vs later clear
    // water never stack with a status line that says the same thing.
    if (fixture.kind !== "water-purifier") continue;
    const state = fixtureRuntime(facility, fixture.id, fixture.kind);
    if (state.stage === "ready" && Number(state.servingsLeft) > 0) {
      const n = Number(state.servingsLeft);
      lines.push(
        n === 1
          ? "The purifier holds about one glass of treated water."
          : `The purifier holds about ${n} glasses of treated water.`,
      );
    } else if (state.filled && state.hasTablet) {
      lines.push("The purifier is treating the water.");
    } else if (state.filled) {
      lines.push("The purifier reservoir is full of untreated water.");
    } else if (state.hasTablet) {
      lines.push("A purification tablet sits in the empty purifier.");
    }
  }
  return lines;
}

/**
 * @returns {{ ok: boolean, notice?: string, error?: string }}
 */
export function performProcessFixtureAction(indoor, actionId, gameState = null) {
  if (!actionId?.startsWith("fixture:")) {
    return { ok: false, error: "Not a fixture action." };
  }
  const parts = actionId.split(":");
  if (parts.length < 3) return { ok: false, error: "Unknown fixture action." };
  const fixtureId = parts[1];
  const verb = parts.slice(2).join(":");

  const building = indoor.building;
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  const standId = indoor.indoor?.currentStand ?? null;
  const facility = indoor.indoor?.facility ?? indoor.facility;
  const character = indoor.character ?? gameState?.character ?? null;
  const flags = indoor.indoor?.flags ?? indoor.flags ?? gameState?.flags;
  if (!facility) return { ok: false, error: "Facility state is unavailable." };

  const fixture = listProcessFixtures(building).find((entry) => entry.id === fixtureId);
  if (!fixture) return { ok: false, error: "Unknown fixture." };
  if (fixture.room !== roomId) return { ok: false, error: "Fixture is not in this room." };
  if (fixture.stand && fixture.stand !== standId) {
    return { ok: false, error: "Move closer to use that fixture." };
  }

  const state = mutableFixtureState(facility, fixture);

  if (fixture.kind === "sink") {
    if (verb === "flow-on") {
      const firstClear = !state.cleared;
      state.flow = "low";
      state.cleared = true;
      if (gameState && firstClear) {
        advanceGameTime(gameState, 2, "light");
      }
      // One notice only: first open clears the line; later opens report clear water.
      return {
        ok: true,
        notice: firstClear
          ? "The faucet sputters rust and silt for a while, then runs clear."
          : "Clear water runs from the faucet.",
      };
    }
    if (verb === "flow-off") {
      state.flow = "off";
      return { ok: true, notice: "You turn off the faucet." };
    }
    return { ok: false, error: "Unknown sink action." };
  }

  if (fixture.kind === "water-purifier") {
    if (verb === "fill") {
      const sink = sinkInRoom(building, roomId);
      const sinkState = sink
        ? (facility.fixtures?.[sink.id] ?? fixtureRuntime(facility, sink.id, "sink"))
        : null;
      if (!sinkState || sinkState.flow === "off") {
        return { ok: false, notice: "Turn on the faucet first." };
      }
      if (!sinkState.cleared) {
        return { ok: false, notice: "Let the faucet run clear before filling the purifier." };
      }
      state.filled = true;
      refreshPurifierStage(state, fixture);
      return {
        ok: true,
        notice: state.stage === "ready"
          ? `You fill the purifier. With the tablet already in, about ${state.servingsLeft} glasses are ready.`
          : "You fill the purifier reservoir from the clear tap.",
      };
    }

    if (verb === "add-tablet") {
      const tabletId = fixture.requiresTabletItem;
      if (!character?.holdings) {
        return { ok: false, error: "Character holdings are unavailable." };
      }
      if (state.hasTablet || (state.stage === "ready" && Number(state.servingsLeft) > 0)) {
        return { ok: false, notice: "There is already a tablet in the purifier." };
      }
      // Prefer held tablet; otherwise take one from the sink counter.
      const took = takeTabletForPurifier(character, indoor, tabletId);
      if (!took.ok) return took;
      state.hasTablet = true;
      refreshPurifierStage(state, fixture);
      return {
        ok: true,
        notice: state.stage === "ready"
          ? `You drop in a tablet. About ${state.servingsLeft} glasses of treated water are ready.`
          : "You drop a purification tablet into the purifier.",
        characterChanged: true,
      };
    }

    if (verb === "fill-glass") {
      return pourIntoVessel(character, state, fixture, indoor, {
        vesselItemId: "drinking-glass",
        notice: "You fill a glass with purified water.",
        flags,
        gameState,
        allowNearby: true,
      });
    }

    if (verb === "fill-bottle") {
      return pourIntoVessel(character, state, fixture, indoor, {
        vesselItemId: "water-bottle",
        notice: "You fill the bottle with purified water.",
        flags,
        gameState,
        allowNearby: false,
      });
    }

    if (verb === "pour-and-drink") {
      const poured = pourIntoVessel(character, state, fixture, indoor, {
        vesselItemId: "drinking-glass",
        notice: "You fill a glass with purified water.",
        flags,
        gameState,
        allowNearby: true,
      });
      if (!poured.ok) return poured;
      const drank = drinkHeldGlass(character, fixture, flags, gameState);
      if (!drank.ok) {
        return {
          ok: true,
          notice: `${poured.notice} ${drank.notice || drank.error || "Hold the glass to drink."}`,
          characterChanged: true,
        };
      }
      return {
        ok: true,
        notice: "You pour a glass of purified water and drink it down.",
        characterChanged: true,
      };
    }

    if (verb === "drink-glass") {
      return drinkHeldGlass(character, fixture, flags, gameState);
    }

    if (verb === "drink") {
      if (state.stage !== "ready" || Number(state.servingsLeft) <= 0) {
        return { ok: false, notice: "There is no treated water ready to drink." };
      }
      consumePurifierServing(state);
      if (character) applyHydrationGain(character, flags, 35);
      markDay1Water(flags);
      if (gameState) advanceGameTime(gameState, 3, "resting");
      return {
        ok: true,
        notice: Number(state.servingsLeft) > 0
          ? `You drink a long pull of purified water. About ${state.servingsLeft} glasses remain in the purifier.`
          : "You drink a long pull of purified water. The purifier is empty.",
        characterChanged: true,
      };
    }
  }

  return { ok: false, error: "Unknown fixture action." };
}

function refreshPurifierStage(state, fixture = null) {
  if (state.filled && state.hasTablet) {
    state.stage = "ready";
    if (!(Number(state.servingsLeft) > 0)) {
      const capacity = Number(fixture?.capacityServings) > 0
        ? Number(fixture.capacityServings)
        : DEFAULT_CAPACITY_SERVINGS;
      state.servingsLeft = capacity;
    }
    return;
  }
  if (!(Number(state.servingsLeft) > 0)) {
    state.stage = "idle";
  }
}

function consumePurifierServing(state) {
  const left = Math.max(0, Number(state.servingsLeft) || 0);
  state.servingsLeft = Math.max(0, left - 1);
  if (state.servingsLeft <= 0) {
    state.filled = false;
    state.hasTablet = false;
    state.stage = "idle";
    state.servingsLeft = 0;
  } else {
    state.stage = "ready";
    state.filled = true;
  }
}

function nearbyFixedHolderIdsForStand(indoor) {
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  const standId = indoor.indoor?.currentStand ?? null;
  if (!roomId || !indoor.character?.holdings?.holders) return [];
  return Object.values(indoor.character.holdings.holders)
    .filter((holder) => holder.kind === "fixed" || holder.kind === "world")
    .filter((holder) => {
      const location = holder.location ?? {};
      if (location.room !== roomId) return false;
      return !location.stand || location.stand === standId;
    })
    .map((holder) => holder.id);
}

function nearbyEmptyVesselCount(character, indoor, vesselItemId) {
  if (!character?.holdings) return 0;
  const holders = new Set(nearbyFixedHolderIdsForStand(indoor));
  let count = 0;
  for (const record of Object.values(character.holdings.instances ?? {})) {
    if (record.item !== vesselItemId || !holders.has(record.holder)) continue;
    if (vesselIsEmpty(record)) count += 1;
  }
  return count;
}

function heldFilledVesselCount(character, vesselItemId, liquidId) {
  if (!character?.holdings) return 0;
  const holderId = characterHolderId(character.holdings);
  let count = 0;
  for (const record of Object.values(character.holdings.instances ?? {})) {
    if (record.item !== vesselItemId || record.holder !== holderId) continue;
    const contents = record.contents;
    if (!contents?.item) continue;
    if (liquidId && contents.item !== liquidId) continue;
    if (Number(contents.amountMl) > 0) count += 1;
  }
  return count;
}

function takeTabletForPurifier(character, indoor, tabletId) {
  if (heldQuantity(character, tabletId) > 0) {
    try {
      removeItem(character.holdings, character.definitions, tabletId, 1, {
        holderId: characterHolderId(character.holdings),
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  // From sink counter (or other nearby fixed holders).
  for (const holderId of nearbyFixedHolderIdsForStand(indoor)) {
    if (itemQuantity(character.holdings, tabletId, { holderId }) <= 0) continue;
    try {
      removeItem(character.holdings, character.definitions, tabletId, 1, { holderId });
      return { ok: true };
    } catch {
      /* try next holder */
    }
  }
  return { ok: false, notice: "You need a purification tablet." };
}

function claimEmptyVessel(character, indoor, vesselItemId, { allowNearby = false } = {}) {
  const holderId = characterHolderId(character.holdings);
  let target = findHeldVesselInstance(character.holdings, vesselItemId, {
    holderId,
    preferEmpty: true,
  });
  if (target && vesselIsEmpty(target.instance)) {
    return { ok: true, ...target };
  }
  if (allowNearby) {
    for (const nearbyHolderId of nearbyFixedHolderIdsForStand(indoor)) {
      const entry = Object.entries(character.holdings.instances ?? {})
        .find(([, record]) =>
          record.item === vesselItemId
          && record.holder === nearbyHolderId
          && vesselIsEmpty(record));
      if (!entry) continue;
      // Move onto the character so fill/drink stay on the same vessel.
      entry[1].holder = holderId;
      return { ok: true, instanceId: entry[0], instance: entry[1] };
    }
  }
  const taken = takeEmptyVesselInstance(
    character.holdings,
    character.definitions,
    vesselItemId,
    { holderId },
  );
  if (!taken.ok) {
    return {
      ok: false,
      notice: vesselItemId === "drinking-glass"
        ? "You need an empty drinking glass."
        : "You need an empty water bottle.",
    };
  }
  return { ok: true, instanceId: taken.instanceId, instance: taken.instance };
}

function pourIntoVessel(character, state, fixture, indoor, {
  vesselItemId,
  notice,
  flags,
  gameState,
  allowNearby = false,
}) {
  if (state.stage !== "ready" || Number(state.servingsLeft) <= 0) {
    return { ok: false, notice: "The purifier has no treated water ready." };
  }
  if (!character?.holdings) {
    return { ok: false, error: "Character holdings are unavailable." };
  }
  const vesselDef = (character.definitions?.items ?? []).find((item) => item.id === vesselItemId);
  if (!isVesselDefinition(vesselDef)) {
    return { ok: false, error: `"${vesselItemId}" is not configured as a vessel.` };
  }

  const claimed = claimEmptyVessel(character, indoor, vesselItemId, { allowNearby });
  if (!claimed.ok) return claimed;

  const liquidId = fixture.outputLiquid || DEFAULT_OUTPUT_LIQUID;
  const liquidDef = (character.definitions?.items ?? []).find((item) => item.id === liquidId);
  const amountMl = Math.min(
    Number(vesselDef.vessel.capacityMl),
    Number(fixture.outputMl) > 0 ? Number(fixture.outputMl) : DEFAULT_OUTPUT_ML,
  );
  const filled = fillVesselInstance(claimed.instance, vesselDef, {
    liquidId,
    amountMl,
    liquidDefinition: liquidDef,
  });
  if (!filled.ok) return filled;

  consumePurifierServing(state);
  markDay1Water(flags);
  if (gameState) advanceGameTime(gameState, 2, "light");
  const remain = Number(state.servingsLeft) || 0;
  const remainNote = remain > 0
    ? ` About ${remain} glass${remain === 1 ? "" : "es"} remain in the purifier.`
    : " The purifier is empty.";
  return { ok: true, notice: `${notice}${remainNote}`, characterChanged: true };
}

function drinkHeldGlass(character, fixture, flags, gameState) {
  if (!character?.holdings) {
    return { ok: false, error: "Character holdings are unavailable." };
  }
  const holderId = characterHolderId(character.holdings);
  const liquidId = fixture.outputLiquid || DEFAULT_OUTPUT_LIQUID;
  const entry = Object.entries(character.holdings.instances ?? {})
    .find(([, record]) =>
      record.item === "drinking-glass"
      && record.holder === holderId
      && record.contents?.item === liquidId
      && Number(record.contents?.amountMl) > 0);
  if (!entry) {
    return { ok: false, notice: "You need a glass of purified water in hand." };
  }
  const instance = entry[1];
  applyHydrationGain(character, flags, 20);
  instance.contents = null;
  delete instance.contents;
  markDay1Water(flags);
  if (gameState) advanceGameTime(gameState, 3, "resting");
  return {
    ok: true,
    notice: "You drink the glass of purified water.",
    characterChanged: true,
  };
}

function applyHydrationGain(character, flags, value) {
  ensureCharacterEffectFields(character);
  const result = applyEffectsAtomically(
    [{ op: "stat.add", id: "hydration", value }],
    { character, flags },
  );
  if (result.ok) return;
  character.stats ??= {};
  character.stats.hydration = (Number(character.stats.hydration) || 0) + value;
}

function ensureCharacterEffectFields(character) {
  if (!character) return;
  character.stats ??= {};
  character.knowledge ??= {};
  character.skills ??= {};
  character.quests ??= {};
  character.documents ??= {};
}

function markDay1Water(flags) {
  if (!flags) return;
  if (typeof flags.has === "function" && flags.has("day1.found-water")) return;
  setFlags(flags, ["day1.found-water"]);
}
