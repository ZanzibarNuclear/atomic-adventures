import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { addItem } from "./holdings.js";
import { performItemAction } from "./itemActions.js";
import { createGameClock } from "./gameTime.js";
import {
  fillVesselInstance,
  normalizeContents,
  vesselDisplayLabel,
} from "./vessels.js";

const purifiedWater = {
  id: "purified-water",
  label: "purified water",
  kind: "consumable",
  carrying: "stack",
  maxQuantity: 24,
  properties: { form: "liquid", unitMl: 500 },
  actions: [{
    id: "drink",
    label: "Drink",
    consume: 0,
    consumeOptions: [
      { id: "sip", label: "Sip", portion: 0.25 },
      { id: "half", label: "Drink half", portion: 0.5 },
      { id: "all", label: "Drink all remaining", remaining: true },
    ],
    timeMinutes: 0,
    activity: "resting",
    effects: [{ op: "stat.add", id: "hydration", value: 100, scaleBy: "portion" }],
  }],
};

const bottle = {
  id: "water-bottle",
  label: "water bottle",
  kind: "vessel",
  carrying: "unique",
  maxQuantity: 4,
  portable: true,
  vessel: { capacityMl: 500, forms: ["liquid"] },
  actions: [],
};

function gameState() {
  const character = createCharacterState({
    items: [bottle, purifiedWater],
    stats: [
      { id: "hydration", type: "meter", default: 0, min: 0, max: 100 },
      { id: "satiety", type: "meter", default: 20, min: 0, max: 100 },
    ],
  });
  addItem(character.holdings, character.definitions, "water-bottle", 1);
  const instanceId = Object.entries(character.holdings.instances)
    .find(([, record]) => record.item === "water-bottle")[0];
  return {
    character,
    flags: new Set(),
    clock: createGameClock(),
    instanceId,
  };
}

describe("vessel contents", () => {
  it("fills a bottle and labels partial purified water", () => {
    const { character, instanceId } = gameState();
    const instance = character.holdings.instances[instanceId];
    const result = fillVesselInstance(instance, bottle, {
      liquidId: "purified-water",
      amountMl: 250,
      liquidDefinition: purifiedWater,
    });
    expect(result.ok).toBe(true);
    expect(normalizeContents(instance.contents)).toEqual({
      item: "purified-water",
      amountMl: 250,
    });
    expect(vesselDisplayLabel(instance, bottle, purifiedWater)).toBe(
      "water bottle (50% purified water)",
    );
  });

  it("supports sip / half / all drinking from vessel contents without destroying the vessel", () => {
    const state = gameState();
    const instance = state.character.holdings.instances[state.instanceId];
    fillVesselInstance(instance, bottle, {
      liquidId: "purified-water",
      amountMl: 500,
      liquidDefinition: purifiedWater,
    });

    // Volume-based hydration: 100 points ≈ 1.25 L daily budget (0.08 pts/mL).
    expect(performItemAction(state, "water-bottle", "drink", {
      recordId: state.instanceId,
      optionId: "sip",
    }).ok).toBe(true);
    // Sip = 25% of 500 mL capacity → 125 mL → +10 hydration.
    expect(state.character.stats.hydration).toBeCloseTo(10);
    let live = state.character.holdings.instances[state.instanceId];
    expect(normalizeContents(live.contents).amountMl).toBeCloseTo(375);

    expect(performItemAction(state, "water-bottle", "drink", {
      recordId: state.instanceId,
      optionId: "half",
    }).ok).toBe(true);
    // Half means half of capacity (250 mL), not half of whatever remains.
    live = state.character.holdings.instances[state.instanceId];
    expect(normalizeContents(live.contents).amountMl).toBeCloseTo(125);
    expect(state.character.stats.hydration).toBeCloseTo(30); // +20 for 250 mL

    expect(performItemAction(state, "water-bottle", "drink", {
      recordId: state.instanceId,
      optionId: "all",
    }).ok).toBe(true);
    live = state.character.holdings.instances[state.instanceId];
    expect(normalizeContents(live.contents)).toBeNull();
    expect(live.item).toBe("water-bottle");
    expect(state.character.stats.hydration).toBeCloseTo(40); // +10 for last 125 mL
  });
});
