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
};

const DEFAULT_OUTPUT_LIQUID = "purified-water";
const DEFAULT_OUTPUT_ML = 250;

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
      });
    }
  }
  return out;
}

export function ensureFixtureRuntime(facility, building) {
  if (!facility.fixtures || typeof facility.fixtures !== "object") {
    facility.fixtures = {};
  }
  for (const fixture of listProcessFixtures(building)) {
    if (fixture.kind === "sink") {
      facility.fixtures[fixture.id] = {
        ...DEFAULT_SINK,
        ...(facility.fixtures[fixture.id] ?? {}),
      };
    } else if (fixture.kind === "water-purifier") {
      facility.fixtures[fixture.id] = {
        ...DEFAULT_PURIFIER,
        ...(facility.fixtures[fixture.id] ?? {}),
      };
    }
  }
  return facility.fixtures;
}

export function fixtureRuntime(facility, fixtureId) {
  return facility?.fixtures?.[fixtureId] ?? null;
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
  ensureFixtureRuntime(facility, building);
  const character = indoor.character;
  const actions = [];

  for (const fixture of fixturesAtStand(building, roomId, standId)) {
    if (fixture.kind === "sink") {
      const state = fixtureRuntime(facility, fixture.id);
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
      const state = fixtureRuntime(facility, fixture.id);
      const sink = sinkInRoom(building, roomId);
      const sinkState = sink ? fixtureRuntime(facility, sink.id) : null;
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
      if (state.stage === "ready") {
        if (heldEmptyVesselCount(character, "drinking-glass") > 0) {
          actions.push({
            id: `fixture:${fixture.id}:fill-glass`,
            label: "Fill a glass from the purifier",
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
          heldEmptyVesselCount(character, "drinking-glass") <= 0 &&
          heldEmptyVesselCount(character, "water-bottle") <= 0
        ) {
          actions.push({
            id: `fixture:${fixture.id}:drink`,
            label: "Drink from the purifier",
            kind: "fixture",
          });
        }
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
  ensureFixtureRuntime(facility, building);
  const lines = [];

  for (const fixture of fixturesAtStand(building, roomId, standId)) {
    const state = fixtureRuntime(facility, fixture.id);
    if (fixture.kind === "sink") {
      if (state.flow !== "off") {
        lines.push(
          state.cleared
            ? "Clear water runs from the faucet."
            : "The faucet is running.",
        );
      }
    } else if (fixture.kind === "water-purifier") {
      if (state.stage === "ready") {
        lines.push("The purifier holds treated water, ready to pour.");
      } else if (state.filled && state.hasTablet) {
        lines.push("The purifier is treating the water.");
      } else if (state.filled) {
        lines.push("The purifier reservoir is full of untreated water.");
      } else if (state.hasTablet) {
        lines.push("A purification tablet sits in the empty purifier.");
      }
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
  ensureFixtureRuntime(facility, building);

  const fixture = listProcessFixtures(building).find((entry) => entry.id === fixtureId);
  if (!fixture) return { ok: false, error: "Unknown fixture." };
  if (fixture.room !== roomId) return { ok: false, error: "Fixture is not in this room." };
  if (fixture.stand && fixture.stand !== standId) {
    return { ok: false, error: "Move closer to use that fixture." };
  }

  const state = fixtureRuntime(facility, fixtureId);

  if (fixture.kind === "sink") {
    if (verb === "flow-on") {
      const firstClear = !state.cleared;
      state.flow = "low";
      state.cleared = true;
      if (gameState && firstClear) {
        advanceGameTime(gameState, 2, "light");
      }
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
      const sinkState = sink ? fixtureRuntime(facility, sink.id) : null;
      if (!sinkState || sinkState.flow === "off") {
        return { ok: false, notice: "Turn on the faucet first." };
      }
      if (!sinkState.cleared) {
        return { ok: false, notice: "Let the faucet run clear before filling the purifier." };
      }
      state.filled = true;
      refreshPurifierStage(state);
      return {
        ok: true,
        notice: state.stage === "ready"
          ? "You fill the purifier. With the tablet already in, the water is ready to drink."
          : "You fill the purifier reservoir from the clear tap.",
      };
    }

    if (verb === "add-tablet") {
      const tabletId = fixture.requiresTabletItem;
      if (!character?.holdings) {
        return { ok: false, error: "Character holdings are unavailable." };
      }
      if (state.hasTablet) {
        return { ok: false, notice: "There is already a tablet in the purifier." };
      }
      if (heldQuantity(character, tabletId) <= 0) {
        return { ok: false, notice: "You need a purification tablet." };
      }
      try {
        removeItem(character.holdings, character.definitions, tabletId, 1, {
          holderId: characterHolderId(character.holdings),
        });
      } catch (error) {
        return { ok: false, error: error.message };
      }
      state.hasTablet = true;
      refreshPurifierStage(state);
      return {
        ok: true,
        notice: state.stage === "ready"
          ? "You drop in a tablet. The treated water is ready."
          : "You drop a purification tablet into the purifier.",
        characterChanged: true,
      };
    }

    if (verb === "fill-glass") {
      return pourIntoHeldVessel(character, state, fixture, {
        vesselItemId: "drinking-glass",
        notice: "You fill a glass with purified water.",
        flags,
        gameState,
      });
    }

    if (verb === "fill-bottle") {
      return pourIntoHeldVessel(character, state, fixture, {
        vesselItemId: "water-bottle",
        notice: "You fill the bottle with purified water.",
        flags,
        gameState,
      });
    }

    if (verb === "drink") {
      if (state.stage !== "ready") {
        return { ok: false, notice: "There is no treated water ready to drink." };
      }
      consumePurifierDose(state);
      if (character) {
        applyEffectsAtomically(
          [{ op: "stat.add", id: "hydration", value: 35 }],
          { character, flags },
        );
      }
      markDay1Water(flags);
      if (gameState) advanceGameTime(gameState, 3, "resting");
      return {
        ok: true,
        notice: "You drink a long pull of purified water.",
        characterChanged: true,
      };
    }
  }

  return { ok: false, error: "Unknown fixture action." };
}

function refreshPurifierStage(state) {
  state.stage = state.filled && state.hasTablet ? "ready" : "idle";
}

function consumePurifierDose(state) {
  state.filled = false;
  state.hasTablet = false;
  state.stage = "idle";
}

function pourIntoHeldVessel(character, state, fixture, {
  vesselItemId,
  notice,
  flags,
  gameState,
}) {
  if (state.stage !== "ready") {
    return { ok: false, notice: "The purifier has no treated water ready." };
  }
  if (!character?.holdings) {
    return { ok: false, error: "Character holdings are unavailable." };
  }
  const holderId = characterHolderId(character.holdings);
  const vesselDef = (character.definitions?.items ?? []).find((item) => item.id === vesselItemId);
  if (!isVesselDefinition(vesselDef)) {
    return { ok: false, error: `"${vesselItemId}" is not configured as a vessel.` };
  }

  let target = findHeldVesselInstance(character.holdings, vesselItemId, {
    holderId,
    preferEmpty: true,
  });
  if (!target || !vesselIsEmpty(target.instance)) {
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
    target = { instanceId: taken.instanceId, instance: taken.instance };
  }

  const liquidId = fixture.outputLiquid || DEFAULT_OUTPUT_LIQUID;
  const liquidDef = (character.definitions?.items ?? []).find((item) => item.id === liquidId);
  const amountMl = Math.min(
    Number(vesselDef.vessel.capacityMl),
    Number(fixture.outputMl) > 0 ? Number(fixture.outputMl) : DEFAULT_OUTPUT_ML,
  );
  const filled = fillVesselInstance(target.instance, vesselDef, {
    liquidId,
    amountMl,
    liquidDefinition: liquidDef,
  });
  if (!filled.ok) return filled;

  consumePurifierDose(state);
  markDay1Water(flags);
  if (gameState) advanceGameTime(gameState, 2, "light");
  return { ok: true, notice, characterChanged: true };
}

function markDay1Water(flags) {
  if (!flags) return;
  if (typeof flags.has === "function" && flags.has("day1.found-water")) return;
  setFlags(flags, ["day1.found-water"]);
}
